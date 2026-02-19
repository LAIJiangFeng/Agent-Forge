import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, normalize, resolve, sep } from 'path'
import { homedir } from 'os'

// ====== Types ======

export interface DxtManifest {
  manifest_version: string
  name: string
  version: string
  description: string
  display_name?: string
  author: { name: string; email?: string; url?: string }
  icon?: string
  server: {
    type: 'node' | 'python' | 'binary' | 'uv'
    entry_point: string
    mcp_config?: {
      command: string
      args?: string[]
      env?: Record<string, string>
    }
  }
  user_config?: Record<
    string,
    {
      type: string
      title?: string
      description?: string
      default?: string
      required?: boolean
      sensitive?: boolean
    }
  >
  tools?: Array<{ name: string; description?: string }>
}

export interface DxtParseResult {
  manifest: DxtManifest
  hasUserConfig: boolean
  userConfigFields: Array<{
    key: string
    type: string
    title: string
    description: string
    required: boolean
    sensitive: boolean
    defaultValue: string
  }>
}

const SAFE_SERVER_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/
const MAX_DXT_ENTRY_COUNT = 3000
const MAX_DXT_SINGLE_ENTRY_BYTES = 50 * 1024 * 1024
const MAX_DXT_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeForCompare(inputPath: string): string {
  const normalizedPath = normalize(resolve(inputPath))
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
}

