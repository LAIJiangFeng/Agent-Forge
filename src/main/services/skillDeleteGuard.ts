import { existsSync, lstatSync, realpathSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join, normalize, relative, resolve, sep } from 'path'

export interface SkillDeleteGuardConfig {
  skillScanPaths: string[]
  projectRoots: string[]
}

// -----------------------------------------------------------
// 路径工具函数
// -----------------------------------------------------------

/** 仅匹配 ~ 或 ~/ 开头，避免 ~abc 被错误展开 */
function expandHomePath(inputPath: string): string {
  return inputPath.replace(/^~(?=$|[/\\])/, homedir())
}

function resolveCanonicalPath(inputPath: string): string {
  const resolvedPath = resolve(inputPath)
  try {
    return realpathSync.native(resolvedPath)
  } catch {
    // 目标路径不存在时，规范化父目录以保持符号链接检查有效
    try {
      const realParentPath = realpathSync.native(dirname(resolvedPath))
      return join(realParentPath, basename(resolvedPath))
    } catch {
      return resolvedPath
    }
  }
}

function normalizeForCompare(inputPath: string): string {
  const normalizedPath = normalize(resolveCanonicalPath(inputPath))
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
}

function isPathWithin(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalizeForCompare(basePath)
  const normalizedTarget = normalizeForCompare(targetPath)
  return (
    normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}${sep}`)
  )
}

// -----------------------------------------------------------
// 共享路径授权逻辑（读/写/删共用）
// -----------------------------------------------------------

/**
 * 检查技能文件路径是否在允许的范围内。
 * 与 index.ts 中 isAllowedSkillFile 使用同一套规则：
 * 1. 用户级技能扫描路径
 * 2. 项目根目录 — 根目录或其子目录下的 .claude/skills/
 *
 * 此函数同时被 index.ts 的 isAllowedSkillFile 和删除守卫调用，
 * 确保权限逻辑不会因独立实现而产生漂移。
 */
export function isSkillFileWithinScope(
  filePath: string,
  skillScanPaths: string[],
  projectRoots: string[]
): boolean {
  // 文件名必须是 SKILL.md
  if (basename(filePath).toLowerCase() !== 'skill.md') return false

  // 1. 检查用户级技能扫描路径
  for (const skillPath of skillScanPaths) {
    if (isPathWithin(expandHomePath(skillPath), filePath)) return true
  }

  // 2. 检查项目根目录
  for (const projectRoot of projectRoots) {
    const resolvedRoot = expandHomePath(projectRoot)
    if (!isPathWithin(resolvedRoot, filePath)) continue

    const relPath = relative(resolvedRoot, filePath).replace(/\\/g, '/')
    if (/(^|\/)\.claude\/skills\/(?:.+\/)?SKILL\.md$/i.test(relPath)) return true
  }

  return false
}

// -----------------------------------------------------------
// 删除守卫
// -----------------------------------------------------------

/**
 * 收集所有禁止删除的根目录列表。
 * 包括技能扫描根目录、项目根目录、以及项目级 .claude/skills 根目录。
 */
function getProtectedRoots(config: SkillDeleteGuardConfig): string[] {
  const roots: string[] = []

  // 技能扫描根目录
  for (const p of config.skillScanPaths) {
    roots.push(normalizeForCompare(expandHomePath(p)))
  }

  // 项目根目录及其 .claude/skills 根目录
  for (const p of config.projectRoots) {
    const expanded = expandHomePath(p)
    roots.push(normalizeForCompare(expanded))
    roots.push(normalizeForCompare(join(expanded, '.claude')))
    roots.push(normalizeForCompare(join(expanded, '.claude', 'skills')))
  }

  return roots
}

/**
 * 校验技能文件路径并返回安全的待删除目录。
 *
 * 安全约束：
 * 1. 文件名必须是 SKILL.md
 * 2. 文件必须存在且是普通文件
 * 3. 文件必须在允许的技能范围内
 * 4. 待删除目录必须是独立技能子目录，禁止删除扫描根目录/项目根目录/skills 根目录
 * 5. 待删除目录不能是符号链接或目录联接点（防止链接类型绕过）
 * 6. 使用 canonical path 确保路径一致性
 */
export function resolveSkillDeleteDir(filePath: string, config: SkillDeleteGuardConfig): string {
  const resolvedFilePath = resolve(filePath)

  // 1. 文件名校验
  if (basename(resolvedFilePath).toLowerCase() !== 'skill.md') {
    throw new Error('拒绝访问：无效的技能文件路径')
  }

  // 2. 文件存在性和类型校验（防止伪造路径）
  if (!existsSync(resolvedFilePath)) {
    throw new Error('拒绝访问：技能文件不存在')
  }
  try {
    const fileStat = lstatSync(resolvedFilePath)
    if (!fileStat.isFile()) {
      throw new Error('拒绝访问：技能路径不是普通文件')
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('拒绝访问')) throw err
    throw new Error('拒绝访问：无法验证技能文件状态')
  }

  // 3. 范围校验
  if (!isSkillFileWithinScope(resolvedFilePath, config.skillScanPaths, config.projectRoots)) {
    throw new Error('拒绝访问：技能文件不在允许的范围内')
  }

  // 4. 获取 canonical 目录路径（消除符号链接影响）
  const canonicalDirPath = normalizeForCompare(dirname(resolvedFilePath))

  // 5. 最小删除单元约束：禁止删除受保护的根目录
  const protectedRoots = getProtectedRoots(config)
  if (protectedRoots.includes(canonicalDirPath)) {
    throw new Error('拒绝删除：目标是受保护的根目录，如需删除请进入子目录操作')
  }

  // 6. 符号链接/联接点检查：拒绝删除链接目录（防止链接类型绕过）
  const dirToDelete = resolve(dirname(resolvedFilePath))
  try {
    const stat = lstatSync(dirToDelete)
    if (stat.isSymbolicLink()) {
      throw new Error('拒绝删除：目标目录是符号链接')
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('拒绝删除')) throw err
    throw new Error('拒绝删除：无法验证目标目录状态')
  }

  return dirToDelete
}
