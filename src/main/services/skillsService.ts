import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, basename, dirname, relative } from 'path'
import { homedir } from 'os'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------
export interface Skill {
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

// -----------------------------------------------------------
// SKILL.md 解析器
// -----------------------------------------------------------
function parseSkillMd(
  content: string,
  filePath: string,
  source: 'user' | 'project' | 'marketplace',
  sourceLabel: string
): Skill {
  let name = ''
  let description = ''
  let instructions = ''
  let features: string[] = []
  const rawContent = content

  // 1. 解析 YAML frontmatter
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (fmMatch) {
    const frontmatter = fmMatch[1]
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
    if (nameMatch) name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '')
    if (descMatch) description = descMatch[1].trim().replace(/^['"]|['"]$/g, '')
    instructions = content.slice(fmMatch[0].length).trim()
  } else {
    instructions = content.trim()
  }

  // 2. 如果 frontmatter 中没有 name，从目录名或第一个标题提取
  if (!name) {
    const h1Match = instructions.match(/^#\s+(.+)$/m)
    if (h1Match) {
      name = h1Match[1].trim()
    } else {
      name = basename(dirname(filePath))
    }
  }

  // 3. 如果没有 description，从正文第一段提取
  if (!description) {
    const firstPara = instructions.split('\n\n')[0]
    if (firstPara && !firstPara.startsWith('#')) {
      description = firstPara.replace(/\n/g, ' ').slice(0, 200)
    }
  }

  // 4. 提取功能点 — 查找列表项 (- xxx 或 * xxx)
  const listItems = instructions.match(/^[\s]*[-*]\s+(.+)$/gm)
  if (listItems) {
    features = listItems
      .map((item) => item.replace(/^[\s]*[-*]\s+/, '').trim())
      .filter((item) => item.length > 0 && item.length < 200)
      .slice(0, 20)
  }

  // 5. 生成使用命令
  const skillDirName = basename(dirname(filePath))
  const usageCommand = `use skill: ${name || skillDirName}`
  const slashCommand = `/${skillDirName}`

  const id = filePath.replace(/[\\/:]/g, '_')

  return {
    id,
    name,
    description,
    filePath,
    dirPath: dirname(filePath),
    source,
    sourceLabel,
    usageCommand,
    slashCommand,
    features,
    instructions,
    rawContent
  }
}

// -----------------------------------------------------------
// 递归扫描目录查找 SKILL.md
// -----------------------------------------------------------
function findSkillFiles(dir: string, maxDepth = 5, currentDepth = 0): string[] {
  const results: string[] = []
  if (currentDepth > maxDepth || !existsSync(dir)) return results

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      // 跳过 node_modules 等大目录
      if (entry === 'node_modules' || entry === '.git' || entry === 'out' || entry === 'dist')
        continue

      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isFile() && entry === 'SKILL.md') {
          results.push(fullPath)
        } else if (stat.isDirectory()) {
          results.push(...findSkillFiles(fullPath, maxDepth, currentDepth + 1))
        }
      } catch {
        // 跳过无法读取的文件/目录
      }
    }
  } catch {
    // 跳过无法打开的目录
  }

  return results
}

// -----------------------------------------------------------
// 在项目根目录中查找 .claude/skills/ 下的 SKILL.md
// -----------------------------------------------------------
function findProjectSkills(projectRoot: string): string[] {
  const skillsDir = join(projectRoot, '.claude', 'skills')
  if (!existsSync(skillsDir)) return []
  return findSkillFiles(skillsDir, 3)
}

// -----------------------------------------------------------
// 公开 API
// -----------------------------------------------------------

/**
 * 扫描所有已配置路径中的 Skills
 */
export function scanSkills(config: { skillPaths: string[]; projectRoots: string[] }): Skill[] {
  const skills: Skill[] = []
  const seen = new Set<string>()

  // 1. 扫描用户级 Skills 路径（自动识别 marketplace 目录）
  for (const skillPath of config.skillPaths) {
    const resolvedPath = skillPath.replace(/^~/, homedir())
    if (!existsSync(resolvedPath)) continue

    // 判断是否为插件市场目录
    const isMarketplace = resolvedPath.replace(/\\/g, '/').includes('/plugins/marketplaces')
    const scanDepth = isMarketplace ? 6 : 3
    const files = findSkillFiles(resolvedPath, scanDepth)

    for (const file of files) {
      if (seen.has(file)) continue
      seen.add(file)
      try {
        const content = readFileSync(file, 'utf-8')
        if (isMarketplace) {
          // 从路径提取市场名称: .../marketplaces/<marketplace-name>/...
          const relToMarketplace = relative(resolvedPath, file).replace(/\\/g, '/')
          const parts = relToMarketplace.split('/')
          const marketplaceName = parts[0] || '插件市场'
          skills.push(parseSkillMd(content, file, 'marketplace', `市场: ${marketplaceName}`))
        } else {
          skills.push(parseSkillMd(content, file, 'user', '用户级'))
        }
      } catch {
        // 跳过无法读取的文件
      }
    }
  }

  // 2. 扫描项目级 Skills
  for (const projectRoot of config.projectRoots) {
    const resolvedRoot = projectRoot.replace(/^~/, homedir())
    if (!existsSync(resolvedRoot)) continue

    // 直接在项目根目录查找 .claude/skills
    const projectSkillFiles = findProjectSkills(resolvedRoot)
    for (const file of projectSkillFiles) {
      if (seen.has(file)) continue
      seen.add(file)
      try {
        const content = readFileSync(file, 'utf-8')
        const projectName = basename(resolvedRoot)
        skills.push(parseSkillMd(content, file, 'project', `项目: ${projectName}`))
      } catch {
        // 跳过
      }
    }

    // 也扫描子项目
    try {
      const entries = readdirSync(resolvedRoot)
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) continue
        const subDir = join(resolvedRoot, entry)
        try {
          if (statSync(subDir).isDirectory()) {
            const subFiles = findProjectSkills(subDir)
            for (const file of subFiles) {
              if (seen.has(file)) continue
              seen.add(file)
              try {
                const content = readFileSync(file, 'utf-8')
                skills.push(parseSkillMd(content, file, 'project', `项目: ${entry}`))
              } catch {
                // 跳过
              }
            }
          }
        } catch {
          // 跳过
        }
      }
    } catch {
      // 跳过
    }
  }

  return skills
}

/**
 * 读取指定 Skill 文件内容
 */
export function getSkillContent(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

/**
 * 保存 Skill 文件内容
 */
export function saveSkillContent(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf-8')
}
