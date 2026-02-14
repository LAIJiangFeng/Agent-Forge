<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface AppConfig {
  scanPaths: {
    skills: string[]
    mcpConfigs: string[]
  }
  projectRoots: string[]
}

const config = ref<AppConfig>({
  scanPaths: {
    skills: [],
    mcpConfigs: []
  },
  projectRoots: []
})

const loading = ref(true)
const saveStatus = ref<'idle' | 'saving' | 'success' | 'error'>('idle')

// 新增输入
const newSkillPath = ref('')
const newMcpPath = ref('')
const newProjectRoot = ref('')

// 加载配置
const loadConfig = async () => {
  loading.value = true
  try {
    config.value = await window.api.getConfig()
  } catch (err) {
    console.error('Failed to load config:', err)
  } finally {
    loading.value = false
  }
}

// 保存配置
const saveConfig = async () => {
  saveStatus.value = 'saving'
  try {
    await window.api.saveConfig(config.value)
    saveStatus.value = 'success'
    setTimeout(() => {
      saveStatus.value = 'idle'
    }, 2000)
  } catch (err) {
    saveStatus.value = 'error'
    console.error('Failed to save config:', err)
    setTimeout(() => {
      saveStatus.value = 'idle'
    }, 3000)
  }
}

// 添加路径
const addSkillPath = () => {
  if (
    newSkillPath.value.trim() &&
    !config.value.scanPaths.skills.includes(newSkillPath.value.trim())
  ) {
    config.value.scanPaths.skills.push(newSkillPath.value.trim())
    newSkillPath.value = ''
  }
}

const addMcpPath = () => {
  if (
    newMcpPath.value.trim() &&
    !config.value.scanPaths.mcpConfigs.includes(newMcpPath.value.trim())
  ) {
    config.value.scanPaths.mcpConfigs.push(newMcpPath.value.trim())
    newMcpPath.value = ''
  }
}

const addProjectRoot = () => {
  if (
    newProjectRoot.value.trim() &&
    !config.value.projectRoots.includes(newProjectRoot.value.trim())
  ) {
    config.value.projectRoots.push(newProjectRoot.value.trim())
    newProjectRoot.value = ''
  }
}

// 删除路径
const removeSkillPath = (idx: number) => {
  config.value.scanPaths.skills.splice(idx, 1)
}

const removeMcpPath = (idx: number) => {
  config.value.scanPaths.mcpConfigs.splice(idx, 1)
}

