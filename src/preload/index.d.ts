import { ElectronAPI } from '@electron-toolkit/preload'

interface Skill {
  id: string
  name: string
  description: string
  filePath: string
  dirPath: string
  source: 'user' | 'project' | 'marketplace'
  sourceLabel: string
  usageCommand: string
  slashCommand: string
  features: string[]
  instructions: string
  rawContent: string
}

interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  description: string
  source: 'user' | 'project'
  sourceLabel: string
  configPath: string
  usageCommand: string
}

interface McpConfigFile {
  path: string
  source: 'user' | 'project'
  sourceLabel: string
  servers: McpServer[]
  rawContent: string
}

interface AppConfig {
  scanPaths: {
    skills: string[]
    mcpConfigs: string[]
  }
  projectRoots: string[]
}

interface AgentForgeAPI {
  scanSkills(): Promise<Skill[]>
  getSkillContent(filePath: string): Promise<string>
  saveSkillContent(filePath: string, content: string): Promise<{ success: boolean }>
  translateSkillContent(
    description: string,
    instructions: string,
    features: string[]
  ): Promise<{ description: string; instructions: string; features: string[] }>
  scanMcp(): Promise<McpConfigFile[]>
  getMcpConfig(filePath: string): Promise<string>
  saveMcpConfig(filePath: string, content: string): Promise<{ success: boolean }>
  getConfig(): Promise<AppConfig>
  saveConfig(config: AppConfig): Promise<{ success: boolean }>
  openInExplorer(path: string): Promise<void>
  openExternal(url: string): Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AgentForgeAPI
  }
}
