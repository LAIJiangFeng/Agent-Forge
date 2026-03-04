import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, extname, join, normalize, relative, resolve, sep } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  addMcpServer,
  checkMcpHealth,
  deleteMcpServer,
  getMcpConfig,
  importMcpFromJson,
  saveMcpConfig,
  scanMcp,
  setAllowedTools,
  toggleMcpServer
} from './services/mcpService'
import { addMcpLog, clearMcpLogs, getMcpLogs } from './services/mcpLogService'
import { installDxt, parseDxtFile } from './services/dxtService'
import { deleteSkill, getSkillContent, saveSkillContent, scanSkills } from './services/skillsService'
import { translateSkillContent } from './services/translateService'
import {
  aiSearchMarketplaceSkills,
  installMarketplaceSkill,
  searchMarketplaceSkills
} from './services/skillsMarketplaceService'

interface AppConfig {
  scanPaths: {
    skills: string[]
    mcpConfigs: string[]
  }
  projectRoots: string[]
  skillsmpApiKey?: string
}

const CONFIG_PATH = join(app.getPath('userData'), 'config.json')
const DEFAULT_CONFIG_PATH = join(__dirname, '../../config.json')
const DEFAULT_PROJECT_ROOT =
  process.platform === 'win32' ? 'D:/project' : join(homedir(), 'project')
const MAX_DXT_FILE_BYTES = 50 * 1024 * 1024
const approvedDxtFiles = new Set<string>()
const DEFAULT_CONFIG: AppConfig = {
  scanPaths: {
    skills: ['~/.claude/skills', '~/.claude/plugins/marketplaces'],
    mcpConfigs: ['~/.claude.json']
  },
  projectRoots: [DEFAULT_PROJECT_ROOT],
  skillsmpApiKey: ''
}

// Module-level config cache — populated on first access and invalidated on save
let _cachedConfig: AppConfig | null = null

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const result: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const normalizedValue = item.trim()
    if (!normalizedValue || seen.has(normalizedValue)) continue

    seen.add(normalizedValue)
    result.push(normalizedValue)

    if (result.length >= 200) break
  }

  return result
}

function sanitizeConfig(input: unknown): AppConfig {
  const obj = input && typeof input === 'object' ? (input as Partial<AppConfig>) : {}
  const scanPaths =
    obj.scanPaths && typeof obj.scanPaths === 'object'
      ? (obj.scanPaths as Partial<AppConfig['scanPaths']>)
      : {}

  const skills = sanitizeStringList(scanPaths.skills)
  const mcpConfigs = sanitizeStringList(scanPaths.mcpConfigs)
  const projectRoots = sanitizeStringList(obj.projectRoots)

  const rawApiKey = obj.skillsmpApiKey
  const skillsmpApiKey = typeof rawApiKey === 'string' ? rawApiKey.trim().slice(0, 256) : ''

  return {
    scanPaths: {
      skills: skills.length > 0 ? skills : [...DEFAULT_CONFIG.scanPaths.skills],
      mcpConfigs: mcpConfigs.length > 0 ? mcpConfigs : [...DEFAULT_CONFIG.scanPaths.mcpConfigs]
    },
    projectRoots: projectRoots.length > 0 ? projectRoots : [...DEFAULT_CONFIG.projectRoots],
    skillsmpApiKey
  }
}

function loadConfig(): AppConfig {
  if (_cachedConfig !== null) return _cachedConfig

  let result: AppConfig
  if (existsSync(CONFIG_PATH)) {
    try {
      result = sanitizeConfig(JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')))
      _cachedConfig = result
      return result
    } catch {
      // fallback to project/default config
    }
  }

  if (existsSync(DEFAULT_CONFIG_PATH)) {
    try {
      result = sanitizeConfig(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf-8')))
      _cachedConfig = result
      return result
    } catch {
      // fallback to hardcoded defaults
    }
  }

  result = sanitizeConfig(DEFAULT_CONFIG)
  _cachedConfig = result
  return result
}

/** Invalidate the in-memory config cache so the next loadConfig() re-reads disk. */
function invalidateConfigCache(): void {
  _cachedConfig = null
}

/**
 * Resolve the SkillsMP API key from the cached config, then fall back to
 * the SKILLSMP_API_KEY environment variable.  No filesystem scanning is
 * performed on every call — the cache is kept fresh by saveConfig().
 */
function resolveSkillsmpApiKey(): string {
  const fromConfig = loadConfig().skillsmpApiKey?.trim()
  if (fromConfig) return fromConfig

  const envApiKey =
    typeof process.env.SKILLSMP_API_KEY === 'string'
      ? process.env.SKILLSMP_API_KEY.trim().slice(0, 256)
      : ''
  return envApiKey
}

function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(sanitizeConfig(config), null, 2), 'utf-8')
  // Invalidate cache so subsequent loadConfig() calls see the new values
  invalidateConfigCache()
}