const removeProjectRoot = (idx: number) => {
  config.value.projectRoots.splice(idx, 1)
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="h-full overflow-y-auto p-8">
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-white mb-1">Settings</h2>
      <p class="text-sm text-neutral-500">配置 Skills 和 MCP 的扫描路径</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center h-40">
      <span class="text-xs text-neutral-500 animate-pulse">加载配置中...</span>
    </div>

    <div v-else class="space-y-8">
      <!-- Skills 扫描路径 -->
      <div
        class="bg-forge-panel border border-forge-border p-6 rounded-lg relative overflow-hidden"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-orange-600"></div>
        <h3 class="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
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
            <path d="M13 2 L3 14h9l-1 8 10-12h-9l1-8z" /></svg
          >Skills 扫描路径
        </h3>
        <p class="text-xs text-neutral-500 mb-4">指定包含 SKILL.md 文件的目录</p>

        <div class="space-y-2 mb-3">
          <div
            v-for="(path, idx) in config.scanPaths.skills"
            :key="idx"
            class="flex items-center gap-2 bg-black/30 rounded px-3 py-2 border border-forge-border group"
          >
            <code class="text-xs text-neutral-300 flex-1 truncate font-mono">{{ path }}</code>
            <button
              class="text-neutral-600 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
              @click="removeSkillPath(idx)"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            v-model="newSkillPath"
            type="text"
            placeholder="添加路径，如 C:/Users/.claude/skills"
            class="flex-1 bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-orange-800 transition-colors"
            @keyup.enter="addSkillPath"
          />
          <button
            class="px-3 py-2 text-xs font-bold bg-orange-950/30 border border-orange-900/50 text-orange-500 rounded hover:bg-orange-950/50 transition-colors"
            @click="addSkillPath"
          >
            + 添加
          </button>
        </div>
      </div>

      <!-- MCP 配置文件路径 -->
      <div
        class="bg-forge-panel border border-forge-border p-6 rounded-lg relative overflow-hidden"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
        <h3 class="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
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
            <path
              d="M5 5a2 2 0 012-2h2a2 2 0 012 2v1h2V5a2 2 0 012-2h2a2 2 0 012 2v2h-1a2 2 0 00-2 2v2a2 2 0 002 2h1v2a2 2 0 01-2 2h-2v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1H5a2 2 0 01-2-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2H3V5z"
            /></svg
          >MCP 配置文件路径
        </h3>
        <p class="text-xs text-neutral-500 mb-4">指定 .claude.json 等 MCP 配置文件位置</p>

        <div class="space-y-2 mb-3">
          <div
            v-for="(path, idx) in config.scanPaths.mcpConfigs"
            :key="idx"
            class="flex items-center gap-2 bg-black/30 rounded px-3 py-2 border border-forge-border group"
          >
            <code class="text-xs text-neutral-300 flex-1 truncate font-mono">{{ path }}</code>
            <button
              class="text-neutral-600 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
              @click="removeMcpPath(idx)"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            v-model="newMcpPath"
            type="text"
            placeholder="添加路径，如 ~/.claude.json"
            class="flex-1 bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-800 transition-colors"
            @keyup.enter="addMcpPath"
          />
          <button
            class="px-3 py-2 text-xs font-bold bg-blue-950/30 border border-blue-900/50 text-blue-500 rounded hover:bg-blue-950/50 transition-colors"
            @click="addMcpPath"
          >
            + 添加
          </button>
        </div>
      </div>

      <!-- 项目根目录 -->
      <div
        class="bg-forge-panel border border-forge-border p-6 rounded-lg relative overflow-hidden"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-green-600"></div>
        <h3 class="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
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
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg
          >项目根目录
        </h3>
        <p class="text-xs text-neutral-500 mb-4">
          扫描这些目录下的子项目中的 .claude/skills/ 和 .mcp.json
        </p>

        <div class="space-y-2 mb-3">
          <div
            v-for="(path, idx) in config.projectRoots"
            :key="idx"
            class="flex items-center gap-2 bg-black/30 rounded px-3 py-2 border border-forge-border group"
          >
            <code class="text-xs text-neutral-300 flex-1 truncate font-mono">{{ path }}</code>
            <button
              class="text-neutral-600 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
              @click="removeProjectRoot(idx)"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            v-model="newProjectRoot"
            type="text"
            placeholder="添加路径，如 D:/project"
            class="flex-1 bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-green-800 transition-colors"
            @keyup.enter="addProjectRoot"
          />
          <button
            class="px-3 py-2 text-xs font-bold bg-green-950/30 border border-green-900/50 text-green-500 rounded hover:bg-green-950/50 transition-colors"
            @click="addProjectRoot"
          >
            + 添加
          </button>
        </div>
      </div>

      <!-- 保存按钮 -->
      <div class="flex justify-end pt-4 border-t border-forge-border">
        <button
          class="px-6 py-2.5 text-sm font-bold rounded transition-all duration-300"
          :class="{
            'bg-orange-600 border border-orange-500 text-black hover:bg-orange-500':
              saveStatus === 'idle',
            'bg-neutral-800 border border-neutral-600 text-neutral-400': saveStatus === 'saving',
            'bg-green-950/30 border border-green-800 text-green-400': saveStatus === 'success',
            'bg-red-950/30 border border-red-800 text-red-400': saveStatus === 'error'
          }"
          :disabled="saveStatus === 'saving'"
          @click="saveConfig"
        >
          {{
            saveStatus === 'idle'
              ? ''
              : saveStatus === 'saving'
                ? '保存中...'
                : saveStatus === 'success'
                  ? '✓ 保存成功'
                  : '✗ 保存失败'
          }}
          <svg
            v-if="saveStatus === 'idle'"
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 inline-block mr-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <path d="M17 21v-8H7v8M7 3v5h8" /></svg
          ><template v-if="saveStatus === 'idle'">保存配置</template>
        </button>
      </div>
    </div>
  </div>
</template>
