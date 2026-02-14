<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface Skill {
  id: string
  name: string
  description: string
  source: string
  sourceLabel: string
  features: string[]
}

interface McpServer {
  id: string
  name: string
  description: string
  source: string
  sourceLabel: string
}

interface McpConfigFile {
  servers: McpServer[]
}

const emit = defineEmits<{
  (e: 'navigate', view: string): void
}>()

const skills = ref<Skill[]>([])
const mcpConfigs = ref<McpConfigFile[]>([])
const loading = ref(true)

const totalSkills = computed(() => skills.value.length)
const totalMcpServers = computed(() => {
  return mcpConfigs.value.reduce((sum, cfg) => sum + cfg.servers.length, 0)
})
const allMcpServers = computed(() => {
  return mcpConfigs.value.flatMap((cfg) => cfg.servers)
})

onMounted(async () => {
  try {
    const [s, m] = await Promise.all([window.api.scanSkills(), window.api.scanMcp()])
    skills.value = s
    mcpConfigs.value = m
  } catch (err) {
    console.error('Dashboard load error:', err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="h-full overflow-y-auto p-8">
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-white mb-1">仪表盘</h2>
      <p class="text-sm text-neutral-500">概览你的 Skills 和 MCP 配置</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-neutral-500 flex items-center gap-3">
        <svg
          class="animate-spin w-5 h-5 text-orange-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          ></path>
        </svg>
        <span class="tracking-wider text-xs">扫描中...</span>
      </div>
    </div>

    <div v-else>
      <!-- 统计卡片 -->
      <div class="grid grid-cols-3 gap-5 mb-10">
        <div
          class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden group hover:border-orange-900/40 transition-all duration-300"
        >
          <div class="absolute top-0 left-0 w-1 h-full bg-orange-600"></div>
          <div class="text-[10px] text-neutral-500 tracking-widest mb-2">技能总数</div>
          <div class="text-3xl font-bold text-orange-400">{{ totalSkills }}</div>
          <div class="text-xs text-neutral-600 mt-1">已注册的技能</div>
        </div>
        <div
          class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden group hover:border-blue-900/40 transition-all duration-300"
        >
          <div class="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
          <div class="text-[10px] text-neutral-500 tracking-widest mb-2">MCP 服务数</div>
          <div class="text-3xl font-bold text-blue-400">{{ totalMcpServers }}</div>
          <div class="text-xs text-neutral-600 mt-1">已配置的 MCP 服务</div>
        </div>
        <div
          class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden group hover:border-green-900/40 transition-all duration-300"
        >
          <div class="absolute top-0 left-0 w-1 h-full bg-green-600"></div>
          <div class="text-[10px] text-neutral-500 tracking-widest mb-2">系统状态</div>
          <div class="text-3xl font-bold text-green-400">●</div>
          <div class="text-xs text-neutral-600 mt-1">系统运行正常</div>
        </div>
      </div>

      <!-- Skills 概览 -->
      <div class="mb-10">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-white tracking-wider">技能概览</h3>
          <button
            class="text-xs text-orange-600 hover:text-orange-400 transition-colors"
            @click="emit('navigate', 'skills')"
          >
            查看全部 →
          </button>
        </div>
        <div
          v-if="skills.length === 0"
          class="bg-forge-panel border border-dashed border-forge-border p-8 rounded-lg text-center"
        >
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
          <p class="text-sm text-neutral-500">暂无 Skills</p>
          <p class="text-xs text-neutral-600 mt-1">请在 Settings 中配置 Skills 扫描路径</p>
        </div>
        <div v-else class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="skill in skills.slice(0, 6)"
            :key="skill.id"
            class="bg-forge-panel border border-forge-border p-4 rounded-lg cursor-pointer hover:border-orange-900/40 transition-all duration-200 group"
            @click="emit('navigate', 'skills')"
          >
            <div class="flex items-start justify-between mb-2">
              <h4
                class="text-sm font-bold text-neutral-200 group-hover:text-orange-400 transition-colors truncate"
              >
                {{ skill.name }}
              </h4>
              <span
                class="text-[10px] px-2 py-0.5 rounded border shrink-0 ml-2"
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
            <p class="text-xs text-neutral-500 line-clamp-2 mb-3">
              {{ skill.description || '暂无描述' }}
            </p>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="(feat, idx) in skill.features.slice(0, 3)"
                :key="idx"
                class="text-[10px] px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 truncate max-w-[120px]"
                >{{ feat }}</span
              >
              <span v-if="skill.features.length > 3" class="text-[10px] text-neutral-600">
                +{{ skill.features.length - 3 }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- MCP 概览 -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-white tracking-wider">MCP 服务概览</h3>
          <button
            class="text-xs text-blue-600 hover:text-blue-400 transition-colors"
            @click="emit('navigate', 'mcp')"
          >
            查看全部 →
          </button>
        </div>
        <div
          v-if="allMcpServers.length === 0"
          class="bg-forge-panel border border-dashed border-forge-border p-8 rounded-lg text-center"
        >
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
            <path
              d="M5 5a2 2 0 012-2h2a2 2 0 012 2v1h2V5a2 2 0 012-2h2a2 2 0 012 2v2h-1a2 2 0 00-2 2v2a2 2 0 002 2h1v2a2 2 0 01-2 2h-2v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1H5a2 2 0 01-2-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2H3V5z"
            />
          </svg>
          <p class="text-sm text-neutral-500">暂无 MCP 服务</p>
          <p class="text-xs text-neutral-600 mt-1">请配置 .claude.json 或 .mcp.json 文件</p>
        </div>
        <div v-else class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="server in allMcpServers.slice(0, 6)"
            :key="server.id"
            class="bg-forge-panel border border-forge-border p-4 rounded-lg cursor-pointer hover:border-blue-900/40 transition-all duration-200 group"
            @click="emit('navigate', 'mcp')"
          >
            <div class="flex items-start justify-between mb-2">
              <h4
                class="text-sm font-bold text-neutral-200 group-hover:text-blue-400 transition-colors truncate"
              >
                {{ server.name }}
              </h4>
              <span
                class="text-[10px] px-2 py-0.5 rounded border shrink-0 ml-2"
                :class="
                  server.source === 'user'
                    ? 'border-orange-900/50 text-orange-700 bg-orange-950/20'
                    : 'border-blue-900/50 text-blue-700 bg-blue-950/20'
                "
                >{{ server.sourceLabel }}</span
              >
            </div>
            <p class="text-xs text-neutral-500 line-clamp-2">{{ server.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
