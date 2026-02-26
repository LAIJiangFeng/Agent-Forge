<script setup lang="ts">
import { onMounted } from 'vue'
import { Editor } from '@guolao/vue-monaco-editor'
import McpServerList from './mcp/McpServerList.vue'
import { useMcpPanel } from './mcp/useMcpPanel'

const props = defineProps<{
  initialServerId?: string
}>()

const {
  selectedServer,
  isEditing,
  editValue,
  searchQuery,
  loading,
  saveStatus,
  copyStatus,
  healthStatus,
  showAddForm,
  addForm,
  showDeleteConfirm,
  deleteTarget,
  showImportForm,
  importJson,
  importConfigPath,
  importError,
  showLogPanel,
  logEntries,
  collapsedGroups,
  allServers,
  filteredServers,
  regularServers,
  pluginServers,
  writableConfigs,
  groupedRegularServers,
  toggleGroupCollapse,
  loadMcp,
  selectServer,
  toggleEdit,
  saveChanges,
  copyToClipboard,
  openInExplorer,
  refresh,
  handleToggle,
  openAddForm,
  submitAddForm,
  confirmDelete,
  executeDelete,
  openImportForm,
  submitImport,
  loadLogs,
  toggleLogPanel,
  clearLogs,
  formatLogTime,
  actionLabels,
  newToolName,
  editingTools,
  startEditTools,
  addTool,
  removeTool,
  saveAllowedTools,
  showDxtModal,
  dxtManifest,
  dxtUserConfigFields,
  dxtUserConfigValues,
  dxtConfigPath,
  dxtError,
  dxtInstalling,
  openDxtInstall,
  executeDxtInstall
} = useMcpPanel()

onMounted(() => {
  void loadMcp(props.initialServerId)
})
</script>


