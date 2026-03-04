import { realpathSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join, normalize, relative, resolve, sep } from 'path'

export interface SkillDeleteGuardConfig {
  skillScanPaths: string[]
  projectRoots: string[]
}

function expandHomePath(inputPath: string): string {
  return inputPath.replace(/^~/, homedir())
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

/**
 * 检查技能文件路径是否在允许删除的范围内。
 * 与 index.ts 中 isAllowedSkillFile 逻辑保持一致：
 * 1. 用户级技能扫描路径
 * 2. 项目根目录 — 根目录或其子目录下的 .claude/skills/
 */
function isFileWithinAllowedScope(filePath: string, config: SkillDeleteGuardConfig): boolean {
  // 1. 检查用户级技能扫描路径
  for (const skillPath of config.skillScanPaths) {
    if (isPathWithin(expandHomePath(skillPath), filePath)) return true
  }

  // 2. 检查项目根目录 — 技能可能在 projectRoot/.claude/skills 或 projectRoot/子目录/.claude/skills 下
  for (const projectRoot of config.projectRoots) {
    const resolvedRoot = expandHomePath(projectRoot)
    if (!isPathWithin(resolvedRoot, filePath)) continue

    const relPath = relative(resolvedRoot, filePath).replace(/\\/g, '/')
    if (/(^|\/)\.claude\/skills\/(?:.+\/)?SKILL\.md$/i.test(relPath)) return true
  }

  return false
}

export function resolveSkillDeleteDir(filePath: string, config: SkillDeleteGuardConfig): string {
  const resolvedFilePath = resolve(filePath)
  if (basename(resolvedFilePath).toLowerCase() !== 'skill.md') {
    throw new Error('Access denied: invalid skill file path')
  }

  const resolvedDirPath = resolve(dirname(resolvedFilePath))

  if (!isFileWithinAllowedScope(resolvedFilePath, config)) {
    throw new Error('Access denied: skill file is outside configured scope')
  }

  return resolvedDirPath
}

