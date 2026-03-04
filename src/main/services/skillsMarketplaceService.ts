import { net } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ====== Types ======

export interface MarketplaceSkill {
  name: string
  description: string
  author: string
  github_url: string
  stars: number
  tags: string[]
  updated_at: string
  raw_url?: string
  content?: string
}

export interface MarketplaceSearchResult {
  success: boolean
  skills: MarketplaceSkill[]
  total: number
  page: number
  limit: number
}

// ====== Constants ======

const API_BASE = 'https://skillsmp.com/api/v1'

// ====== Helpers ======

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeGithubUrl(raw: Record<string, unknown>): string {
  const direct = [
    raw.github_url,
    raw.githubUrl,
    raw.repository_url,
    raw.repositoryUrl,
    raw.repo_url,
    raw.repoUrl,
    raw.html_url,
    raw.htmlUrl,
    raw.url
  ]
    .map((v) => asString(v).trim())
    .find((v) => v.startsWith('https://github.com/'))

  if (direct) return direct

  const owner = asString(raw.owner).trim()
  const repo = asString(raw.repo).trim()
  if (owner && repo) return `https://github.com/${owner}/${repo}`

  const fullName = asString(raw.full_name).trim()
  if (fullName && fullName.includes('/')) return `https://github.com/${fullName}`

  return ''
}

function unwrapSkillPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const nestedCandidates: unknown[] = [
    raw.skill,
    raw.item,
    raw.source,
    raw._source,
    raw.payload,
    raw.data
  ]

  for (const candidate of nestedCandidates) {
    if (isRecord(candidate)) return { ...candidate, ...raw }
  }

  return raw
}

function normalizeMarketplaceSkill(raw: unknown): MarketplaceSkill | null {
  if (!isRecord(raw)) return null

  const payload = unwrapSkillPayload(raw)
  const name = asString(
    payload.name ||
      payload.title ||
      payload.skill_name ||
      payload.skillName ||
      payload.slug ||
      payload.repo ||
      payload.full_name
  ).trim()

  const authorValue = payload.author || payload.owner || payload.creator
  const author = isRecord(authorValue)
    ? asString(
        authorValue.name || authorValue.login || authorValue.username || authorValue.handle
      ).trim()
    : asString(authorValue).trim()

  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((t) => asString(t).trim()).filter(Boolean)
    : Array.isArray(payload.categories)
      ? payload.categories.map((t) => asString(t).trim()).filter(Boolean)
      : typeof payload.tags === 'string'
        ? payload.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : []

  const metricValue = payload.metrics
  const metrics = isRecord(metricValue) ? metricValue : {}
  const githubUrl = normalizeGithubUrl(payload)

  const finalName =
    name ||
    (githubUrl.startsWith('https://github.com/')
      ? githubUrl.replace('https://github.com/', '')
      : '')
  if (!finalName) return null

  return {
    name: finalName,
    description: asString(payload.description || payload.summary || payload.excerpt).trim(),
    author: author || 'unknown',
    github_url: githubUrl,
    stars: asNumber(
      payload.stars ??
        payload.star_count ??
        payload.starCount ??
        payload.stargazers_count ??
        metrics.stars ??
        metrics.star_count,
      0
    ),
    tags,
    updated_at: asString(
      payload.updated_at ||
        payload.updatedAt ||
        payload.pushed_at ||
        payload.pushedAt ||
        payload.created_at ||
        payload.createdAt
    ).trim(),
    raw_url: asString(payload.raw_url || payload.rawUrl).trim() || undefined,
    content: asString(payload.content).trim() || undefined
  }
}

