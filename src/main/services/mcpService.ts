import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { homedir } from 'os'
import { spawnSync } from 'child_process'
import { net } from 'electron'

export interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  type?: string
  url?: string
  description: string
  source: 'user' | 'project' | 'plugin'
  sourceLabel: string
  configPath: string
  projectPath?: string
  usageCommand: string
  disabled?: boolean
  allowedTools?: string[]
}

export interface McpConfigFile {
  path: string
  source: 'user' | 'project' | 'plugin'
  sourceLabel: string
  servers: McpServer[]
  rawContent: string
}

const SAFE_SERVER_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/
const RESERVED_SERVER_NAMES = new Set(['__proto__', 'prototype', 'constructor'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeServerName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new Error('Invalid server name: expected non-empty string')
  }

  const trimmedName = name.trim()
  if (!SAFE_SERVER_NAME_PATTERN.test(trimmedName) || RESERVED_SERVER_NAMES.has(trimmedName)) {
    throw new Error(`Invalid server name: ${trimmedName}`)
  }

  return trimmedName
}

function sanitizeToolsList(tools: string[]): string[] {
  const uniqueTools = new Set<string>()
  for (const tool of tools) {
    const normalizedTool = String(tool).trim()
    if (!normalizedTool) continue
    uniqueTools.add(normalizedTool)
  }

  return [...uniqueTools]
}

function ensureMcpServersObject(container: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(container.mcpServers)) {
    container.mcpServers = {}
  }
  return container.mcpServers as Record<string, unknown>
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined

  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'string') {
      result[key] = val
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

function buildServerId(configPath: string, serverName: string, projectPath?: string): string {
  const scope = projectPath ?? '__root__'
  return `${configPath}_${scope}_${serverName}`.replace(/[\\/:]/g, '_')
}

function parseMcpServers(
  mcpServersObj: Record<string, unknown>,
  configPath: string,
  source: 'user' | 'project' | 'plugin',
  sourceLabel: string,
  disabled = false,
  projectPath?: string
): McpServer[] {
  const servers: McpServer[] = []

  for (const [name, serverConfig] of Object.entries(mcpServersObj)) {
    if (!isRecord(serverConfig)) continue

    const serverType = typeof serverConfig.type === 'string' ? serverConfig.type : ''
    const url = typeof serverConfig.url === 'string' ? serverConfig.url : ''
    const command = typeof serverConfig.command === 'string' ? serverConfig.command : ''
    const args = toStringArray(serverConfig.args)
    const env = toStringRecord(serverConfig.env)
    const allowedTools = toStringArray(serverConfig.allowedTools)
    const usageCommand = `mcp: ${name}`

    // For HTTP-type servers, display URL; for command-type, display command+args
    const fullCommand =
      serverType === 'http' && url ? url : [command, ...args].join(' ').trim()

    let description =
      typeof serverConfig.description === 'string' ? serverConfig.description.trim() : ''
    if (!description) {
      if (serverType === 'http' && url) {
        description = `HTTP MCP: ${url.slice(0, 100)}`
      } else if (args.some((a) => a.includes('server-filesystem'))) {
        description = 'Allow Claude to access local files'
      } else if (args.some((a) => a.includes('server-github'))) {
        description = 'GitHub repository operations'
      } else if (command.includes('postgres') || args.some((a) => a.includes('postgres'))) {
        description = 'PostgreSQL service'
      } else {
        description = `MCP Server: ${fullCommand.slice(0, 100)}`
      }
    }

    servers.push({
      id: buildServerId(configPath, name, projectPath),
      name,
      command: serverType === 'http' ? '' : command,
      args: serverType === 'http' ? [] : args,
      env,
      type: serverType || undefined,
      url: url || undefined,
      description,
      source,
      sourceLabel,
      configPath,
      projectPath,
      usageCommand,
      disabled,
      allowedTools: allowedTools.length > 0 ? allowedTools : undefined
    })
  }

  return servers
}

/**
 * Extract mcpServers from a parsed JSON config object.
 * Supports:
 *   - Top-level { mcpServers: { ... } }
 *   - .claude.json format: { projects: { [path]: { mcpServers: { ... } } } }
 */
function extractMcpServersFromConfig(
  parsed: Record<string, unknown>,
  configPath: string,
  source: 'user' | 'project' | 'plugin',
  sourceLabel: string
): McpServer[] {
  const servers: McpServer[] = []
  const seenServerKeys = new Set<string>()

  const addServerIfNeeded = (server: McpServer): void => {
    const scope = server.projectPath ?? '__root__'
    const key = `${scope}::${server.name}`
    if (seenServerKeys.has(key)) return
    seenServerKeys.add(key)
    servers.push(server)
  }

  // 1. Top-level mcpServers
  if (isRecord(parsed.mcpServers)) {
    for (const srv of parseMcpServers(parsed.mcpServers, configPath, source, sourceLabel)) {
      addServerIfNeeded(srv)
    }
  }

  // 1b. Top-level _disabled_mcpServers
  if (isRecord(parsed._disabled_mcpServers)) {
    for (const srv of parseMcpServers(parsed._disabled_mcpServers, configPath, source, sourceLabel, true)) {
      addServerIfNeeded(srv)
    }
  }

  // 2. projects -> [path] -> mcpServers  (.claude.json format)
  if (isRecord(parsed.projects)) {
    for (const [projectPath, projectConfig] of Object.entries(parsed.projects)) {
      if (!isRecord(projectConfig)) continue

      const projectName = basename(projectPath)
      const projLabel = `${sourceLabel} (${projectName})`

      // Active servers
      if (isRecord(projectConfig.mcpServers)) {
        for (const srv of parseMcpServers(
          projectConfig.mcpServers,
          configPath,
          source,
          projLabel,
          false,
          projectPath
        )) {
          addServerIfNeeded(srv)
        }
      }

      // Disabled servers
      if (isRecord(projectConfig._disabled_mcpServers)) {
        for (const srv of parseMcpServers(
          projectConfig._disabled_mcpServers,
          configPath,
          source,
          projLabel,
          true,
          projectPath
        )) {
          addServerIfNeeded(srv)
        }
      }
    }
  }

  return servers
}

function findMcpJsonFiles(dir: string, maxDepth = 2, currentDepth = 0): string[] {
  if (currentDepth > maxDepth || !existsSync(dir)) return []

  const results: string[] = []

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'out' || entry === 'dist') {
        continue
      }

      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isFile() && entry === '.mcp.json') {
          results.push(fullPath)
        } else if (stat.isDirectory() && currentDepth < maxDepth) {
          results.push(...findMcpJsonFiles(fullPath, maxDepth, currentDepth + 1))
        }
      } catch {
        // ignore unreadable path
      }
    }
  } catch {
    // ignore unreadable directory
  }

  return results
}

