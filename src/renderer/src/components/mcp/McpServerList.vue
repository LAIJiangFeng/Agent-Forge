<script setup lang="ts">
import type { McpServer } from './types'

defineProps<{
  loading: boolean
  searchQuery: string
  filteredServersCount: number
  allServersCount: number
  groupedRegularServers: { label: string; path: string; servers: McpServer[] }[]
  pluginServers: McpServer[]
  regularServersCount: number
  collapsedGroups: Record<string, boolean>
  selectedServerId: string | null
  healthStatus: Record<string, 'connected' | 'failed' | 'unknown'>
  showLogPanel: boolean
}>()

const emit = defineEmits<{
  select: [server: McpServer]
  toggle: [server: McpServer, event: Event]
  refresh: []
  'update:searchQuery': [value: string]
  openAdd: []
  openImport: []
  openDxt: []
  toggleLog: []
  toggleCollapse: [path: string]
}>()

const onSearchInput = (e: Event) => {
  emit('update:searchQuery', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="w-72 border-r border-forge-border flex flex-col bg-neutral-900/30 shrink-0">
    <!-- 搜索 + 操作 -->
    <div class="p-3 border-b border-forge-border">
      <div class="flex gap-1.5 items-center">
        <div class="relative flex-1">
          <input
            :value="searchQuery"
            type="text"
            placeholder="搜索 MCP 服务..."
            class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-800 transition-colors"
            @input="onSearchInput"
          />
        </div>
        <button
          class="px-2 py-2 bg-forge-bg border border-forge-border rounded text-neutral-500 hover:text-blue-400 hover:border-blue-900/50 transition-all cursor-pointer shrink-0"
          title="刷新"
          @click="emit('refresh')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
          </svg>
        </button>
        <!-- 更多操作（悬浮下拉） -->
        <div class="relative group/more shrink-0">
          <button
            class="px-2 py-2 bg-forge-bg border border-forge-border rounded text-neutral-500 hover:text-white hover:border-neutral-600 transition-all cursor-pointer"
            title="更多操作"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          <div class="absolute right-0 top-full mt-1 w-40 bg-neutral-900 border border-forge-border rounded-lg shadow-xl opacity-0 invisible group-hover/more:opacity-100 group-hover/more:visible transition-all duration-150 z-30 py-1">
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 hover:text-green-400 hover:bg-neutral-800 transition-colors text-left"
              @click="emit('openAdd')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              添加服务
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition-colors text-left"
              @click="emit('openImport')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              导入 JSON
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 hover:text-purple-400 hover:bg-neutral-800 transition-colors text-left"
              @click="emit('openDxt')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              安装 DXT
            </button>
            <div class="border-t border-forge-border my-1"></div>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left"
              :class="showLogPanel ? 'text-cyan-400' : 'text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800'"
              @click="emit('toggleLog')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              操作日志
            </button>
          </div>
        </div>
      </div>
      <div class="text-[10px] text-neutral-600 mt-2 px-1">
        {{ filteredServersCount }} / {{ allServersCount }} 个 MCP 服务
      </div>
    </div>

    <!-- MCP 列表 -->
    <div class="flex-1 overflow-y-auto p-2">
      <div v-if="loading" class="flex items-center justify-center py-8">
        <span class="text-xs text-neutral-500 animate-pulse">扫描中...</span>
      </div>

      <div v-else-if="filteredServersCount === 0" class="text-center py-8">
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
        <p class="text-xs text-neutral-500">
          {{ searchQuery ? '没有匹配的 MCP 服务' : '暂无 MCP 配置' }}
        </p>
        <p v-if="!searchQuery" class="text-[10px] text-neutral-600 mt-1">
          请配置 .claude.json 或 .mcp.json
        </p>
      </div>

      <ul v-else class="space-y-1">
        <!-- 按配置文件分组 -->
        <template v-for="group in groupedRegularServers" :key="group.path">
          <li
            class="px-3 pt-2 pb-1 flex items-center justify-between cursor-pointer hover:bg-neutral-800/30 rounded"
            @click="emit('toggleCollapse', group.path)"
          >
            <div class="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3 h-3 text-neutral-500 transition-transform duration-200"
                :class="collapsedGroups[group.path] ? '-rotate-90' : ''"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span class="text-[10px] font-bold text-neutral-500 tracking-wide">{{ group.label }}</span>
            </div>
            <span class="text-[9px] text-neutral-600">{{ group.servers.length }}</span>
          </li>
          <template v-if="!collapsedGroups[group.path]">
            <li
              v-for="server in group.servers"
              :key="server.id"
              class="px-3 py-3 rounded cursor-pointer border transition-all duration-200 group"
              :class="[
                selectedServerId === server.id
                  ? 'bg-blue-950/30 border-blue-800/20 text-blue-400'
                  : 'border-transparent hover:bg-neutral-800/60 hover:text-neutral-200 text-neutral-400',
                server.disabled ? 'opacity-45' : ''
              ]"
              @click="emit('select', server)"
            >
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span
                    v-if="!server.disabled"
                    class="w-2 h-2 rounded-full shrink-0 transition-colors"
                    :class="{
                      'bg-green-500': healthStatus[server.id] === 'connected',
                      'bg-red-500': healthStatus[server.id] === 'failed',
                      'bg-neutral-600 animate-pulse': !healthStatus[server.id] || healthStatus[server.id] === 'unknown'
                    }"
                    :title="healthStatus[server.id] === 'connected' ? '已连接' : healthStatus[server.id] === 'failed' ? '连接失败' : '检测中...'"
                  ></span>
                  <span v-else class="w-2 h-2 rounded-full shrink-0 bg-neutral-700"></span>
                  <span class="font-bold text-xs truncate" :class="server.disabled ? 'line-through text-neutral-600' : ''">{{ server.name }}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0 ml-1">
                  <!-- Toggle Switch -->
                  <button
                    v-if="server.source !== 'plugin'"
                    class="relative w-7 h-4 rounded-full transition-colors duration-200 shrink-0"
                    :class="server.disabled ? 'bg-neutral-700' : 'bg-green-600'"
                    :title="server.disabled ? '点击启用' : '点击禁用'"
                    @click="emit('toggle', server, $event)"
                  >
                    <span
                      class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200"
                      :class="server.disabled ? 'left-0.5' : 'left-3.5'"
                    ></span>
                  </button>
                </div>
              </div>
              <p class="text-[10px] text-neutral-600 truncate pl-3.5">{{ server.type === 'http' ? server.url : server.command }}</p>
            </li>
          </template>
        </template>

        <!-- 插件 MCP 服务 -->
        <template v-if="pluginServers.length > 0">
          <li class="px-3 pt-4 pb-1" :class="{ 'border-t border-forge-border mt-2': regularServersCount > 0 }">
            <span class="text-[10px] font-bold text-neutral-500 tracking-widest uppercase">插件 MCP</span>
          </li>
          <li
            v-for="server in pluginServers"
            :key="server.id"
            class="px-3 py-3 rounded cursor-pointer border transition-all duration-200 group"
            :class="
              selectedServerId === server.id
                ? 'bg-purple-950/30 border-purple-800/20 text-purple-400'
                : 'border-transparent hover:bg-neutral-800/60 hover:text-neutral-200 text-neutral-400'
            "
            @click="emit('select', server)"
          >
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <span
                  class="w-2 h-2 rounded-full shrink-0 transition-colors"
                  :class="{
                    'bg-green-500': healthStatus[server.id] === 'connected',
                    'bg-red-500': healthStatus[server.id] === 'failed',
                    'bg-neutral-600 animate-pulse': !healthStatus[server.id] || healthStatus[server.id] === 'unknown'
                  }"
                ></span>
                <span class="font-bold text-xs truncate">{{ server.name }}</span>
              </div>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded border shrink-0 ml-1 border-purple-900/50 text-purple-700 bg-purple-950/20"
                >{{ server.sourceLabel }}</span
              >
            </div>
            <p class="text-[10px] text-neutral-600 truncate pl-3.5">{{ server.type === 'http' ? server.url : server.command }}</p>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>
