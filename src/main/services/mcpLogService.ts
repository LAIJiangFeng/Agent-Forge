// MCP Operation Log Service — in-memory log for MCP management operations

export interface McpLogEntry {
  id: number
  timestamp: number
  action: string
  serverName: string
  detail: string
}

let logIdCounter = 0
const MAX_LOGS = 200
const logs: McpLogEntry[] = []

export function addMcpLog(action: string, serverName: string, detail = ''): void {
  logs.unshift({
    id: ++logIdCounter,
    timestamp: Date.now(),
    action,
    serverName,
    detail
  })
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS
  }
}

export function getMcpLogs(): McpLogEntry[] {
  return [...logs]
}

export function clearMcpLogs(): void {
  logs.length = 0
}
