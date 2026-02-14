import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { scanSkills, getSkillContent, saveSkillContent } from './services/skillsService'
import { scanMcp, getMcpConfig, saveMcpConfig } from './services/mcpService'
import { translateSkillContent } from './services/translateService'

// -----------------------------------------------------------
// Config 管理
// -----------------------------------------------------------
interface AppConfig {
  scanPaths: {
    skills: string[]
    mcpConfigs: string[]
  }
  projectRoots: string[]
}

const CONFIG_PATH = join(app.getPath('userData'), 'config.json')
const DEFAULT_CONFIG_PATH = join(__dirname, '../../config.json')

function loadConfig(): AppConfig {
  // 优先从用户数据目录读取
  if (existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    } catch {
      // 配置损坏，使用默认
    }
  }

  // 从项目默认配置读
  if (existsSync(DEFAULT_CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf-8'))
    } catch {
      // 配置损坏
    }
  }

  // 兜底默认值
  return {
    scanPaths: {
      skills: ['~/.claude/skills'],
      mcpConfigs: ['~/.claude.json']
    },
    projectRoots: ['D:/project']
  }
}

function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

// -----------------------------------------------------------
// 窗口创建
// -----------------------------------------------------------
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
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// -----------------------------------------------------------
// IPC Handlers 注册
// -----------------------------------------------------------
function registerIpcHandlers(): void {
  // Skills
  ipcMain.handle('skills:scan', () => {
    const cfg = loadConfig()
    return scanSkills({
      skillPaths: cfg.scanPaths.skills,
      projectRoots: cfg.projectRoots
    })
  })

  ipcMain.handle('skills:getContent', (_event, filePath: string) => {
    return getSkillContent(filePath)
  })

  ipcMain.handle('skills:saveContent', (_event, filePath: string, content: string) => {
    saveSkillContent(filePath, content)
    return { success: true }
  })

  // MCP
  ipcMain.handle('mcp:scan', () => {
    const cfg = loadConfig()
    return scanMcp({
      mcpConfigPaths: cfg.scanPaths.mcpConfigs,
      projectRoots: cfg.projectRoots
    })
  })

  ipcMain.handle('mcp:getConfig', (_event, filePath: string) => {
    return getMcpConfig(filePath)
  })

  ipcMain.handle('mcp:saveConfig', (_event, filePath: string, content: string) => {
    saveMcpConfig(filePath, content)
    return { success: true }
  })

  // Translation
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

  // Config
  ipcMain.handle('config:get', () => {
    return loadConfig()
  })

  ipcMain.handle('config:save', (_event, newConfig: AppConfig) => {
    saveConfig(newConfig)
    return { success: true }
  })

  // Utils
  ipcMain.handle('utils:openInExplorer', (_event, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('utils:openExternal', (_event, url: string) => {
    shell.openExternal(url)
  })
}

// -----------------------------------------------------------
// App 初始化
// -----------------------------------------------------------
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.agent-forge')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
