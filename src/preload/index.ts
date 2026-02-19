import { contextBridge, ipcRenderer } from 'electron'

interface AppConfig {
  scanPaths: {
    skills: string[]
    mcpConfigs: string[]
  }
  projectRoots: string[]
}

// Custom APIs for renderer
const api = {
  // Skills
  scanSkills: () => ipcRenderer.invoke('skills:scan'),
  getSkillContent: (filePath: string) => ipcRenderer.invoke('skills:getContent', filePath),
  saveSkillContent: (filePath: string, content: string) =>
    ipcRenderer.invoke('skills:saveContent', filePath, content),
  translateSkillContent: (description: string, instructions: string, features: string[]) =>
    ipcRenderer.invoke('skills:translate', description, instructions, features),

  // MCP
  scanMcp: () => ipcRenderer.invoke('mcp:scan'),
  getMcpConfig: (filePath: string) => ipcRenderer.invoke('mcp:getConfig', filePath),
  saveMcpConfig: (filePath: string, content: string) =>
    ipcRenderer.invoke('mcp:saveConfig', filePath, content),
  checkMcpHealth: (servers: unknown[]) => ipcRenderer.invoke('mcp:checkHealth', servers),
  toggleMcpServer: (
    configPath: string,
    serverName: string,
    enabled: boolean,
    projectPath?: string
  ) => ipcRenderer.invoke('mcp:toggleServer', configPath, serverName, enabled, projectPath),
  addMcpServer: (configPath: string, serverConfig: unknown) =>
    ipcRenderer.invoke('mcp:addServer', configPath, serverConfig),
  deleteMcpServer: (configPath: string, serverName: string, projectPath?: string) =>
    ipcRenderer.invoke('mcp:deleteServer', configPath, serverName, projectPath),
  importMcpFromJson: (configPath: string, jsonStr: string) =>
    ipcRenderer.invoke('mcp:importJson', configPath, jsonStr),
  getMcpLogs: () => ipcRenderer.invoke('mcp:getLogs'),
  clearMcpLogs: () => ipcRenderer.invoke('mcp:clearLogs'),
  setAllowedTools: (
    configPath: string,
    serverName: string,
    tools: string[],
    projectPath?: string
  ) => ipcRenderer.invoke('mcp:setAllowedTools', configPath, serverName, tools, projectPath),
  openDxtFile: () => ipcRenderer.invoke('dialog:openDxt'),
  parseDxt: (filePath: string) => ipcRenderer.invoke('mcp:parseDxt', filePath),
  installDxt: (filePath: string, configPath: string, userConfigValues?: Record<string, string>) =>
    ipcRenderer.invoke('mcp:installDxt', filePath, configPath, userConfigValues),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('config:save', config),

  // Utils
  openInExplorer: (path: string) => ipcRenderer.invoke('utils:openInExplorer', path),
  openExternal: (url: string) => ipcRenderer.invoke('utils:openExternal', url)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
