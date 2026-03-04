<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Editor } from '@guolao/vue-monaco-editor'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{
  initialSkillId?: string
}>()

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

// Markdown 渲染工具（含 XSS 防护）
function renderMd(text: string): string {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text) as string)
}

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

interface TranslatedContent {
  description: string
  instructions: string
  features: string[]
}

interface MarketplaceSkill {
  name: string
  description: string
  author: string
  github_url: string
  stars: number
  tags: string[]
  updated_at: string
}

const skills = ref<Skill[]>([])
const selectedSkill = ref<Skill | null>(null)
const isEditing = ref(false)
const editValue = ref('')
const searchQuery = ref('')
const loading = ref(true)
const saveStatus = ref<'idle' | 'saving' | 'success' | 'error'>('idle')
const copyStatus = ref<Record<string, boolean>>({})
const showDeleteConfirm = ref(false)
const deleteStatus = ref<'idle' | 'deleting' | 'error'>('idle')
const deleteError = ref('')
const showMarketplaceModal = ref(false)
const marketplaceQuery = ref('')
const marketplaceSortBy = ref<'stars' | 'recent'>('stars')
const marketplaceLoading = ref(false)
const marketplaceError = ref('')
const marketplaceResults = ref<MarketplaceSkill[]>([])
const marketplacePage = ref(1)
const marketplaceTotal = ref(0)
const marketplaceHasSearched = ref(false)
const marketplaceInstallState = ref<Record<string, 'idle' | 'installing' | 'success' | 'error'>>(
  {}
)
const marketplaceInstallError = ref('')
const marketplaceInstallMessage = ref('')
const MARKETPLACE_PAGE_SIZE = 12

// 翻译状态
const translatedCache = ref<Record<string, TranslatedContent>>({})
const translating = ref(false)
const showOriginal = ref(false)

// 当前显示的翻译后内容
const displayDescription = computed(() => {
  if (!selectedSkill.value) return ''
  if (showOriginal.value) return selectedSkill.value.description
  const t = translatedCache.value[selectedSkill.value.id]
  return t?.description || selectedSkill.value.description
})

const displayInstructions = computed(() => {
  if (!selectedSkill.value) return ''
  if (showOriginal.value) return selectedSkill.value.instructions
  const t = translatedCache.value[selectedSkill.value.id]
  return t?.instructions || selectedSkill.value.instructions
})

const displayFeatures = computed(() => {
  if (!selectedSkill.value) return []
  if (showOriginal.value) return selectedSkill.value.features
  const t = translatedCache.value[selectedSkill.value.id]
  return t?.features || selectedSkill.value.features
})

const hasTranslation = computed(() => {
  if (!selectedSkill.value) return false
  return !!translatedCache.value[selectedSkill.value.id]
})

const marketplaceTotalPages = computed(() => {
  return Math.max(1, Math.ceil(marketplaceTotal.value / MARKETPLACE_PAGE_SIZE))
})

// 搜索过滤
const filteredSkills = computed(() => {
  if (!searchQuery.value) return skills.value
  const q = searchQuery.value.toLowerCase()
  return skills.value.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.sourceLabel.toLowerCase().includes(q)
  )
})

const formatError = (err: unknown): string => {
  if (err instanceof Error) return err.message
  return String(err || 'Unknown error')
}

const normalizeInstallName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

const marketplaceKey = (skill: MarketplaceSkill): string => `${skill.name}::${skill.github_url}`

const isMarketplaceInstalled = (skill: MarketplaceSkill): boolean => {
  const normalized = normalizeInstallName(skill.name)
  if (!normalized) return false
  const suffix = `/${normalized}/skill.md`
  return skills.value.some((s) => s.filePath.replace(/\\/g, '/').toLowerCase().endsWith(suffix))
}

// 加载 Skills
const loadSkills = async () => {
  loading.value = true
  try {
    const prevSelectedId = selectedSkill.value?.id
    skills.value = await window.api.scanSkills()
    if (skills.value.length === 0) {
      selectedSkill.value = null
    } else if (props.initialSkillId) {
      // Deep-link from dashboard: select the specific skill
      selectedSkill.value = skills.value.find((s) => s.id === props.initialSkillId) || skills.value[0]
    } else if (prevSelectedId) {
      selectedSkill.value = skills.value.find((s) => s.id === prevSelectedId) || skills.value[0]
    } else if (!selectedSkill.value) {
      selectedSkill.value = skills.value[0]
    }
  } catch (err) {
    console.error('Failed to scan skills:', err)
  } finally {
    loading.value = false
  }
}

