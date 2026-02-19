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

interface McpConfigFile {
  path: string
  source: 'user' | 'project' | 'plugin'
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

interface McpLogEntry {
  id: number
  timestamp: number
  action: string
  serverName: string
  detail: string
}

interface DxtUserConfigField {
  key: string
  type: string
  title: string
  description: string
  required: boolean
  sensitive: boolean
  defaultValue: string
}

interface DxtParseResult {
  manifest: {
    name: string
    version: string
    description: string
    display_name?: string
    author: { name: string }
    server: { type: string; entry_point: string }
    tools?: Array<{ name: string; description?: string }>
  }
  hasUserConfig: boolean
  userConfigFields: DxtUserConfigField[]
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
  checkMcpHealth(servers: unknown[]): Promise<Record<string, 'connected' | 'failed' | 'unknown'>>
  toggleMcpServer(
    configPath: string,
    serverName: string,
    enabled: boolean,
    projectPath?: string
  ): Promise<{ success: boolean }>
  addMcpServer(configPath: string, serverConfig: unknown): Promise<{ success: boolean }>
  deleteMcpServer(
    configPath: string,
    serverName: string,
    projectPath?: string
  ): Promise<{ success: boolean }>
  importMcpFromJson(configPath: string, jsonStr: string): Promise<{ imported: string[] }>
  getMcpLogs(): Promise<McpLogEntry[]>
  clearMcpLogs(): Promise<{ success: boolean }>
  setAllowedTools(
    configPath: string,
    serverName: string,
    tools: string[],
    projectPath?: string
  ): Promise<{ success: boolean }>
  openDxtFile(): Promise<string | null>
  parseDxt(filePath: string): Promise<DxtParseResult>
  installDxt(filePath: string, configPath: string, userConfigValues?: Record<string, string>): Promise<{ serverName: string; installDir: string }>
  getConfig(): Promise<AppConfig>
  saveConfig(config: AppConfig): Promise<{ success: boolean }>
  openInExplorer(path: string): Promise<void>
  openExternal(url: string): Promise<void>
}

declare global {
  interface Window {
    api: AgentForgeAPI
  }
}

export {}