export function scanMcp(config: {
  mcpConfigPaths: string[]
  projectRoots: string[]
}): McpConfigFile[] {
  const configFiles: McpConfigFile[] = []
  const seen = new Set<string>()

  for (const mcpPath of config.mcpConfigPaths) {
    const resolvedPath = mcpPath.replace(/^~/, homedir())
    if (!existsSync(resolvedPath) || seen.has(resolvedPath)) continue
    seen.add(resolvedPath)

    try {
      const rawContent = readFileSync(resolvedPath, 'utf-8')
      const parsed = JSON.parse(rawContent) as unknown
      if (!isRecord(parsed)) continue

      configFiles.push({
        path: resolvedPath,
        source: 'user',
        sourceLabel: 'User',
        servers: extractMcpServersFromConfig(parsed, resolvedPath, 'user', 'User'),
        rawContent
      })
    } catch {
      // skip invalid json
    }
  }

  for (const projectRoot of config.projectRoots) {
    const resolvedRoot = projectRoot.replace(/^~/, homedir())
    if (!existsSync(resolvedRoot)) continue

    const mcpFiles = findMcpJsonFiles(resolvedRoot)
    for (const mcpFile of mcpFiles) {
      if (seen.has(mcpFile)) continue
      seen.add(mcpFile)

      try {
        const rawContent = readFileSync(mcpFile, 'utf-8')
        const parsed = JSON.parse(rawContent) as unknown
        if (!isRecord(parsed)) continue

        const projectName = basename(dirname(mcpFile))
        configFiles.push({
          path: mcpFile,
          source: 'project',
          sourceLabel: `Project: ${projectName}`,
          servers: extractMcpServersFromConfig(
            parsed,
            mcpFile,
            'project',
            `Project: ${projectName}`
          ),
          rawContent
        })
      } catch {
        // skip invalid json
      }
    }
  }

  // 3. Scan plugin-installed MCP servers from ~/.claude/plugins/cache
  const pluginMcps = scanPluginMcps()
  for (const pluginCfg of pluginMcps) {
    if (!seen.has(pluginCfg.path)) {
      seen.add(pluginCfg.path)
      configFiles.push(pluginCfg)
    }
  }

  return configFiles
}

