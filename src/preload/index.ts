import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: object) => ipcRenderer.invoke('config:save', config),

  // Utils
  openInExplorer: (path: string) => ipcRenderer.invoke('utils:openInExplorer', path),
  openExternal: (url: string) => ipcRenderer.invoke('utils:openExternal', url)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
