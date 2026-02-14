import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------
export interface McpServer {
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

export interface McpConfigFile {
  path: string
  source: 'user' | 'project'
  sourceLabel: string
  servers: McpServer[]
  rawContent: string
}

// -----------------------------------------------------------
// 解析 MCP 配置文件
// -----------------------------------------------------------
function parseMcpServers(
  config: Record<string, any>,
  configPath: string,
  source: 'user' | 'project',
  sourceLabel: string
): McpServer[] {
  const servers: McpServer[] = []

  // claude.json 格式: { mcpServers: { name: { command, args, ... } } }
  const mcpServers = config.mcpServers || config

  for (const [name, serverConfig] of Object.entries(mcpServers)) {
    if (!serverConfig || typeof serverConfig !== 'object') continue
    const sc = serverConfig as Record<string, any>

    const command = sc.command || ''
    const args = Array.isArray(sc.args) ? sc.args : []
    const env = sc.env && typeof sc.env === 'object' ? sc.env : undefined

    // 自动生成使用样例
    const fullCommand = [command, ...args].join(' ')
    const usageCommand = `mcp: ${name}`

    // 生成描述：如果配置中没有则从命令推断
    let description = sc.description || ''
    if (!description) {
      if (args.some((a: string) => String(a).includes('server-filesystem'))) {
        description = '允许 Claude 访问本地文件系统'
      } else if (args.some((a: string) => String(a).includes('server-github'))) {
        description = 'GitHub 仓库操作工具'
      } else if (
        command.includes('postgres') ||
        args.some((a: string) => String(a).includes('postgres'))
      ) {
        description = 'PostgreSQL 数据库操作'
      } else {
        description = `MCP Server: ${fullCommand.slice(0, 100)}`
      }
    }

    servers.push({
      id: `${configPath}_${name}`.replace(/[\\/:]/g, '_'),
      name,
      command,
      args,
      env,
      description,
      source,
      sourceLabel,
      configPath,
      usageCommand
    })
  }

  return servers
}

// -----------------------------------------------------------
// 在项目目录中查找 .mcp.json
// -----------------------------------------------------------
function findMcpJsonFiles(dir: string, maxDepth = 2, currentDepth = 0): string[] {
  const results: string[] = []
  if (currentDepth > maxDepth || !existsSync(dir)) return results

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'out' || entry === 'dist')
        continue

      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isFile() && entry === '.mcp.json') {
          results.push(fullPath)
        } else if (stat.isDirectory() && currentDepth < maxDepth) {
          results.push(...findMcpJsonFiles(fullPath, maxDepth, currentDepth + 1))
        }
      } catch {
        // 跳过
      }
    }
  } catch {
    // 跳过
  }

  return results
}

// -----------------------------------------------------------
// 公开 API
// -----------------------------------------------------------

/**
 * 扫描所有 MCP 配置
 */
export function scanMcp(config: {
  mcpConfigPaths: string[]
  projectRoots: string[]
}): McpConfigFile[] {
  const configFiles: McpConfigFile[] = []
  const seen = new Set<string>()

  // 1. 扫描用户级 MCP 配置文件 (e.g., ~/.claude.json)
  for (const mcpPath of config.mcpConfigPaths) {
    const resolvedPath = mcpPath.replace(/^~/, homedir())
    if (!existsSync(resolvedPath) || seen.has(resolvedPath)) continue
    seen.add(resolvedPath)

    try {
      const rawContent = readFileSync(resolvedPath, 'utf-8')
      const parsed = JSON.parse(rawContent)
      const servers = parseMcpServers(parsed, resolvedPath, 'user', '用户级')

      configFiles.push({
        path: resolvedPath,
        source: 'user',
        sourceLabel: '用户级',
        servers,
        rawContent
      })
    } catch {
      // JSON 解析失败，跳过
    }
  }

  // 2. 扫描项目级 MCP 配置 (.mcp.json)
  for (const projectRoot of config.projectRoots) {
    const resolvedRoot = projectRoot.replace(/^~/, homedir())
    if (!existsSync(resolvedRoot)) continue

    const mcpFiles = findMcpJsonFiles(resolvedRoot)
    for (const mcpFile of mcpFiles) {
      if (seen.has(mcpFile)) continue
      seen.add(mcpFile)

      try {
        const rawContent = readFileSync(mcpFile, 'utf-8')
        const parsed = JSON.parse(rawContent)
        // .mcp.json 的格式通常直接是 { mcpServers: { ... } }
        const projectName = basename(join(mcpFile, '..'))
        const servers = parseMcpServers(parsed, mcpFile, 'project', `项目: ${projectName}`)

        configFiles.push({
          path: mcpFile,
          source: 'project',
          sourceLabel: `项目: ${projectName}`,
          servers,
          rawContent
        })
      } catch {
        // 跳过
      }
    }
  }

  return configFiles
}

/**
 * 读取指定 MCP 配置文件内容
 */
export function getMcpConfig(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

/**
 * 保存 MCP 配置文件内容
 */
export function saveMcpConfig(filePath: string, content: string): void {
  // 先验证 JSON 是否有效
  JSON.parse(content) // 如果无效会抛出错误
  writeFileSync(filePath, content, 'utf-8')
}
