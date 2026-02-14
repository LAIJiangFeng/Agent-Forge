<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Editor } from '@guolao/vue-monaco-editor'

interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  description: string
  source: 'user' | 'project'
  sourceLabel: string
  configPath: string
  usageCommand: string
}

interface McpConfigFile {
  path: string
  source: 'user' | 'project'
  sourceLabel: string
  servers: McpServer[]
  rawContent: string
}

const mcpConfigs = ref<McpConfigFile[]>([])
const selectedServer = ref<McpServer | null>(null)
const selectedConfigPath = ref<string | null>(null)
const isEditing = ref(false)
const editValue = ref('')
const searchQuery = ref('')
const loading = ref(true)
const saveStatus = ref<'idle' | 'saving' | 'success' | 'error'>('idle')
const copyStatus = ref<Record<string, boolean>>({})

// 所有 MCP servers 平铺
const allServers = computed(() => {
  return mcpConfigs.value.flatMap((cfg) => cfg.servers)
})

// 搜索过滤
const filteredServers = computed(() => {
  if (!searchQuery.value) return allServers.value
  const q = searchQuery.value.toLowerCase()
  return allServers.value.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.command.toLowerCase().includes(q)
  )
})

// 加载 MCP 配置
const loadMcp = async () => {
  loading.value = true
  try {
    mcpConfigs.value = await window.api.scanMcp()
    if (allServers.value.length > 0 && !selectedServer.value) {
      selectedServer.value = allServers.value[0]
      selectedConfigPath.value = allServers.value[0].configPath
    }
  } catch (err) {
    console.error('Failed to scan MCP:', err)
  } finally {
    loading.value = false
  }
}

// 选中 Server
const selectServer = (server: McpServer) => {
  selectedServer.value = server
  selectedConfigPath.value = server.configPath
  isEditing.value = false
  saveStatus.value = 'idle'
}

// 切换编辑模式
const toggleEdit = async () => {
  if (isEditing.value) {
    isEditing.value = false
    return
  }
  if (!selectedConfigPath.value) return
  try {
    const content = await window.api.getMcpConfig(selectedConfigPath.value)
    editValue.value = content
    isEditing.value = true
  } catch (err) {
    console.error('Failed to load MCP config:', err)
  }
}

// 保存
const saveChanges = async () => {
  if (!selectedConfigPath.value) return
  saveStatus.value = 'saving'
  try {
    await window.api.saveMcpConfig(selectedConfigPath.value, editValue.value)
    saveStatus.value = 'success'
    isEditing.value = false
    await loadMcp()
    setTimeout(() => {
      saveStatus.value = 'idle'
    }, 2000)
  } catch (err) {
    saveStatus.value = 'error'
    console.error('Failed to save MCP config:', err)
    setTimeout(() => {
      saveStatus.value = 'idle'
    }, 3000)
  }
}

// 复制
const copyToClipboard = async (text: string, key: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copyStatus.value[key] = true
    setTimeout(() => {
      copyStatus.value[key] = false
    }, 1500)
  } catch {
    /* 回退 */
  }
}

// 在资源管理器中打开
const openInExplorer = (path: string) => {
  window.api.openInExplorer(path)
}

// 刷新
const refresh = () => {
  selectedServer.value = null
  loadMcp()
}