/**
 * Scan Claude Code plugin-installed MCP servers.
 * Reads ~/.claude/settings.json for enabledPlugins,
 * then looks for .mcp.json files inside ~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/
 */
function scanPluginMcps(): McpConfigFile[] {
  const results: McpConfigFile[] = []
  const claudeDir = join(homedir(), '.claude')
  const settingsPath = join(claudeDir, 'settings.json')

  if (!existsSync(settingsPath)) return results

  let enabledPluginKeys: string[] = []
  try {
    const raw = JSON.parse(readFileSync(settingsPath, 'utf-8')) as unknown
    if (isRecord(raw) && isRecord(raw.enabledPlugins)) {
      enabledPluginKeys = Object.entries(raw.enabledPlugins)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    }
  } catch {
    return results
  }

  if (enabledPluginKeys.length === 0) return results

  const cacheDir = join(claudeDir, 'plugins', 'cache')
  if (!existsSync(cacheDir)) return results

  for (const pluginKey of enabledPluginKeys) {
    // pluginKey format: "pluginName@marketplace"
    const atIdx = pluginKey.lastIndexOf('@')
    if (atIdx <= 0) continue

    const pluginName = pluginKey.substring(0, atIdx)
    const marketplace = pluginKey.substring(atIdx + 1)
    const pluginCacheDir = join(cacheDir, marketplace, pluginName)

    if (!existsSync(pluginCacheDir)) continue

    // Look through version subdirectories for .mcp.json
    try {
      const versions = getSortedPluginVersions(pluginCacheDir)
      for (const version of versions) {
        const mcpJsonPath = join(pluginCacheDir, version, '.mcp.json')
        if (!existsSync(mcpJsonPath)) continue

        try {
          const rawContent = readFileSync(mcpJsonPath, 'utf-8')
          const parsed = JSON.parse(rawContent) as unknown
          if (!isRecord(parsed)) continue

          // Plugin .mcp.json has top-level server entries: { "serverName": { ... } }
          const servers = parseMcpServers(
            parsed,
            mcpJsonPath,
            'plugin',
            `Plugin: ${pluginName}`
          )

          if (servers.length > 0) {
            results.push({
              path: mcpJsonPath,
              source: 'plugin',
              sourceLabel: `Plugin: ${pluginName}`,
              servers,
              rawContent
            })
          }
          break // Found a version with .mcp.json, skip other versions
        } catch {
          // skip invalid json
        }
      }
    } catch {
      // skip unreadable dir
    }
  }

  return results
}

function getSortedPluginVersions(pluginCacheDir: string): string[] {
  const versions = readdirSync(pluginCacheDir).filter((version) => {
    try {
      return statSync(join(pluginCacheDir, version)).isDirectory()
    } catch {
      return false
    }
  })

  versions.sort((a, b) => {
    const aPath = join(pluginCacheDir, a)
    const bPath = join(pluginCacheDir, b)

    let aMtime = 0
    let bMtime = 0
    try {
      aMtime = statSync(aPath).mtimeMs
    } catch {
      // ignore
    }
    try {
      bMtime = statSync(bPath).mtimeMs
    } catch {
      // ignore
    }

    if (bMtime !== aMtime) return bMtime - aMtime
    return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
  })

  return versions
}