function expandHomePath(inputPath: string): string {
  return inputPath.replace(/^~/, homedir())
}

function resolveCanonicalPath(inputPath: string): string {
  const resolvedPath = resolve(inputPath)

  try {
    return realpathSync.native(resolvedPath)
  } catch {
    // If target path is absent, canonicalize parent to avoid symlink bypass.
    try {
      const realParentPath = realpathSync.native(dirname(resolvedPath))
      return join(realParentPath, basename(resolvedPath))
    } catch {
      return resolvedPath
    }
  }
}

function normalizeForCompare(inputPath: string): string {
  const normalizedPath = normalize(resolveCanonicalPath(inputPath))
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
}

function isPathWithin(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalizeForCompare(basePath)
  const normalizedTarget = normalizeForCompare(targetPath)
  return (
    normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}${sep}`)
  )
}

function isSkillFile(filePath: string): boolean {
  return /(^|[\\/])SKILL\.md$/i.test(filePath)
}

function isMcpConfigFile(filePath: string): boolean {
  return basename(filePath).toLowerCase() === '.mcp.json'
}

function isPluginMcpConfigFile(filePath: string): boolean {
  const pluginCacheDir = join(homedir(), '.claude', 'plugins', 'cache')
  return isPathWithin(pluginCacheDir, filePath) && isMcpConfigFile(filePath)
}

function isAllowedSkillFile(filePath: string, config: AppConfig): boolean {
  if (!isSkillFile(filePath)) return false

  for (const skillPath of config.scanPaths.skills) {
    if (isPathWithin(expandHomePath(skillPath), filePath)) return true
  }

  for (const projectRoot of config.projectRoots) {
    const resolvedRoot = expandHomePath(projectRoot)
    if (!isPathWithin(resolvedRoot, filePath)) continue

    const relPath = relative(resolvedRoot, filePath).replace(/\\/g, '/')
    if (/(^|\/)\.claude\/skills\/(?:.+\/)?SKILL\.md$/i.test(relPath)) return true
  }

  return false
}

function isAllowedMcpConfig(filePath: string, config: AppConfig): boolean {
  const normalizedTarget = normalizeForCompare(filePath)

  for (const mcpPath of config.scanPaths.mcpConfigs) {
    if (normalizeForCompare(expandHomePath(mcpPath)) === normalizedTarget) return true
  }

  if (isPluginMcpConfigFile(filePath)) return true

  if (!isMcpConfigFile(filePath)) return false
  return config.projectRoots.some((root) => isPathWithin(expandHomePath(root), filePath))
}

function isAllowedExplorerPath(filePath: string, config: AppConfig): boolean {
  if (isAllowedSkillFile(filePath, config) || isAllowedMcpConfig(filePath, config)) return true
  return config.projectRoots.some((root) => isPathWithin(expandHomePath(root), filePath))
}

function assertAllowedSkillFile(filePath: string): string {
  const resolvedPath = resolve(filePath)
  if (!isAllowedSkillFile(resolvedPath, loadConfig())) {
    throw new Error('Access denied: skill path is outside configured scope')
  }
  return resolvedPath
}

function assertAllowedMcpConfig(filePath: string): string {
  const resolvedPath = resolve(filePath)
  if (!isAllowedMcpConfig(resolvedPath, loadConfig())) {
    throw new Error('Access denied: mcp config path is outside configured scope')
  }
  return resolvedPath
}

function assertAllowedMcpConfigRead(filePath: string): string {
  return assertAllowedMcpConfig(filePath)
}

function assertAllowedMcpConfigWrite(filePath: string): string {
  const resolvedPath = assertAllowedMcpConfig(filePath)
  if (isPluginMcpConfigFile(resolvedPath)) {
    throw new Error('Access denied: plugin mcp config is read-only')
  }
  return resolvedPath
}

function assertAllowedExplorerPath(filePath: string): string {
  const resolvedPath = resolve(filePath)
  if (!isAllowedExplorerPath(resolvedPath, loadConfig())) {
    throw new Error('Access denied: path is outside configured scope')
  }
  return resolvedPath
}

function assertSafeDxtFile(filePath: string): string {
  const resolvedPath = resolve(filePath)
  const fileExt = extname(resolvedPath).toLowerCase()
  if (fileExt !== '.dxt' && fileExt !== '.mcpb') {
    throw new Error('Invalid extension: only .dxt and .mcpb files are allowed')
  }
  if (!existsSync(resolvedPath)) {
    throw new Error('DXT file does not exist')
  }

  const stat = statSync(resolvedPath)
  if (!stat.isFile()) {
    throw new Error('DXT path is not a file')
  }
  if (stat.size <= 0 || stat.size > MAX_DXT_FILE_BYTES) {
    throw new Error(`DXT file size must be between 1B and ${MAX_DXT_FILE_BYTES} bytes`)
  }

  return resolvedPath
}

function assertApprovedDxtFile(filePath: string): string {
  const resolvedPath = assertSafeDxtFile(filePath)
  const normalizedPath = normalizeForCompare(resolvedPath)
  if (!approvedDxtFiles.has(normalizedPath)) {
    throw new Error('Access denied: DXT file must be selected from the file dialog first')
  }
  return resolvedPath
}

async function safeOpenExternal(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }

  const allowedProtocols = new Set(['http:', 'https:'])
  if (!allowedProtocols.has(parsed.protocol)) {
    throw new Error(`Blocked external protocol: ${parsed.protocol}`)
  }

  await shell.openExternal(parsed.toString())
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void safeOpenExternal(details.url).catch((err) => {
      console.warn('[security] blocked window open:', details.url, err)
    })
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('skills:scan', () => {
    const cfg = loadConfig()
    return scanSkills({
      skillPaths: cfg.scanPaths.skills,
      projectRoots: cfg.projectRoots
    })
  })

  ipcMain.handle('skills:getContent', (_event, filePath: string) => {
    return getSkillContent(assertAllowedSkillFile(filePath))
  })

  ipcMain.handle('skills:saveContent', (_event, filePath: string, content: string) => {
    saveSkillContent(assertAllowedSkillFile(filePath), content)
    return { success: true }
  })

  ipcMain.handle('skills:delete', (_event, filePath: string, dirPath: string) => {
    // Validate that the skill file is within allowed scope
    assertAllowedSkillFile(filePath)
    deleteSkill(resolve(dirPath))
    return { success: true }
  })

  ipcMain.handle('mcp:scan', () => {
    const cfg = loadConfig()
    return scanMcp({
      mcpConfigPaths: cfg.scanPaths.mcpConfigs,
      projectRoots: cfg.projectRoots
    })
  })

  ipcMain.handle('mcp:getConfig', (_event, filePath: string) => {
    return getMcpConfig(assertAllowedMcpConfigRead(filePath))
  })

  ipcMain.handle('mcp:saveConfig', (_event, filePath: string, content: string) => {
    saveMcpConfig(assertAllowedMcpConfigWrite(filePath), content)
    return { success: true }
  })

  ipcMain.handle('mcp:checkHealth', async (_event, servers: unknown) => {
    if (!Array.isArray(servers)) return {}
    const result = await checkMcpHealth(servers)
    addMcpLog('healthCheck', '*', `${Object.values(result).filter(s => s === 'connected').length}/${Object.keys(result).length} connected`)
    return result
  })

  ipcMain.handle(
    'mcp:toggleServer',
    (
      _event,
      configPath: string,
      serverName: string,
      enabled: boolean,
      projectPath?: string
    ) => {
      toggleMcpServer(assertAllowedMcpConfigWrite(configPath), serverName, enabled, projectPath)
      addMcpLog(enabled ? 'enable' : 'disable', serverName, configPath)
      return { success: true }
    }
  )

  ipcMain.handle(
    'mcp:addServer',
    (_event, configPath: string, serverConfig: unknown) => {
      addMcpServer(
        assertAllowedMcpConfigWrite(configPath),
        serverConfig as Parameters<typeof addMcpServer>[1]
      )
      addMcpLog('add', (serverConfig as { name?: string })?.name || 'unknown', configPath)
      return { success: true }
    }
  )

  ipcMain.handle(
    'mcp:deleteServer',
    (_event, configPath: string, serverName: string, projectPath?: string) => {
      deleteMcpServer(assertAllowedMcpConfigWrite(configPath), serverName, projectPath)
      addMcpLog('delete', serverName, configPath)
      return { success: true }
    }
  )

  ipcMain.handle(
    'mcp:importJson',
    (_event, configPath: string, jsonStr: string) => {
      const result = importMcpFromJson(assertAllowedMcpConfigWrite(configPath), jsonStr)
      addMcpLog('import', result.imported.join(', '), `${result.imported.length} servers imported`)
      return result
    }
  )

  ipcMain.handle('mcp:getLogs', () => {
    return getMcpLogs()
  })

  ipcMain.handle('mcp:clearLogs', () => {
    clearMcpLogs()
    return { success: true }
  })

  ipcMain.handle(
    'mcp:setAllowedTools',
    (_event, configPath: string, serverName: string, tools: string[], projectPath?: string) => {
      setAllowedTools(assertAllowedMcpConfigWrite(configPath), serverName, tools, projectPath)
      addMcpLog('setTools', serverName, `${tools.length} tools allowed`)
      return { success: true }
    }
  )

  // DXT
  ipcMain.handle('dialog:openDxt', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 DXT / MCPB 扩展文件',
      filters: [{ name: 'DXT Extensions', extensions: ['dxt', 'mcpb'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = assertSafeDxtFile(result.filePaths[0])
    approvedDxtFiles.add(normalizeForCompare(selectedPath))
    return selectedPath
  })

  ipcMain.handle('mcp:parseDxt', (_event, filePath: string) => {
    try {
      return parseDxtFile(assertApprovedDxtFile(filePath))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(
    'mcp:installDxt',
    (
      _event,
      filePath: string,
      configPath: string,
      userConfigValues?: Record<string, string>
    ) => {
      let approvedFilePath = ''
      try {
        approvedFilePath = assertApprovedDxtFile(filePath)
        const result = installDxt(
          approvedFilePath,
          assertAllowedMcpConfigWrite(configPath),
          userConfigValues
        )
        addMcpLog('installDxt', result.serverName, `DXT installed to ${result.installDir}`)
        return result
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err))
      } finally {
        if (approvedFilePath) {
          approvedDxtFiles.delete(normalizeForCompare(approvedFilePath))
        }
      }
    }
  )

  ipcMain.handle(
    'skills:translate',
    async (_event, description: string, instructions: string, features: string[]) => {
      try {
        return await translateSkillContent(description, instructions, features)
      } catch (err) {
        console.error('[IPC] skills:translate error:', err)
        return { description, instructions, features }
      }
    }
  )

  ipcMain.handle('config:get', () => {
    const cfg = loadConfig()
    // Return a sanitized view: omit the raw key and expose only a boolean flag
    // so the renderer never holds the full API key in its reactive state.
    return {
      scanPaths: cfg.scanPaths,
      projectRoots: cfg.projectRoots,
      skillsmpApiKeyConfigured: !!(cfg.skillsmpApiKey && cfg.skillsmpApiKey.trim())
    }
  })

  ipcMain.handle('config:save', (_event, newConfig: AppConfig) => {
    // Preserve the existing API key when saving path-only config updates
    const existing = loadConfig()
    const merged = sanitizeConfig({ ...newConfig, skillsmpApiKey: existing.skillsmpApiKey })
    saveConfig(merged)
    return { success: true }
  })

  /** Dedicated handler for updating the API key — keeps it out of the general config payload. */
  ipcMain.handle('config:setApiKey', (_event, apiKey: string) => {
    const existing = loadConfig()
    const sanitizedKey = typeof apiKey === 'string' ? apiKey.trim().slice(0, 256) : ''
    saveConfig(sanitizeConfig({ ...existing, skillsmpApiKey: sanitizedKey }))
    return { success: true }
  })

  ipcMain.handle('utils:openInExplorer', (_event, filePath: string) => {
    shell.showItemInFolder(assertAllowedExplorerPath(filePath))
  })

  ipcMain.handle('utils:openExternal', async (_event, url: string) => {
    await safeOpenExternal(url)
  })

  // Marketplace
  ipcMain.handle(
    'marketplace:search',
    async (
      _event,
      query: string,
      page?: number,
      limit?: number,
      sortBy?: 'stars' | 'recent'
    ) => {
      const apiKey = resolveSkillsmpApiKey()
      if (!apiKey) {
        throw new Error(`Please configure SkillsMP API Key in Settings and save. Config path: ${CONFIG_PATH}`)
      }
      return searchMarketplaceSkills(apiKey, query, page, limit, sortBy)
    }
  )

  ipcMain.handle('marketplace:aiSearch', async (_event, query: string) => {
    const apiKey = resolveSkillsmpApiKey()
    if (!apiKey) {
      throw new Error(`Please configure SkillsMP API Key in Settings and save. Config path: ${CONFIG_PATH}`)
    }
    return aiSearchMarketplaceSkills(apiKey, query)
  })

  ipcMain.handle(
    'marketplace:install',
    async (_event, skillName: string, githubUrl: string) => {
      return installMarketplaceSkill(skillName, githubUrl)
    }
  )
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.agent-forge')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
