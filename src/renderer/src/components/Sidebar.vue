<script setup lang="ts">
defineProps<{
  activeView: string
}>()

const emit = defineEmits<{
  (e: 'navigate', view: string): void
}>()

const navItems = [
  { id: 'dashboard', label: '仪表盘', description: '数据概览' },
  { id: 'skills', label: '技能', description: '技能管理' },
  { id: 'mcp', label: 'MCP', description: 'MCP 配置管理' },
  { id: 'settings', label: '设置', description: '扫描路径配置' }
]
</script>

<template>
  <aside class="w-60 border-r border-forge-border flex flex-col bg-forge-panel shrink-0">
    <!-- Logo 区 -->
    <div class="p-5 border-b border-forge-border">
      <div class="flex items-center gap-2 text-orange-500 mb-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <!-- Hammer head -->
          <rect x="7" y="2" width="10" height="5" rx="1.2" stroke="currentColor" fill="none" />
          <!-- Hammer handle -->
          <line x1="12" y1="7" x2="12" y2="14" stroke="currentColor" stroke-linecap="round" />
          <!-- Anvil top surface -->
          <path
            d="M5 16 L19 16 L20 18 L4 18 Z"
            stroke="currentColor"
            fill="none"
            stroke-linejoin="round"
          />
          <!-- Anvil base -->
          <path
            d="M6 18 L18 18 L17 22 L7 22 Z"
            stroke="currentColor"
            fill="none"
            stroke-linejoin="round"
          />
          <!-- Spark -->
          <circle cx="7" cy="13" r="0.8" fill="currentColor" opacity="0.7" />
          <circle cx="17" cy="12" r="0.6" fill="currentColor" opacity="0.5" />
        </svg>
        <h1 class="font-bold tracking-wider text-lg">AGENT FORGE</h1>
      </div>
      <p class="text-[10px] text-neutral-500 tracking-widest">技能与 MCP 管理器</p>
    </div>

    <!-- 导航列表 -->
    <nav class="flex-1 overflow-y-auto p-2 mt-2">
      <div class="text-[10px] font-bold text-neutral-600 mb-2 px-3 tracking-wider">导航</div>
      <ul class="space-y-1">
        <li v-for="item in navItems" :key="item.id">
          <button
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-200 group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/50"
            :class="
              activeView === item.id
                ? 'bg-orange-950/30 border border-forge-accent/20 text-orange-400'
                : 'border border-transparent hover:bg-neutral-800/60 hover:text-neutral-200 text-neutral-400'
            "
            @click="emit('navigate', item.id)"
          >
            <!-- Dashboard icon -->
            <svg
              v-if="item.id === 'dashboard'"
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
            <!-- Skills icon (bolt) -->
            <svg
              v-else-if="item.id === 'skills'"
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M13 2 L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <!-- MCP icon (puzzle) -->
            <svg
              v-else-if="item.id === 'mcp'"
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M5 5a2 2 0 012-2h2a2 2 0 012 2v1h2V5a2 2 0 012-2h2a2 2 0 012 2v2h-1a2 2 0 00-2 2v2a2 2 0 002 2h1v2a2 2 0 01-2 2h-2v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1H5a2 2 0 01-2-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2H3V5z"
              />
            </svg>
            <!-- Settings icon (cog) -->
            <svg
              v-else-if="item.id === 'settings'"
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold tracking-wider">{{ item.label }}</div>
              <div
                class="text-[10px] text-neutral-600 group-hover:text-neutral-500 transition-colors"
              >
                {{ item.description }}
              </div>
            </div>
            <span
              class="w-1.5 h-1.5 rounded-full transition-all shrink-0"
              :class="
                activeView === item.id
                  ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]'
                  : 'bg-neutral-700'
              "
            ></span>
          </button>
        </li>
      </ul>
    </nav>

    <!-- 底部状态 -->
    <div
      class="p-3 border-t border-forge-border text-[10px] text-neutral-600 flex justify-between items-center"
    >
      <span>v1.0.0</span>
      <span class="flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
        <span class="text-green-700">系统就绪</span>
      </span>
    </div>
  </aside>
</template>
