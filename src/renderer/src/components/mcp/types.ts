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

export interface McpLogEntry {
  id: number
  timestamp: number
  action: string
  serverName: string
  detail: string
}

export interface DxtUserConfigField {
  key: string
  type: string
  title: string
  description: string
  required: boolean
  sensitive: boolean
  defaultValue: string
}

export interface DxtManifestInfo {
  name: string
  version: string
  description: string
  display_name?: string
  author: { name: string }
  server: { type: string; entry_point: string }
  tools?: Array<{ name: string; description?: string }>
}