function isPathWithin(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalizeForCompare(basePath)
  const normalizedTarget = normalizeForCompare(targetPath)
  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}${sep}`)
}

function sanitizeServerName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new Error('manifest.name 必须是字符串')
  }

  const trimmedName = name.trim()
  if (!SAFE_SERVER_NAME_PATTERN.test(trimmedName)) {
    throw new Error('manifest.name 含有非法字符，仅允许字母、数字、点、下划线、短横线')
  }

  return trimmedName
}

function stripJsonComments(content: string): string {
  let output = ''
  let inString = false
  let escaped = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < content.length; i++) {
    const current = content[i]
    const next = content[i + 1]

    if (inLineComment) {
      if (current === '\n') {
        inLineComment = false
        output += current
      }
      continue
    }

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }

    if (inString) {
      output += current
      if (escaped) {
        escaped = false
      } else if (current === '\\') {
        escaped = true
      } else if (current === '"') {
        inString = false
      }
      continue
    }

    if (current === '"') {
      inString = true
      output += current
      continue
    }

    if (current === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }

    if (current === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }

    output += current
  }

  return output
}

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').trim()
}

function assertSafeArchiveEntries(zip: AdmZip): void {
  const entries = zip.getEntries()

  if (entries.length === 0) {
    throw new Error('DXT 包为空')
  }
  if (entries.length > MAX_DXT_ENTRY_COUNT) {
    throw new Error(`DXT 条目数量超限（>${MAX_DXT_ENTRY_COUNT}）`)
  }

  let totalUncompressedBytes = 0

  for (const entry of entries) {
    const normalizedEntryName = normalizeZipEntryName(entry.entryName)
    if (!normalizedEntryName || normalizedEntryName.includes('\0')) {
      throw new Error('DXT 包含非法文件路径')
    }
    if (normalizedEntryName.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedEntryName)) {
      throw new Error(`DXT 包含绝对路径条目: ${normalizedEntryName}`)
    }

    const pathSegments = normalizedEntryName.split('/').filter((segment) => segment.length > 0)
    if (pathSegments.some((segment) => segment === '..')) {
      throw new Error(`DXT 包含路径穿越条目: ${normalizedEntryName}`)
    }

    if (entry.isDirectory) continue

    const entrySize = Number.isFinite(entry.header.size) && entry.header.size > 0 ? entry.header.size : 0
    if (entrySize > MAX_DXT_SINGLE_ENTRY_BYTES) {
      throw new Error(`DXT 条目过大: ${normalizedEntryName}`)
    }

    totalUncompressedBytes += entrySize
    if (totalUncompressedBytes > MAX_DXT_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(`DXT 解压总大小超限（>${MAX_DXT_TOTAL_UNCOMPRESSED_BYTES}）`)
    }
  }
}

// ====== Parse ======

export function parseDxtFile(filePath: string): DxtParseResult {
  const zip = new AdmZip(filePath)
  assertSafeArchiveEntries(zip)
  const manifestEntry = zip.getEntry('manifest.json')
  if (!manifestEntry) {
    throw new Error('DXT 文件中未找到 manifest.json')
  }

  const manifestStr = manifestEntry.getData().toString('utf-8')
  const cleaned = stripJsonComments(manifestStr)
  const manifest = JSON.parse(cleaned) as unknown

  if (!isRecord(manifest)) {
    throw new Error('manifest.json 结构无效')
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim() || !isRecord(manifest.server)) {
    throw new Error('manifest.json 缺少必要字段 (name, server)')
  }

  const typedManifest = manifest as unknown as DxtManifest

  const hasUserConfig =
    !!typedManifest.user_config && Object.keys(typedManifest.user_config).length > 0
  const userConfigFields = hasUserConfig
    ? Object.entries(typedManifest.user_config!).map(([key, cfg]) => ({
        key,
        type: cfg.type || 'string',
        title: cfg.title || key,
        description: cfg.description || '',
        required: cfg.required ?? false,
        sensitive: cfg.sensitive ?? false,
        defaultValue: cfg.default || ''
      }))
    : []

  return { manifest: typedManifest, hasUserConfig, userConfigFields }
}

// ====== Install ======

export function installDxt(
  filePath: string,
  configPath: string,
  userConfigValues?: Record<string, string>
): { serverName: string; installDir: string } {
  const { manifest } = parseDxtFile(filePath)
  const serverName = sanitizeServerName(manifest.name)

  // Extract to ~/.claude/extensions/<name>/
  const extensionsDir = join(homedir(), '.claude', 'extensions')
  const installDir = resolve(extensionsDir, serverName)
  if (!isPathWithin(extensionsDir, installDir)) {
    throw new Error('安装路径非法')
  }

  if (!existsSync(extensionsDir)) {
    mkdirSync(extensionsDir, { recursive: true })
  }

  const zip = new AdmZip(filePath)
  assertSafeArchiveEntries(zip)
  zip.extractAllTo(installDir, true)

  // Build mcp_config with variable substitution
  const mcpConfig = manifest.server.mcp_config
  if (!mcpConfig || typeof mcpConfig.command !== 'string' || !mcpConfig.command.trim()) {
    throw new Error('manifest 中没有 mcp_config，无法生成 MCP 服务配置')
  }

  const substituteVars = (str: string): string => {
    return str
      .replace(/\$\{__dirname\}/g, installDir)
      .replace(/\$\{HOME\}/g, homedir())
      .replace(/\$\{DESKTOP\}/g, join(homedir(), 'Desktop'))
      .replace(/\$\{DOCUMENTS\}/g, join(homedir(), 'Documents'))
      .replace(/\$\{DOWNLOADS\}/g, join(homedir(), 'Downloads'))
      .replace(/\$\{pathSeparator\}/g, sep)
      .replace(/\$\{\/\}/g, sep)
      .replace(/\$\{user_config\.([^}]+)\}/g, (_match, key) => {
        return userConfigValues?.[key] || ''
      })
  }

  const resolvedCommand = substituteVars(mcpConfig.command)
  const resolvedArgs = (mcpConfig.args || []).map(substituteVars)
  const resolvedEnv: Record<string, string> = {}
  if (mcpConfig.env) {
    for (const [k, v] of Object.entries(mcpConfig.env)) {
      resolvedEnv[k] = substituteVars(v)
    }
  }

  // Write to config file
  const raw = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : '{}'
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('MCP 配置文件格式无效')
  }

  if (!isRecord(parsed.mcpServers)) {
    parsed.mcpServers = {}
  }

  const serverEntry: Record<string, unknown> = {
    command: resolvedCommand,
    args: resolvedArgs
  }
  if (Object.keys(resolvedEnv).length > 0) {
    serverEntry.env = resolvedEnv
  }

  ;(parsed.mcpServers as Record<string, unknown>)[serverName] = serverEntry
  writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8')

  return { serverName, installDir }
}