const openMarketplaceModal = () => {
  showMarketplaceModal.value = true
}

const closeMarketplaceModal = () => {
  showMarketplaceModal.value = false
}

const searchMarketplace = async (page = 1) => {
  const query = marketplaceQuery.value.trim()
  if (!query) {
    marketplaceResults.value = []
    marketplaceTotal.value = 0
    marketplacePage.value = 1
    marketplaceHasSearched.value = false
    marketplaceError.value = ''
    return
  }

  marketplaceLoading.value = true
  marketplaceError.value = ''
  marketplaceInstallMessage.value = ''
  marketplaceInstallError.value = ''
  marketplaceHasSearched.value = true
  const targetPage = Math.max(1, page)

  try {
    const result = await window.api.searchMarketplace(
      query,
      targetPage,
      MARKETPLACE_PAGE_SIZE,
      marketplaceSortBy.value
    )
    marketplaceResults.value = result.skills || []
    marketplaceTotal.value = Math.max(0, Number(result.total) || 0)
    marketplacePage.value = Math.max(1, Number(result.page) || targetPage)
  } catch (err) {
    marketplaceResults.value = []
    marketplaceTotal.value = 0
    marketplacePage.value = 1
    marketplaceError.value = formatError(err)
  } finally {
    marketplaceLoading.value = false
  }
}

const triggerMarketplaceSearch = () => {
  marketplacePage.value = 1
  void searchMarketplace(1)
}

const changeMarketplacePage = (nextPage: number) => {
  if (nextPage < 1 || nextPage > marketplaceTotalPages.value) return
  void searchMarketplace(nextPage)
}

const installMarketplace = async (marketSkill: MarketplaceSkill) => {
  const key = marketplaceKey(marketSkill)
  if (marketplaceInstallState.value[key] === 'installing') return

  marketplaceInstallState.value[key] = 'installing'
  marketplaceInstallMessage.value = ''
  marketplaceInstallError.value = ''
  marketplaceError.value = ''

  try {
    const result = await window.api.installMarketplaceSkill(marketSkill.name, marketSkill.github_url)
    await loadSkills()

    const suffix = `/${result.skillName.toLowerCase()}/skill.md`
    const installed = skills.value.find((s) =>
      s.filePath.replace(/\\/g, '/').toLowerCase().endsWith(suffix)
    )
    if (installed) selectSkill(installed)

    marketplaceInstallState.value[key] = 'success'
    marketplaceInstallMessage.value = `安装成功: ${result.skillName}`
  } catch (err) {
    marketplaceInstallState.value[key] = 'error'
    marketplaceInstallError.value = formatError(err)
  } finally {
    setTimeout(() => {
      if (marketplaceInstallState.value[key] === 'success') {
        marketplaceInstallState.value[key] = 'idle'
      }
    }, 2000)
  }
}

// 手动翻译
const doTranslate = async () => {
  if (!selectedSkill.value) return
  if (translatedCache.value[selectedSkill.value.id]) {
    // 已有翻译，直接切换到翻译视图
    showOriginal.value = false
    return
  }
  translating.value = true
  try {
    const skill = selectedSkill.value
    const skillId = skill.id
    const desc = String(skill.description || '')
    const inst = String(skill.instructions || '')
    const feats = [...skill.features].map(String)
    const result = await window.api.translateSkillContent(desc, inst, feats)
    translatedCache.value[skillId] = result
    showOriginal.value = false
  } catch (err) {
    console.error('Translation failed:', err)
  } finally {
    translating.value = false
  }
}

// 选中 Skill
const selectSkill = (skill: Skill) => {
  selectedSkill.value = skill
  isEditing.value = false
  saveStatus.value = 'idle'
  showOriginal.value = true
}

// 切换编辑模式
const toggleEdit = async () => {
  if (isEditing.value) {
    isEditing.value = false
    return
  }
  if (!selectedSkill.value) return
  try {
    const content = await window.api.getSkillContent(selectedSkill.value.filePath)
    editValue.value = content
    isEditing.value = true
  } catch (err) {
    console.error('Failed to load skill content:', err)
  }
}