<template>
  <div class="h-full flex overflow-hidden">
    <!-- 左栏：列表 -->
    <McpServerList
      :loading="loading"
      :search-query="searchQuery"
      :filtered-servers-count="filteredServers.length"
      :all-servers-count="allServers.length"
      :grouped-regular-servers="groupedRegularServers"
      :plugin-servers="pluginServers"
      :regular-servers-count="regularServers.length"
      :collapsed-groups="collapsedGroups"
      :selected-server-id="selectedServer?.id || null"
      :health-status="healthStatus"
      :show-log-panel="showLogPanel"
      @select="selectServer"
      @toggle="handleToggle"
      @refresh="refresh"
      @update:search-query="searchQuery = $event"
      @open-add="openAddForm"
      @open-import="openImportForm"
      @open-dxt="openDxtInstall"
      @toggle-log="toggleLogPanel"
      @toggle-collapse="toggleGroupCollapse"
    />
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
            v-if="selectedServer?.source !== 'plugin' && saveStatus === 'success'"
            class="px-3 py-1.5 text-xs font-bold bg-green-950/30 border border-green-800 text-green-400 rounded"
          >
            ✓ 已保存
          </button>
          <button
            v-else-if="selectedServer?.source !== 'plugin' && saveStatus === 'error'"
            class="px-3 py-1.5 text-xs font-bold bg-red-950/30 border border-red-800 text-red-400 rounded"
          >
            ✗ JSON格式错误
          </button>
          <template v-else-if="selectedServer?.source !== 'plugin'">
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
          <span
            v-else
            class="px-3 py-1.5 text-xs font-bold bg-neutral-900 border border-neutral-700 text-neutral-500 rounded"
          >
            Read Only (Plugin)
          </span>
          <button
            v-if="selectedServer?.source !== 'plugin'"
            class="px-3 py-1.5 text-xs font-bold bg-red-950/30 border border-red-900 text-red-400 hover:bg-red-900/40 rounded transition-colors"
            title="删除此服务"
            @click="confirmDelete(selectedServer!)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            删除
          </button>
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
        <div v-else class="h-full overflow-y-auto p-8 space-y-6">
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
                >{{ selectedServer!.type === 'http' ? 'HTTP 端点' : '执行命令' }}
              </h3>
              <button
                class="text-xs text-neutral-600 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-neutral-800"
                @click="
                  copyToClipboard(
                    selectedServer!.type === 'http'
                      ? (selectedServer!.url || '')
                      : `${selectedServer!.command} ${selectedServer!.args.join(' ')}`,
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
              <template v-if="selectedServer!.type === 'http'">{{ selectedServer!.url }}</template>
              <template v-else>{{ selectedServer!.command }} {{ selectedServer!.args.join(' ') }}</template>
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
                  v-for="key in Object.keys(selectedServer!.env || {})"
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

          <!-- Allowed Tools 卡片 -->
          <div
            v-if="selectedServer && selectedServer.source !== 'plugin'"
            class="bg-forge-panel border border-forge-border p-5 rounded-lg relative overflow-hidden"
          >
            <div class="absolute top-0 left-0 w-1 h-full bg-amber-600"></div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-bold text-neutral-500 tracking-widest flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                </svg>
                ALLOWED TOOLS
              </h3>
              <button
                class="text-[10px] text-neutral-600 hover:text-amber-400 transition-colors"
                @click="startEditTools"
              >
                编辑
              </button>
            </div>
            <div v-if="editingTools.length > 0 || newToolName" class="space-y-2">
              <div
                v-for="(tool, idx) in editingTools"
                :key="idx"
                class="flex items-center justify-between gap-2 bg-black/30 px-3 py-1.5 rounded"
              >
                <code class="text-xs text-amber-400 font-mono truncate">{{ tool }}</code>
                <button
                  class="text-neutral-600 hover:text-red-400 transition-colors shrink-0"
                  @click="removeTool(idx)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="newToolName"
                  type="text"
                  placeholder="tool_name (e.g. mcp__server__tool)"
                  class="flex-1 bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-amber-800 transition-colors font-mono"
                  @keyup.enter="addTool"
                />
                <button
                  class="px-3 py-1.5 text-xs bg-amber-900/30 border border-amber-900 text-amber-400 rounded hover:bg-amber-900/50 transition-colors"
                  @click="addTool"
                >
                  +
                </button>
              </div>
              <button
                class="w-full mt-2 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
                @click="saveAllowedTools"
              >
                保存 Allowed Tools
              </button>
            </div>
            <div v-else class="text-xs text-neutral-600">
              <p>未配置工具限制（允许所有工具）</p>
              <p class="text-[10px] mt-1">点击“编辑”可添加 allowedTools 限制</p>
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

  <!-- 添加 MCP 服务弹窗 -->
  <div
    v-if="showAddForm"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    @click.self="showAddForm = false"
  >
    <div class="bg-neutral-900 border border-forge-border rounded-xl w-[480px] shadow-2xl">
      <div class="px-6 py-4 border-b border-forge-border flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">添加 MCP 服务</h3>
        <button
          class="text-neutral-500 hover:text-neutral-300 transition-colors"
          @click="showAddForm = false"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="px-6 py-5 space-y-4">
        <!-- 名称 -->
        <div>
          <label class="text-[11px] font-bold text-neutral-500 tracking-wide block mb-1.5">服务名称</label>
          <input
            v-model="addForm.name"
            type="text"
            placeholder="my-mcp-server"
            class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-800 transition-colors"
          />
        </div>

        <!-- 类型 -->
        <div>
          <label class="text-[11px] font-bold text-neutral-500 tracking-wide block mb-1.5">类型</label>
          <div class="flex gap-2">
            <button
              class="flex-1 px-3 py-2 text-xs rounded border transition-colors"
              :class="addForm.type === 'command' ? 'bg-blue-950/40 border-blue-800/50 text-blue-400' : 'bg-forge-bg border-forge-border text-neutral-500 hover:text-neutral-300'"
              @click="addForm.type = 'command'"
            >
              ⌘ Command
            </button>
            <button
              class="flex-1 px-3 py-2 text-xs rounded border transition-colors"
              :class="addForm.type === 'http' ? 'bg-blue-950/40 border-blue-800/50 text-blue-400' : 'bg-forge-bg border-forge-border text-neutral-500 hover:text-neutral-300'"
              @click="addForm.type = 'http'"
            >
              🌐 HTTP
            </button>
          </div>
        </div>

        <!-- Command 字段 -->
        <template v-if="addForm.type === 'command'">
          <div>
            <label class="text-[11px] font-bold text-neutral-500 tracking-wide block mb-1.5">命令</label>
            <input
              v-model="addForm.command"
              type="text"
              placeholder="npx"
              class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-800 transition-colors"
            />
          </div>
          <div>
            <label class="text-[11px] font-bold text-neutral-500 tracking-wide block mb-1.5">参数（空格分隔）</label>
            <input
              v-model="addForm.args"
              type="text"
              placeholder="-y @my/mcp-server"
              class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-800 transition-colors"
            />
          </div>
        </template>

        <!-- HTTP 字段 -->
        <template v-else>
          <div>
            <label class="text-[11px] font-bold text-neutral-500 tracking-wide block mb-1.5">URL</label>
            <input
              v-model="addForm.url"
              type="text"
              placeholder="https://mcp.example.com/mcp"
              class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-800 transition-colors"
            />
          </div>
        </template>

        <!-- 目标配置文件 -->
        <div>
          <label class="text-[11px] font-bold text-neutral-500 tracking-wide block mb-1.5">写入配置文件</label>
          <select
            v-model="addForm.configPath"
            class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-blue-800 transition-colors"
          >
            <option v-for="cfg in writableConfigs" :key="cfg.path" :value="cfg.path">
              {{ cfg.path }}
            </option>
          </select>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-forge-border flex justify-end gap-2">
        <button
          class="px-4 py-2 text-xs text-neutral-400 hover:text-neutral-200 border border-forge-border rounded transition-colors"
          @click="showAddForm = false"
        >
          取消
        </button>
        <button
          class="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-40"
          :disabled="!addForm.name || !addForm.configPath || (addForm.type === 'http' ? !addForm.url : !addForm.command)"
          @click="submitAddForm"
        >
          添加
        </button>
      </div>
    </div>
  </div>

  <!-- 删除确认弹窗 -->
  <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div class="bg-neutral-900 border border-forge-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
      <h3 class="text-white font-bold mb-3">确认删除</h3>
      <p class="text-sm text-neutral-400 mb-4">
        确定要删除 MCP 服务 <span class="text-red-400 font-bold">{{ deleteTarget?.name }}</span> 吗？此操作不可撤销。
      </p>
      <div class="flex justify-end gap-2">
        <button
          class="px-4 py-2 text-xs text-neutral-400 hover:text-neutral-200 border border-forge-border rounded transition-colors"
          @click="showDeleteConfirm = false"
        >
          取消
        </button>
        <button
          class="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded transition-colors"
          @click="executeDelete"
        >
          删除
        </button>
      </div>
    </div>
  </div>

  <!-- JSON 导入弹窗 -->
  <div v-if="showImportForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div class="bg-neutral-900 border border-forge-border rounded-xl shadow-2xl max-w-lg w-full mx-4">
      <div class="px-6 py-4 border-b border-forge-border">
        <h3 class="text-white font-bold">导入 JSON 配置</h3>
        <p class="text-[11px] text-neutral-500 mt-1">支持 { "mcpServers": {...} } 或 { "name": { config } } 格式</p>
      </div>
      <div class="px-6 py-4 space-y-4">
        <div>
          <label class="text-[11px] font-bold text-neutral-500 tracking-wide block mb-1.5">粘贴 JSON</label>
          <textarea
            v-model="importJson"
            rows="8"
            placeholder='{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"]
    }
  }
}'
            class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-800 transition-colors font-mono resize-none"
          ></textarea>
        </div>
        <div>
          <label class="text-[11px] font-bold text-neutral-500 tracking-wide block mb-1.5">写入配置文件</label>
          <select
            v-model="importConfigPath"
            class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-blue-800 transition-colors"
          >
            <option v-for="cfg in writableConfigs" :key="cfg.path" :value="cfg.path">
              {{ cfg.path }}
            </option>
          </select>
        </div>
        <p v-if="importError" class="text-xs text-red-400">{{ importError }}</p>
      </div>
      <div class="px-6 py-4 border-t border-forge-border flex justify-end gap-2">
        <button
          class="px-4 py-2 text-xs text-neutral-400 hover:text-neutral-200 border border-forge-border rounded transition-colors"
          @click="showImportForm = false"
        >
          取消
        </button>
        <button
          class="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded transition-colors disabled:opacity-40"
          :disabled="!importJson.trim() || !importConfigPath"
          @click="submitImport"
        >
          导入
        </button>
      </div>
    </div>
  </div>

  <!-- DXT 安装弹窗 -->
  <div v-if="showDxtModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div class="bg-neutral-900 border border-forge-border rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
      <!-- header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-forge-border">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          安装 DXT 扩展
        </h3>
        <button class="text-neutral-500 hover:text-white transition-colors" @click="showDxtModal = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <!-- body -->
      <div v-if="dxtManifest" class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <!-- manifest info -->
        <div class="bg-black/30 rounded-lg p-4 space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-purple-900/40 rounded-lg flex items-center justify-center text-purple-400 font-bold text-lg">{{ (dxtManifest.display_name || dxtManifest.name).charAt(0).toUpperCase() }}</div>
            <div>
              <h4 class="text-sm font-bold text-white">{{ dxtManifest.display_name || dxtManifest.name }}</h4>
              <p class="text-[10px] text-neutral-500">v{{ dxtManifest.version }} · {{ dxtManifest.author.name }}</p>
            </div>
          </div>
          <p class="text-xs text-neutral-400">{{ dxtManifest.description }}</p>
          <div class="flex gap-2 flex-wrap">
            <span class="px-2 py-0.5 bg-purple-950/50 text-purple-400 text-[10px] rounded font-mono">{{ dxtManifest.server.type }}</span>
            <span class="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-[10px] rounded font-mono">{{ dxtManifest.server.entry_point }}</span>
          </div>
          <div v-if="dxtManifest.tools && dxtManifest.tools.length > 0" class="mt-2">
            <p class="text-[10px] text-neutral-500 mb-1">Tools ({{ dxtManifest.tools.length }}):</p>
            <div class="flex flex-wrap gap-1">
              <span v-for="tool in dxtManifest.tools" :key="tool.name" class="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] rounded font-mono">{{ tool.name }}</span>
            </div>
          </div>
        </div>
        <!-- user config fields -->
        <div v-if="dxtUserConfigFields.length > 0" class="space-y-3">
          <h4 class="text-xs font-bold text-neutral-400 tracking-widest">配置参数</h4>
          <div v-for="field in dxtUserConfigFields" :key="field.key" class="space-y-1">
            <label class="text-[11px] text-neutral-400 flex items-center gap-1">
              {{ field.title }}
              <span v-if="field.required" class="text-red-500">*</span>
              <span v-if="field.sensitive" class="text-amber-600 text-[9px]">🔒</span>
            </label>
            <input
              v-model="dxtUserConfigValues[field.key]"
              :type="field.sensitive ? 'password' : 'text'"
              :placeholder="field.description || field.key"
              class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-purple-800 transition-colors font-mono"
            />
          </div>
        </div>
        <!-- config file -->
        <div class="space-y-1">
          <label class="text-[11px] text-neutral-400">目标配置文件</label>
          <select
            v-model="dxtConfigPath"
            class="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-purple-800 transition-colors"
          >
            <option v-for="cf in writableConfigs" :key="cf.path" :value="cf.path">{{ cf.path }}</option>
          </select>
        </div>
        <!-- error -->
        <div v-if="dxtError" class="text-xs text-red-400 bg-red-950/30 p-3 rounded">{{ dxtError }}</div>
      </div>
      <!-- footer -->
      <div class="flex justify-end gap-3 px-6 py-4 border-t border-forge-border">
        <button class="px-4 py-2 text-xs text-neutral-400 hover:text-white transition-colors" @click="showDxtModal = false">取消</button>
        <button
          class="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded transition-colors disabled:opacity-40"
          :disabled="!dxtConfigPath || dxtInstalling"
          @click="executeDxtInstall"
        >
          {{ dxtInstalling ? '安装中...' : '安装' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 操作日志面板 -->
  <div
    v-if="showLogPanel"
    class="fixed bottom-0 right-0 w-[480px] h-[320px] bg-neutral-900 border-l border-t border-forge-border shadow-2xl z-40 flex flex-col rounded-tl-xl"
  >
    <div class="flex items-center justify-between px-4 py-2 border-b border-forge-border shrink-0">
      <h3 class="text-sm font-bold text-white">操作日志</h3>
      <div class="flex gap-2">
        <button
          class="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
          @click="clearLogs"
        >
          清空
        </button>
        <button
          class="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
          @click="loadLogs"
        >
          刷新
        </button>
        <button
          class="text-neutral-500 hover:text-neutral-300 transition-colors"
          @click="showLogPanel = false"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <div v-if="logEntries.length === 0" class="text-center py-8 text-xs text-neutral-600">
        暂无操作日志
      </div>
      <div
        v-for="log in logEntries"
        :key="log.id"
        class="flex items-start gap-2 px-2 py-1.5 hover:bg-neutral-800/50 rounded text-[11px]"
      >
        <span class="text-neutral-600 shrink-0 font-mono">{{ formatLogTime(log.timestamp) }}</span>
        <span
          class="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0"
          :class="{
            'bg-green-950/50 text-green-500': log.action === 'add' || log.action === 'enable' || log.action === 'import',
            'bg-red-950/50 text-red-500': log.action === 'delete' || log.action === 'disable',
            'bg-blue-950/50 text-blue-500': log.action === 'healthCheck'
          }"
        >{{ actionLabels[log.action] || log.action }}</span>
        <span class="text-neutral-300 truncate">{{ log.serverName }}</span>
        <span v-if="log.detail" class="text-neutral-600 truncate ml-auto">{{ log.detail }}</span>
      </div>
    </div>
  </div>

</template>