function normalizeMarketplaceResult(
  raw: unknown,
  fallbackPage: number,
  fallbackLimit: number
): MarketplaceSearchResult {
  const root = isRecord(raw) ? raw : {}
  if (root.success === false) {
    const errorObj = isRecord(root.error) ? root.error : {}
    const message = asString(errorObj.message || root.message).trim()
    throw new Error(message || 'SkillsMP API returned success=false')
  }

  const rootData = root.data
  const data = isRecord(rootData) ? rootData : {}
  const dataDataValue = data.data
  const dataData = isRecord(dataDataValue) ? dataDataValue : {}

  const candidateArrays: Array<{ source: string; value: unknown }> = [
    { source: 'root.skills', value: root.skills },
    { source: 'root.results', value: root.results },
    { source: 'root.items', value: root.items },
    { source: 'root.records', value: root.records },
    { source: 'data.skills', value: data.skills },
    { source: 'data.results', value: data.results },
    { source: 'data.items', value: data.items },
    { source: 'data.records', value: data.records },
    { source: 'data.data', value: Array.isArray(dataDataValue) ? dataDataValue : null },
    { source: 'data.data.skills', value: dataData.skills },
    { source: 'data.data.results', value: dataData.results },
    { source: 'data.data.items', value: dataData.items },
    { source: 'data.data.records', value: dataData.records },
    { source: 'root.data[]', value: Array.isArray(rootData) ? rootData : null }
  ]
  const rawSkills = candidateArrays.find((c) => Array.isArray(c.value))?.value
  const skills = Array.isArray(rawSkills)
    ? rawSkills
        .map((item) => normalizeMarketplaceSkill(item))
        .filter((v): v is MarketplaceSkill => !!v)
    : []

  const pagination = isRecord(root.pagination)
    ? root.pagination
    : isRecord(data.pagination)
      ? data.pagination
      : {}
  const meta = isRecord(root.meta) ? root.meta : isRecord(data.meta) ? data.meta : {}

  const total = asNumber(
    root.total ??
      root.count ??
      root.total_count ??
      root.totalCount ??
      data.total ??
      data.count ??
      data.total_count ??
      data.totalCount ??
      dataData.total ??
      dataData.count ??
      dataData.total_count ??
      dataData.totalCount ??
      pagination.total ??
      pagination.count ??
      meta.total ??
      meta.count,
    skills.length
  )
  const page = asNumber(
    root.page ??
      data.page ??
      data.current_page ??
      data.currentPage ??
      dataData.page ??
      dataData.current_page ??
      dataData.currentPage ??
      pagination.page ??
      meta.page,
    fallbackPage
  )
  const limit = asNumber(
    root.limit ??
      data.limit ??
      data.page_size ??
      data.pageSize ??
      data.per_page ??
      data.perPage ??
      dataData.limit ??
      dataData.page_size ??
      dataData.pageSize ??
      dataData.per_page ??
      dataData.perPage ??
      pagination.limit ??
      meta.limit,
    fallbackLimit
  )
  const success = typeof root.success === 'boolean' ? root.success : true

  return {
    success,
    skills,
    total: Math.max(total, skills.length),
    page: Math.max(1, page),
    limit: Math.max(1, limit)
  }
}

/**
 * 将 GitHub 仓库 URL 转换为 raw 内容 URL
 * 例如: https://github.com/user/repo → https://raw.githubusercontent.com/user/repo/main/SKILL.md
 */
function githubToRawUrl(githubUrl: string, filePath = 'SKILL.md'): string {
  const cleaned = githubUrl.replace(/\/$/, '').replace(/\.git$/, '')
  const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/)
  if (!match) throw new Error(`Invalid GitHub URL: ${githubUrl}`)

  const owner = match[1]
  const repo = match[2]
  const branch = match[3] || 'main'
  const subPath = match[4] || ''

  const fullPath = subPath ? `${subPath}/${filePath}` : filePath
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fullPath}`
}

/**
 * 用 net.fetch 发起 GET 请求并返回 JSON
 */
async function apiFetch<T>(url: string, apiKey: string): Promise<T> {
  const normalizedApiKey = apiKey.trim()
  if (!normalizedApiKey) {
    throw new Error('SkillsMP API Key is required')
  }

  const response = await net.fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${normalizedApiKey}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-daily-remaining')
    const limit = response.headers.get('x-ratelimit-daily-limit')
    const quotaHint = remaining ? ` (daily remaining: ${remaining}/${limit || '500'})` : ''

    let errorCode = ''
    let errorMessage = ''
    try {
      const payload = (await response.json()) as {
        error?: {
          code?: string
          message?: string
        }
      }
      errorCode = payload?.error?.code || ''
      errorMessage = payload?.error?.message || ''
    } catch {
      // ignore json parse error
    }

    if (
      errorCode === 'MISSING_API_KEY' ||
      errorCode === 'INVALID_API_KEY' ||
      response.status === 401
    ) {
      throw new Error(`SkillsMP API Key invalid or missing${quotaHint}`)
    }
    if (errorCode === 'MISSING_QUERY' || response.status === 400) {
      throw new Error(`Missing required query parameter q${quotaHint}`)
    }
    if (errorCode === 'DAILY_QUOTA_EXCEEDED' || response.status === 429) {
      throw new Error(`SkillsMP daily quota exceeded (500 requests/day, UTC reset)${quotaHint}`)
    }

    if (errorMessage) {
      throw new Error(`SkillsMP API error (${response.status}): ${errorMessage}${quotaHint}`)
    }
    throw new Error(`SkillsMP API request failed (${response.status})${quotaHint}`)
  }

  return (await response.json()) as T
}

/**
 * 用 net.fetch 下载文本文件
 */
async function fetchText(url: string): Promise<string> {
  const response = await net.fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`)
  }
  return await response.text()
}