// 保存
const saveChanges = async () => {
  if (!selectedSkill.value) return
  saveStatus.value = 'saving'
  try {
    await window.api.saveSkillContent(selectedSkill.value.filePath, editValue.value)
    saveStatus.value = 'success'
    isEditing.value = false
    // 重新加载
    await loadSkills()
    // 重新选中编辑过的技能
    const updated = skills.value.find((s) => s.id === selectedSkill.value?.id)
    if (updated) selectedSkill.value = updated
    setTimeout(() => {
      saveStatus.value = 'idle'
    }, 2000)
  } catch (err) {
    saveStatus.value = 'error'
    console.error('Failed to save skill:', err)
    setTimeout(() => {
      saveStatus.value = 'idle'
    }, 3000)
  }
}

// 复制到剪贴板
const copyToClipboard = async (text: string, key: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copyStatus.value[key] = true
    setTimeout(() => {
      copyStatus.value[key] = false
    }, 1500)
  } catch {
    // 回退
  }
}

// 在资源管理器中打开
const openInExplorer = (path: string) => {
  window.api.openInExplorer(path)
}

const openExternal = (url: string) => {
  window.api.openExternal(url).catch((err) => {
    console.error('Failed to open external URL:', err)
  })
}

// 删除 Skill
const confirmDeleteSkill = () => {
  if (!selectedSkill.value) return
  showDeleteConfirm.value = true
  deleteError.value = ''
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  deleteError.value = ''
  deleteStatus.value = 'idle'
}

const doDeleteSkill = async () => {
  if (!selectedSkill.value) return
  deleteStatus.value = 'deleting'
  deleteError.value = ''
  try {
    await window.api.deleteSkill(selectedSkill.value.filePath, selectedSkill.value.dirPath)
    showDeleteConfirm.value = false
    deleteStatus.value = 'idle'
    selectedSkill.value = null
    await loadSkills()
  } catch (err) {
    deleteStatus.value = 'error'
    deleteError.value = formatError(err)
    console.error('Failed to delete skill:', err)
  }
}

// 刷新
const refresh = () => {
  selectedSkill.value = null
  void loadSkills()
}

onMounted(() => {
  void loadSkills()
})
</script>