onMounted(() => {
  loadMcp()
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
              placeholder="搜索 MCP 服务..."
              class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-800 transition-colors"
            />
          </div>
          <button
            class="px-2 py-2 bg-forge-bg border border-forge-border rounded text-neutral-500 hover:text-blue-400 hover:border-blue-900/50 transition-all cursor-pointer"
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
        </div>
        <div class="text-[10px] text-neutral-600 mt-2 px-1">
          {{ filteredServers.length }} / {{ allServers.length }} 个 MCP 服务
        </div>
      </div>

      <!-- MCP 列表 -->
      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="loading" class="flex items-center justify-center py-8">
          <span class="text-xs text-neutral-500 animate-pulse">扫描中...</span>
        </div>

        <div v-else-if="filteredServers.length === 0" class="text-center py-8">
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
          <li
            v-for="server in filteredServers"
            :key="server.id"
            class="px-3 py-3 rounded cursor-pointer border transition-all duration-200 group"
            :class="
              selectedServer?.id === server.id
                ? 'bg-blue-950/30 border-blue-800/20 text-blue-400'
                : 'border-transparent hover:bg-neutral-800/60 hover:text-neutral-200 text-neutral-400'
            "
            @click="selectServer(server)"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="font-bold text-xs truncate">{{ server.name }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded border shrink-0 ml-2"
                :class="
                  server.source === 'user'
                    ? 'border-orange-900/50 text-orange-700 bg-orange-950/20'
                    : 'border-blue-900/50 text-blue-700 bg-blue-950/20'
                "
                >{{ server.sourceLabel }}</span
              >
            </div>
            <p class="text-[10px] text-neutral-600 truncate">{{ server.command }}</p>
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
            {{ selectedServer?.name || '请选择一个 MCP 服务' }}
            <span
              v-if="selectedServer"
              class="text-[10px] px-2 py-0.5 rounded border border-blue-900/50 text-blue-700 bg-blue-950/20"
            >
              MCP
            </span>
          </h2>
        </div>
        <div v-if="selectedServer" class="flex gap-2">
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
            ✗ JSON格式错误
          </button>
          <template v-else>
            <button
              class="px-3 py-1.5 text-xs font-bold border rounded transition-colors"
              :class="
                isEditing
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500'
              "
              @click="toggleEdit"
            >
              {{ isEditing ? '取消编辑' : ''
              }}<svg
                v-if="!isEditing"
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
              ><template v-if="!isEditing">编辑配置</template>
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
          </template>
        </div>
      </header>

      <!-- Content -->
      <div v-if="selectedServer" class="flex-1 overflow-hidden">
        <!-- 编辑模式 -->
        <div v-if="isEditing" class="h-full w-full">
          <Editor
            v-model:value="editValue"
            height="100%"
            theme="vs-dark"
            default-language="json"
            :options="{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'Consolas, monospace',
              scrollBeyondLastLine: false,
              automaticLayout: true
            }"
          />
        </div>

        <!-- 详情模式 -->
        <div v-else class="h-full overflow-y-auto p-8 max-w-4xl space-y-6">
          <!-- 执行命令 -->
          <div
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden group hover:border-blue-900/40 transition-all duration-300"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            <div class="flex items-center justify-between mb-3">
              <h3
                class="text-xs font-bold text-neutral-500 tracking-widest flex items-center gap-1.5"
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
                    d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
                  /></svg
                >执行命令
              </h3>
              <button
                class="text-xs text-neutral-600 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-neutral-800"
                @click="
                  copyToClipboard(
                    `${selectedServer!.command} ${selectedServer!.args.join(' ')}`,
                    'cmd'
                  )
                "
              >
                <template v-if="copyStatus['cmd']">✓ 已复制</template
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
            <code
              class="block bg-black/50 p-4 rounded text-blue-400 text-sm border border-forge-border group-hover:border-blue-900/50 transition-colors font-mono break-all"
            >
              {{ selectedServer!.command }} {{ selectedServer!.args.join(' ') }}
            </code>
          </div>

          <!-- 使用命令 -->
          <div
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden group hover:border-orange-900/40 transition-all duration-300"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-orange-600"></div>
            <div class="flex items-center justify-between mb-3">
              <h3
                class="text-xs font-bold text-neutral-500 tracking-widest flex items-center gap-1.5"
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
                >Claude 使用命令
              </h3>
              <button
                class="text-xs text-neutral-600 hover:text-orange-400 transition-colors px-2 py-1 rounded hover:bg-neutral-800"
                @click="copyToClipboard(selectedServer!.usageCommand, 'usage')"
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
            <code
              class="block bg-black/50 p-4 rounded text-orange-400 text-sm border border-forge-border group-hover:border-orange-900/50 transition-colors font-mono"
            >
              {{ selectedServer!.usageCommand }}
            </code>
          </div>

          <!-- 详情网格 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 描述 -->
            <div
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
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg
                >功能描述
              </h3>
              <p class="text-sm text-neutral-300 leading-relaxed">
                {{ selectedServer!.description }}
              </p>
            </div>

            <!-- 环境变量 -->
            <div
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
                  <path
                    d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
                  /></svg
                >环境变量
              </h3>
              <div
                v-if="selectedServer!.env && Object.keys(selectedServer!.env).length > 0"
                class="space-y-2"
              >
                <div
                  v-for="(val, key) in selectedServer!.env"
                  :key="key"
                  class="flex items-center justify-between bg-black/30 rounded px-3 py-2 border border-forge-border"
                >
                  <span class="text-xs font-mono text-neutral-300">{{ key }}</span>
                  <span class="text-xs text-neutral-600 font-mono">••••••••</span>
                </div>
              </div>
              <div v-else class="text-xs text-neutral-500">暂无环境变量</div>
            </div>
          </div>

          <!-- 参数列表 -->
          <div
            v-if="selectedServer!.args.length > 0"
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-cyan-600"></div>
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
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg
              >参数列表
            </h3>
            <div class="space-y-1">
              <div
                v-for="(arg, idx) in selectedServer!.args"
                :key="idx"
                class="flex items-center gap-2 text-sm"
              >
                <span class="text-cyan-500 shrink-0 text-xs font-mono w-6 text-right"
                  >{{ idx }}.</span
                >
                <code
                  class="text-neutral-300 font-mono text-xs bg-black/30 px-2 py-1 rounded break-all"
                  >{{ arg }}</code
                >
              </div>
            </div>
          </div>

          <!-- 配置文件路径 -->
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
              >配置文件路径
            </h3>
            <div class="flex items-center gap-3">
              <code
                class="text-xs text-neutral-400 bg-black/50 px-3 py-2 rounded border border-forge-border flex-1 truncate"
              >
                {{ selectedServer!.configPath }}
              </code>
              <button
                class="px-3 py-2 text-xs text-neutral-500 hover:text-blue-400 border border-forge-border rounded hover:border-blue-900/50 transition-all shrink-0"
                @click="openInExplorer(selectedServer!.configPath)"
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
                >打开
              </button>
              <button
                class="px-3 py-2 text-xs text-neutral-500 hover:text-blue-400 border border-forge-border rounded hover:border-blue-900/50 transition-all shrink-0"
                @click="copyToClipboard(selectedServer!.configPath, 'configPath')"
              >
                <template v-if="copyStatus['configPath']">✓</template
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
        </div>
      </div>

      <!-- 未选中 -->
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
            <path
              d="M5 5a2 2 0 012-2h2a2 2 0 012 2v1h2V5a2 2 0 012-2h2a2 2 0 012 2v2h-1a2 2 0 00-2 2v2a2 2 0 002 2h1v2a2 2 0 01-2 2h-2v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1H5a2 2 0 01-2-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2H3V5z"
            />
          </svg>
        </div>
        <p class="tracking-widest text-xs">请从左侧选择一个 MCP 服务查看详情</p>
      </div>
    </div>
  </div>
</template>