export function getMcpConfig(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

export function saveMcpConfig(filePath: string, content: string): void {
  JSON.parse(content)
  writeFileSync(filePath, content, 'utf-8')
}

// ====== Health Check ======

export type McpHealthStatus = 'connected' | 'failed' | 'unknown'

function checkHttpHealth(url: string, timeoutMs = 3000): Promise<McpHealthStatus> {
  return new Promise((resolve) => {
    try {
      const request = net.request({ method: 'HEAD', url })
      const timer = setTimeout(() => {
        request.abort()
        resolve('failed')
      }, timeoutMs)

      request.on('response', () => {
        clearTimeout(timer)
        resolve('connected')
      })
      request.on('error', () => {
        clearTimeout(timer)
        resolve('failed')
      })
      request.end()
    } catch {
      resolve('failed')
    }
  })
}

function checkCommandExists(command: string): McpHealthStatus {
  const trimmedCommand = command.trim()
  if (!trimmedCommand) return 'unknown'

  const binary =
    (trimmedCommand.startsWith('"') && trimmedCommand.endsWith('"')) ||
    (trimmedCommand.startsWith("'") && trimmedCommand.endsWith("'"))
      ? trimmedCommand.slice(1, -1).trim()
      : trimmedCommand
  if (!binary) return 'unknown'

  if ((binary.includes('/') || binary.includes('\\')) && existsSync(binary)) {
    return 'connected'
  }

  try {
    const lookupBinary = process.platform === 'win32' ? 'where.exe' : 'which'
    const result = spawnSync(lookupBinary, [binary], {
      stdio: 'ignore',
      shell: false,
      windowsHide: true
    })
    return result.status === 0 ? 'connected' : 'failed'
  } catch {
    return 'failed'
  }
}

export async function checkMcpHealth(
  servers: McpServer[]
): Promise<Record<string, McpHealthStatus>> {
  const results: Record<string, McpHealthStatus> = {}

  const promises = servers.map(async (server) => {
    if (server.type === 'http' && server.url) {
      results[server.id] = await checkHttpHealth(server.url)
    } else if (server.command) {
      results[server.id] = checkCommandExists(server.command)
    } else {
      results[server.id] = 'unknown'
    }
  })

  await Promise.all(promises)
  return results
}

// ====== Toggle Server ======

export function toggleMcpServer(
  configPath: string,
  serverName: string,
  enabled: boolean,
  projectPath?: string
): void {
  const validatedServerName = sanitizeServerName(serverName)
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid MCP config format')
  }

  if (projectPath) {
    const projects = isRecord(parsed.projects)
      ? (parsed.projects as Record<string, unknown>)
      : undefined
    const scopedProject = projects ? projects[projectPath] : undefined
    if (isRecord(scopedProject) && tryToggleInObject(scopedProject, validatedServerName, enabled)) {
      writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8')
    }
    return
  }

  // Try top-level mcpServers
  if (tryToggleInObject(parsed, validatedServerName, enabled)) {
    writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8')
  }
}

function tryToggleInObject(
  obj: Record<string, unknown>,
  serverName: string,
  enabled: boolean
): boolean {
  const active = isRecord(obj.mcpServers) ? obj.mcpServers : {}
  const disabled = isRecord(obj._disabled_mcpServers) ? obj._disabled_mcpServers : {}

  if (enabled && serverName in disabled) {
    // Move from disabled to active
    if (!isRecord(obj.mcpServers)) obj.mcpServers = {}
    ;(obj.mcpServers as Record<string, unknown>)[serverName] = disabled[serverName]
    delete disabled[serverName]
    if (Object.keys(disabled).length === 0) {
      delete obj._disabled_mcpServers
    } else {
      obj._disabled_mcpServers = disabled
    }
    return true
  }

  if (!enabled && serverName in active) {
    // Move from active to disabled
    if (!isRecord(obj._disabled_mcpServers)) obj._disabled_mcpServers = {}
    ;(obj._disabled_mcpServers as Record<string, unknown>)[serverName] = active[serverName]
    delete active[serverName]
    return true
  }

  return false
}

// ====== Add Server ======

export interface NewMcpServerConfig {
  name: string
  type: 'command' | 'http'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

export function addMcpServer(configPath: string, serverConfig: NewMcpServerConfig): void {
  const validatedServerName = sanitizeServerName(serverConfig.name)
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid MCP config format')
  }

  const mcpServers = ensureMcpServersObject(parsed)