// ====== Public API ======

/**
 * 关键字搜索技能
 */
export async function searchMarketplaceSkills(
  apiKey: string,
  query: string,
  page = 1,
  limit = 20,
  sortBy: 'stars' | 'recent' = 'stars'
): Promise<MarketplaceSearchResult> {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    throw new Error('Search query is required')
  }
  if (normalizedQuery.includes('*')) {
    throw new Error('Wildcard (*) search is not supported by SkillsMP API')
  }

  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 20

  const params = new URLSearchParams({
    q: normalizedQuery,
    page: String(safePage),
    limit: String(safeLimit),
    sortBy
  })

  const requestWithParams = async (
    customParams: URLSearchParams
  ): Promise<MarketplaceSearchResult> => {
    const raw = await apiFetch<unknown>(
      `${API_BASE}/skills/search?${customParams.toString()}`,
      apiKey
    )
    return normalizeMarketplaceResult(raw, safePage, safeLimit)
  }

  let normalized: MarketplaceSearchResult | null = null
  let primaryError: unknown = null

  try {
    normalized = await requestWithParams(params)
  } catch (err) {
    primaryError = err
  }

  // Retry without sorting when primary failed or returned empty list with non-zero total.
  if (!normalized || (normalized.skills.length === 0 && normalized.total > 0)) {
    try {
      const noSortParams = new URLSearchParams({
        q: normalizedQuery,
        page: String(safePage),
        limit: String(safeLimit)
      })
      const retried = await requestWithParams(noSortParams)
      if (!normalized || retried.skills.length > 0) {
        normalized = retried
      }
    } catch {
      // ignore retry errors and continue to semantic fallback
    }
  }

  // Last fallback: semantic search endpoint.
  if (!normalized || (normalized.skills.length === 0 && normalized.total > 0)) {
    try {
      const aiParams = new URLSearchParams({ q: normalizedQuery })
      const aiRaw = await apiFetch<unknown>(
        `${API_BASE}/skills/ai-search?${aiParams.toString()}`,
        apiKey
      )
      const aiNormalized = normalizeMarketplaceResult(aiRaw, 1, safeLimit)
      if (!normalized || aiNormalized.skills.length > 0) {
        normalized = {
          ...aiNormalized,
          page: 1,
          limit: safeLimit
        }
      }
    } catch {
      // keep primary search result
    }
  }

  if (!normalized) {
    throw primaryError instanceof Error ? primaryError : new Error('SkillsMP search failed')
  }

  return normalized
}

/**
 * AI 语义搜索
 */
export async function aiSearchMarketplaceSkills(
  apiKey: string,
  query: string
): Promise<MarketplaceSearchResult> {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    throw new Error('Search query is required')
  }
  if (normalizedQuery.includes('*')) {
    throw new Error('Wildcard (*) search is not supported by SkillsMP API')
  }

  const params = new URLSearchParams({ q: normalizedQuery })

  const raw = await apiFetch<unknown>(`${API_BASE}/skills/ai-search?${params.toString()}`, apiKey)
  return normalizeMarketplaceResult(raw, 1, 20)
}

/**
 * 安装一个市场技能到本地
 * 从 GitHub 下载 SKILL.md，写入 ~/.claude/skills/<name>/SKILL.md
 */
export async function installMarketplaceSkill(
  skillName: string,
  githubUrl: string
): Promise<{ installDir: string; skillName: string }> {
  // 1. 规范化目录名
  const safeName = skillName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  if (!safeName) throw new Error('Invalid skill name')

  const installDir = join(homedir(), '.claude', 'skills', safeName)

  // 2. 如果目录已存在，提示已安装
  if (existsSync(join(installDir, 'SKILL.md'))) {
    throw new Error(`技能 "${skillName}" 已存在，请先删除后再安装`)
  }

  // 3. 下载 SKILL.md
  const rawUrl = githubToRawUrl(githubUrl)
  let content: string
  try {
    content = await fetchText(rawUrl)
  } catch {
    // 如果 main 分支失败，尝试 master
    const masterUrl = rawUrl.replace('/main/', '/master/')
    content = await fetchText(masterUrl)
  }

  if (!content || content.length < 10) {
    throw new Error('Downloaded SKILL.md is empty or too short')
  }

  // 4. 创建目录并写入文件
  mkdirSync(installDir, { recursive: true })
  writeFileSync(join(installDir, 'SKILL.md'), content, 'utf-8')

  return { installDir, skillName: safeName }
}