<template>
  <div class="h-full flex overflow-hidden">
    <!-- 左栏：列表 -->
    <div class="w-72 border-r border-forge-border flex flex-col bg-neutral-900/30 shrink-0">
      <!-- 搜索 + 刷新 -->
      <div class="p-3 border-b border-forge-border">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索 Skills..."
              class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-orange-800 transition-colors"
            />
            <svg
              v-if="!searchQuery"
              class="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-neutral-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            class="px-2 py-2 bg-forge-bg border border-forge-border rounded text-neutral-500 hover:text-orange-400 hover:border-orange-900/50 transition-all cursor-pointer"
            title="刷新"
            @click="refresh"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"
              />
            </svg>
          </button>
          <button
            class="px-2 py-2 bg-forge-bg border border-forge-border rounded text-neutral-500 hover:text-cyan-400 hover:border-cyan-900/50 transition-all cursor-pointer"
            title="SkillsMP"
            @click="openMarketplaceModal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
        <div class="text-[10px] text-neutral-600 mt-2 px-1">
          {{ filteredSkills.length }} / {{ skills.length }} 个技能
        </div>
      </div>

      <!-- Skills 列表 -->
      <div class="flex-1 overflow-y-auto p-2">
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-8">
          <span class="text-xs text-neutral-500 animate-pulse">扫描中...</span>
        </div>

        <!-- Empty -->
        <div v-else-if="filteredSkills.length === 0" class="text-center py-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-8 h-8 text-neutral-600 mx-auto mb-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M13 2 L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <p class="text-xs text-neutral-500">
            {{ searchQuery ? '没有匹配的 Skill' : '暂无 Skills' }}
          </p>
        </div>

        <!-- List -->
        <ul v-else class="space-y-1">
          <li
            v-for="skill in filteredSkills"
            :key="skill.id"
            class="px-3 py-3 rounded cursor-pointer border transition-all duration-200 group"
            :class="
              selectedSkill?.id === skill.id
                ? 'bg-orange-950/30 border-forge-accent/20 text-orange-400'
                : 'border-transparent hover:bg-neutral-800/60 hover:text-neutral-200 text-neutral-400'
            "
            @click="selectSkill(skill)"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="font-bold text-xs truncate" :title="skill.name">{{ skill.name }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded border shrink-0 ml-2"
                :class="
                  skill.source === 'marketplace'
                    ? 'border-green-900/50 text-green-600 bg-green-950/20'
                    : skill.source === 'user'
                      ? 'border-orange-900/50 text-orange-700 bg-orange-950/20'
                      : 'border-blue-900/50 text-blue-700 bg-blue-950/20'
                "
                >{{ skill.sourceLabel }}</span
              >
            </div>
            <p class="text-[10px] text-neutral-600 truncate" :title="skill.description || '暂无描述'">
              {{ skill.description || '暂无描述' }}
            </p>
          </li>
        </ul>
      </div>
    </div>

    <!-- 右栏：详情 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header
        class="h-14 border-b border-forge-border flex items-center justify-between px-6 bg-neutral-900/30 shrink-0"
      >
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            {{ selectedSkill?.name || '请选择一个技能' }}
            <span
              v-if="selectedSkill"
              class="text-[10px] px-2 py-0.5 rounded border border-orange-900/50 text-orange-700 bg-orange-950/20"
            >
              技能
            </span>
          </h2>
        </div>
        <div v-if="selectedSkill" class="flex gap-2">
          <!-- 翻译按钮 -->
          <button
            v-if="translating"
            class="px-3 py-1.5 text-xs font-bold border rounded border-yellow-900/50 text-yellow-600 bg-yellow-950/20 animate-pulse cursor-wait"
            disabled
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5 inline-block mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path
                d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
              /></svg
            >翻译中...
          </button>
          <button
            v-else-if="hasTranslation && !showOriginal"
            class="px-3 py-1.5 text-xs font-bold border rounded transition-colors bg-indigo-950/40 border-indigo-800/50 text-indigo-400 hover:bg-indigo-950/60"
            @click="showOriginal = true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5 inline-block mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg
            >查看原文
          </button>
          <button
            v-else-if="hasTranslation && showOriginal"
            class="px-3 py-1.5 text-xs font-bold border rounded transition-colors bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-indigo-400 hover:border-indigo-800/50"
            @click="showOriginal = false"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5 inline-block mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path
                d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
              /></svg
            >查看翻译
          </button>
          <button
            v-else
            class="px-3 py-1.5 text-xs font-bold border rounded transition-colors bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-indigo-400 hover:border-indigo-800/50"
            @click="doTranslate"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-3.5 h-3.5 inline-block mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path
                d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
              /></svg
            >翻译
          </button>
          <button
            v-if="saveStatus === 'success'"
            class="px-3 py-1.5 text-xs font-bold bg-green-950/30 border border-green-800 text-green-400 rounded"
          >
            ✓ 已保存
          </button>
          <button
            v-else-if="saveStatus === 'error'"
            class="px-3 py-1.5 text-xs font-bold bg-red-950/30 border border-red-800 text-red-400 rounded"
          >
            ✗ 保存失败
          </button>
          <template v-else>
            <button
              class="px-3 py-1.5 text-xs font-bold border rounded transition-colors"
              :class="
                isEditing
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  : 'bg-orange-600 border-orange-500 text-black hover:bg-orange-500'
              "
              @click="toggleEdit"
            >
              <template v-if="isEditing">取消编辑</template
              ><template v-else
                ><svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5 inline-block mr-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z" /></svg
                >编辑</template
              >
            </button>
            <button
              v-if="isEditing"
              class="px-3 py-1.5 text-xs font-bold bg-neutral-800 border border-green-800 text-green-500 hover:bg-neutral-700 rounded transition-colors"
              :disabled="saveStatus === 'saving'"
              @click="saveChanges"
            >
              <template v-if="saveStatus === 'saving'">保存中...</template
              ><template v-else
                ><svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5 inline-block mr-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <path d="M17 21v-8H7v8M7 3v5h8" /></svg
                >保存</template
              >
            </button>
            <!-- 删除按钮 -->
            <button
              v-if="!isEditing"
              class="px-3 py-1.5 text-xs font-bold bg-red-950/30 border border-red-900 text-red-400 hover:bg-red-900/40 rounded transition-colors"
              title="删除此技能"
              @click="confirmDeleteSkill"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              删除
            </button>
          </template>
        </div>
      </header>

      <!-- Content -->
      <div v-if="selectedSkill" class="flex-1 overflow-hidden">
        <!-- 编辑模式 -->
        <div v-if="isEditing" class="h-full w-full bg-[#1e1e1e]">
          <Editor
            v-model:value="editValue"
            height="100%"
            theme="vs-dark"
            default-language="markdown"
            :options="{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'Consolas, monospace',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              lineNumbers: 'on'
            }"
          />
        </div>

        <!-- 详情模式 -->
        <div v-else class="h-full overflow-y-auto p-8 space-y-6">
          <!-- 使用命令 -->
          <div
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden group hover:border-orange-900/40 transition-all duration-300"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-orange-600"></div>
            <h3
              class="text-xs font-bold text-neutral-500 tracking-widest mb-1 flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 17l6-6-6-6M12 19h8" /></svg
              >使用命令
            </h3>
            <p class="text-[10px] text-neutral-600 mb-3">以下两种方式任选其一即可</p>
            <div class="space-y-3">
              <div>
                <span class="text-[10px] text-neutral-500 mb-1 block">方式一：对话中使用</span>
                <div class="flex items-center gap-2">
                  <code
                    class="flex-1 bg-black/50 px-4 py-2.5 rounded text-orange-400 text-sm border border-forge-border font-mono truncate"
                    >{{ selectedSkill!.usageCommand }}</code
                  >
                  <button
                    class="text-xs text-neutral-600 hover:text-orange-400 transition-colors px-2 py-1.5 rounded hover:bg-neutral-800 shrink-0"
                    @click="copyToClipboard(selectedSkill!.usageCommand, 'usage')"
                  >
                    <template v-if="copyStatus['usage']">✓ 已复制</template
                    ><template v-else
                      ><svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-3.5 h-3.5 inline-block mr-0.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg
                      >复制</template
                    >
                  </button>
                </div>
              </div>
              <div>
                <span class="text-[10px] text-neutral-500 mb-1 block">方式二：斜杠命令</span>
                <div class="flex items-center gap-2">
                  <code
                    class="flex-1 bg-black/50 px-4 py-2.5 rounded text-cyan-400 text-sm border border-forge-border font-mono truncate"
                    >{{ selectedSkill!.slashCommand }}</code
                  >
                  <button
                    class="text-xs text-neutral-600 hover:text-cyan-400 transition-colors px-2 py-1.5 rounded hover:bg-neutral-800 shrink-0"
                    @click="copyToClipboard(selectedSkill!.slashCommand, 'slash')"
                  >
                    <template v-if="copyStatus['slash']">✓ 已复制</template
                    ><template v-else
                      ><svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-3.5 h-3.5 inline-block mr-0.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg
                      >复制</template
                    >
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 使用介绍 -->
          <div
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            <h3
              class="text-xs font-bold text-neutral-500 tracking-widest mb-3 flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg
              >使用介绍
            </h3>
            <div
              v-if="displayInstructions"
              class="markdown-body bg-black/30 p-4 rounded border border-forge-border max-h-[500px] overflow-y-auto"
              v-html="renderMd(displayInstructions)"
            ></div>
            <div
              v-else
              class="text-sm text-neutral-500 bg-black/30 p-4 rounded border border-forge-border"
            >
              暂无详细说明
            </div>
          </div>

          <!-- 功能点 -->
          <div
            v-if="displayFeatures.length > 0"
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-green-600"></div>
            <h3
              class="text-xs font-bold text-neutral-500 tracking-widest mb-3 flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
                /></svg
              >功能点总结
            </h3>
            <div class="space-y-2">
              <div
                v-for="(feat, idx) in displayFeatures"
                :key="idx"
                class="flex items-start gap-2 text-sm text-neutral-300"
              >
                <span class="text-green-500 mt-0.5 shrink-0">▸</span>
                <span class="markdown-body-inline" v-html="renderMd(feat)"></span>
              </div>
            </div>
          </div>

          <!-- 文件路径 -->
          <div
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-neutral-600"></div>
            <h3
              class="text-xs font-bold text-neutral-500 tracking-widest mb-3 flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                /></svg
              >文件位置
            </h3>
            <div class="flex items-center gap-3">
              <code
                class="text-xs text-neutral-400 bg-black/50 px-3 py-2 rounded border border-forge-border flex-1 truncate"
              >
                {{ selectedSkill!.filePath }}
              </code>
              <button
                class="px-3 py-2 text-xs text-neutral-500 hover:text-orange-400 border border-forge-border rounded hover:border-orange-900/50 transition-all shrink-0"
                @click="openInExplorer(selectedSkill!.filePath)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5 inline-block mr-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                  /></svg
                >打开目录
              </button>
              <button
                class="px-3 py-2 text-xs text-neutral-500 hover:text-orange-400 border border-forge-border rounded hover:border-orange-900/50 transition-all shrink-0"
                @click="copyToClipboard(selectedSkill!.filePath, 'path')"
              >
                <template v-if="copyStatus['path']">✓</template
                ><template v-else
                  ><svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg
                ></template>
              </button>
            </div>
          </div>

          <!-- 描述 -->
          <div
            v-if="displayDescription"
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-purple-600"></div>
            <h3
              class="text-xs font-bold text-neutral-500 tracking-widest mb-3 flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg
              >描述
            </h3>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div
              class="markdown-body text-sm text-neutral-400 leading-relaxed"
              v-html="renderMd(displayDescription)"
            ></div>
          </div>
        </div>
      </div>

      <!-- 未选中状态 -->
      <div v-else class="flex-1 flex flex-col items-center justify-center text-neutral-600">
        <div
          class="w-16 h-16 border-2 border-dashed border-forge-border rounded-full flex items-center justify-center mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 text-neutral-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M13 2 L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <p class="tracking-widest text-xs">请从左侧选择一个技能查看详情</p>
      </div>
    </div>

    <div
      v-if="showMarketplaceModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      @click.self="closeMarketplaceModal"
    >
      <div
        class="w-[920px] max-w-[95vw] h-[78vh] bg-neutral-900 border border-forge-border rounded-xl shadow-2xl flex flex-col"
      >
        <div class="px-6 py-4 border-b border-forge-border flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-white">SkillsMP 一键安装</h3>
            <p class="text-[11px] text-neutral-500 mt-1">
              搜索 skillsmp.com 上的技能，选中后直接安装到本地。
            </p>
          </div>
          <button
            class="text-neutral-500 hover:text-neutral-200 transition-colors"
            @click="closeMarketplaceModal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="px-6 py-4 border-b border-forge-border space-y-3">
          <div class="flex gap-2">
            <input
              v-model="marketplaceQuery"
              type="text"
              placeholder="搜索技能，例如: code review, react, python..."
              class="flex-1 bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-cyan-800 transition-colors"
              @keyup.enter="triggerMarketplaceSearch"
            />
            <select
              v-model="marketplaceSortBy"
              class="bg-forge-bg border border-forge-border rounded px-2 py-2 text-xs text-neutral-300 focus:outline-none focus:border-cyan-800 transition-colors"
            >
              <option value="stars">按 Stars</option>
              <option value="recent">按更新</option>
            </select>
            <button
              class="px-3 py-2 text-xs font-bold bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 rounded hover:bg-cyan-950/60 transition-colors disabled:opacity-50"
              :disabled="marketplaceLoading"
              @click="triggerMarketplaceSearch"
            >
              {{ marketplaceLoading ? '搜索中...' : '搜索' }}
            </button>
          </div>

          <p v-if="marketplaceError" class="text-xs text-red-400">{{ marketplaceError }}</p>
          <p v-else-if="marketplaceInstallError" class="text-xs text-red-400">
            {{ marketplaceInstallError }}
          </p>
          <p v-else-if="marketplaceInstallMessage" class="text-xs text-green-400">
            {{ marketplaceInstallMessage }}
          </p>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div
            v-if="marketplaceLoading"
            class="h-full flex items-center justify-center text-xs text-neutral-500"
          >
            正在搜索 SkillsMP...
          </div>
          <div
            v-else-if="marketplaceHasSearched && marketplaceResults.length === 0"
            class="h-full flex items-center justify-center text-xs text-neutral-500"
          >
            没有找到匹配的技能
          </div>
          <div
            v-else-if="!marketplaceHasSearched"
            class="h-full flex items-center justify-center text-xs text-neutral-500"
          >
            输入关键词后搜索
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="skill in marketplaceResults"
              :key="marketplaceKey(skill)"
              class="bg-forge-panel border border-forge-border rounded-lg p-4 hover:border-cyan-900/40 transition-colors"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h4 class="text-sm font-bold text-neutral-100 truncate">{{ skill.name }}</h4>
                  <p class="text-xs text-neutral-500 mt-0.5">
                    by {{ skill.author }} · ⭐ {{ skill.stars }} · {{ skill.updated_at }}
                  </p>
                </div>
                <div class="flex gap-2 shrink-0">
                  <button
                    class="px-2.5 py-1.5 text-[11px] text-neutral-400 border border-forge-border rounded hover:text-cyan-400 hover:border-cyan-900/50 transition-colors"
                    @click="openExternal(skill.github_url)"
                  >
                    GitHub
                  </button>
                  <button
                    class="px-2.5 py-1.5 text-[11px] font-bold rounded transition-colors disabled:opacity-60"
                    :class="
                      isMarketplaceInstalled(skill)
                        ? 'bg-neutral-800 border border-neutral-700 text-neutral-500'
                        : 'bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 hover:bg-cyan-950/60'
                    "
                    :disabled="
                      isMarketplaceInstalled(skill) ||
                      marketplaceInstallState[marketplaceKey(skill)] === 'installing'
                    "
                    @click="installMarketplace(skill)"
                  >
                    <template v-if="isMarketplaceInstalled(skill)">已安装</template>
                    <template
                      v-else-if="marketplaceInstallState[marketplaceKey(skill)] === 'installing'"
                    >
                      安装中...
                    </template>
                    <template
                      v-else-if="marketplaceInstallState[marketplaceKey(skill)] === 'success'"
                    >
                      已完成
                    </template>
                    <template v-else>一键安装</template>
                  </button>
                </div>
              </div>
              <p class="text-xs text-neutral-400 mt-2 leading-relaxed line-clamp-2">
                {{ skill.description || '暂无描述' }}
              </p>
              <div v-if="skill.tags && skill.tags.length > 0" class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="tag in skill.tags.slice(0, 6)"
                  :key="tag"
                  class="px-1.5 py-0.5 text-[10px] bg-neutral-800 border border-neutral-700 text-neutral-400 rounded"
                >
                  {{ tag }}
                </span>
              </div>
            </li>
          </ul>
        </div>

        <div
          class="px-6 py-3 border-t border-forge-border flex items-center justify-between text-xs text-neutral-500"
        >
          <span>
            共 {{ marketplaceTotal }} 条，页码 {{ marketplacePage }} / {{ marketplaceTotalPages }}
          </span>
          <div class="flex gap-2">
            <button
              class="px-2.5 py-1 border border-forge-border rounded hover:text-neutral-300 hover:border-neutral-600 transition-colors disabled:opacity-40"
              :disabled="marketplaceLoading || marketplacePage <= 1"
              @click="changeMarketplacePage(marketplacePage - 1)"
            >
              上一页
            </button>
            <button
              class="px-2.5 py-1 border border-forge-border rounded hover:text-neutral-300 hover:border-neutral-600 transition-colors disabled:opacity-40"
              :disabled="marketplaceLoading || marketplacePage >= marketplaceTotalPages"
              @click="changeMarketplacePage(marketplacePage + 1)"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      @click.self="cancelDelete"
    >
      <div
        class="w-[420px] max-w-[90vw] bg-neutral-900 border border-forge-border rounded-xl shadow-2xl overflow-hidden"
      >
        <div class="px-6 py-4 border-b border-forge-border">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            确认删除技能
          </h3>
        </div>
        <div class="px-6 py-5">
          <p class="text-sm text-neutral-300 mb-2">
            确定要删除技能
            <span class="font-bold text-orange-400">{{ selectedSkill?.name }}</span>
            吗？
          </p>
          <p class="text-xs text-neutral-500 mb-1">
            将删除整个技能目录及其所有文件，此操作不可撤销。
          </p>
          <code
            class="block text-[11px] text-neutral-500 bg-black/40 px-3 py-2 rounded border border-forge-border mt-3 truncate"
          >
            {{ selectedSkill?.dirPath }}
          </code>
          <p v-if="deleteError" class="text-xs text-red-400 mt-3">
            删除失败：{{ deleteError }}
          </p>
        </div>
        <div class="px-6 py-3 border-t border-forge-border flex justify-end gap-2">
          <button
            class="px-4 py-2 text-xs font-bold bg-neutral-800 border border-neutral-700 text-neutral-400 rounded hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            :disabled="deleteStatus === 'deleting'"
            @click="cancelDelete"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-xs font-bold bg-red-950/40 border border-red-800/50 text-red-400 rounded hover:bg-red-950/60 transition-colors disabled:opacity-50"
            :disabled="deleteStatus === 'deleting'"
            @click="doDeleteSkill"
          >
            {{ deleteStatus === 'deleting' ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