  const entry: Record<string, unknown> = {}
  if (serverConfig.type === 'http') {
    entry.type = 'http'
    entry.url = serverConfig.url || ''
  } else {
    entry.command = serverConfig.command || ''
    if (serverConfig.args && serverConfig.args.length > 0) {
      entry.args = serverConfig.args
    }
  }
  if (serverConfig.env && Object.keys(serverConfig.env).length > 0) {
    entry.env = serverConfig.env
  }

  mcpServers[validatedServerName] = entry
  writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8')
}

// ====== Delete Server ======

export function deleteMcpServer(
  configPath: string,
  serverName: string,
  projectPath?: string
): void {
  const validatedServerName = sanitizeServerName(serverName)
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid MCP config format')
  }
  let changed = false

  const deleteServerInScope = (scope: Record<string, unknown>): boolean => {
    let scopeChanged = false

    if (isRecord(scope.mcpServers) && validatedServerName in scope.mcpServers) {
      delete scope.mcpServers[validatedServerName]
      scopeChanged = true
    }
    if (
      isRecord(scope._disabled_mcpServers) &&
      validatedServerName in scope._disabled_mcpServers
    ) {
      delete scope._disabled_mcpServers[validatedServerName]
      if (Object.keys(scope._disabled_mcpServers).length === 0) {
        delete scope._disabled_mcpServers
      }
      scopeChanged = true
    }

    return scopeChanged
  }

  if (projectPath) {
    const projects = isRecord(parsed.projects)
      ? (parsed.projects as Record<string, unknown>)
      : undefined
    const scopedProject = projects ? projects[projectPath] : undefined
    if (isRecord(scopedProject)) {
      changed = deleteServerInScope(scopedProject)
    }
  } else {
    changed = deleteServerInScope(parsed)
  }

  if (changed) {
    writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8')
  }
}

// ====== Import from JSON ======

export function importMcpFromJson(configPath: string, jsonStr: string): { imported: string[] } {
  const snippet = JSON.parse(jsonStr) as unknown
  if (!isRecord(snippet)) {
    throw new Error('Invalid import JSON format')
  }
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid MCP config format')
  }

  const mcpServers = ensureMcpServersObject(parsed)

  const imported: string[] = []

  // Case 1: { "mcpServers": { ... } }
  if (isRecord(snippet.mcpServers)) {
    for (const [name, config] of Object.entries(snippet.mcpServers)) {
      const validatedName = sanitizeServerName(name)
      mcpServers[validatedName] = config
      imported.push(validatedName)
    }
  }
  // Case 2: { "serverName": { command/url... } }  — bare server entries
  else if (!('mcpServers' in snippet)) {
    for (const [name, config] of Object.entries(snippet)) {
      if (isRecord(config)) {
        const validatedName = sanitizeServerName(name)
        mcpServers[validatedName] = config
        imported.push(validatedName)
      }
    }
  } else {
    throw new Error('Invalid import JSON: mcpServers must be an object')
  }

  writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8')
  return { imported }
}

// ====== Allowed Tools ======

export function setAllowedTools(
  configPath: string,
  serverName: string,
  tools: string[],
  projectPath?: string
): void {
  const validatedServerName = sanitizeServerName(serverName)
  const sanitizedTools = sanitizeToolsList(tools)
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid MCP config format')
  }
  let found = false

  const updateAllowedTools = (scope: Record<string, unknown>): boolean => {
    if (!isRecord(scope.mcpServers) || !isRecord(scope.mcpServers[validatedServerName])) {
      return false
    }

    const server = scope.mcpServers[validatedServerName] as Record<string, unknown>
    if (sanitizedTools.length > 0) {
      server.allowedTools = sanitizedTools
    } else {
      delete server.allowedTools
    }
    return true
  }

  if (projectPath) {
    const projects = isRecord(parsed.projects)
      ? (parsed.projects as Record<string, unknown>)
      : undefined
    const scopedProject = projects ? projects[projectPath] : undefined
    if (isRecord(scopedProject)) {
      found = updateAllowedTools(scopedProject)
    }
  } else {
    // Try top-level mcpServers
    found = updateAllowedTools(parsed)
  }

  if (found) {
    writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8')
  }
}
