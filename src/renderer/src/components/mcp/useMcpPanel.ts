import { computed, ref } from 'vue'
import type {
  DxtManifestInfo,
  DxtUserConfigField,
  McpConfigFile,
  McpLogEntry,
  McpServer
} from './types'

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'
type HealthState = 'connected' | 'failed' | 'unknown'

export const useMcpPanel = () => {
  const mcpConfigs = ref<McpConfigFile[]>([])
  const selectedServer = ref<McpServer | null>(null)
  const selectedConfigPath = ref<string | null>(null)
  const isEditing = ref(false)
  const editValue = ref('')
  const searchQuery = ref('')
  const loading = ref(true)
  const saveStatus = ref<SaveStatus>('idle')
  const copyStatus = ref<Record<string, boolean>>({})
  const healthStatus = ref<Record<string, HealthState>>({})
  const healthChecking = ref(false)
  let latestHealthRequestId = 0

  const showAddForm = ref(false)
  const addForm = ref({
    name: '',
    type: 'command' as 'command' | 'http',
    command: '',
    args: '',
    url: '',
    configPath: ''
  })

  const showDeleteConfirm = ref(false)
  const deleteTarget = ref<McpServer | null>(null)

  const showImportForm = ref(false)
  const importJson = ref('')
  const importConfigPath = ref('')
  const importError = ref('')

  const showLogPanel = ref(false)
  const logEntries = ref<McpLogEntry[]>([])

  const collapsedGroups = ref<Record<string, boolean>>({})

  const allServers = computed(() => mcpConfigs.value.flatMap((cfg) => cfg.servers))

  const filteredServers = computed(() => {
    if (!searchQuery.value) return allServers.value
    const q = searchQuery.value.toLowerCase()
    return allServers.value.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        (s.url || '').toLowerCase().includes(q)
    )
  })

  const regularServers = computed(() => filteredServers.value.filter((s) => s.source !== 'plugin'))
  const pluginServers = computed(() => filteredServers.value.filter((s) => s.source === 'plugin'))
  const writableConfigs = computed(() => mcpConfigs.value.filter((c) => c.source !== 'plugin'))

  const groupedRegularServers = computed(() => {
    const groups: { label: string; path: string; servers: McpServer[] }[] = []
    const pathMap = new Map<string, McpServer[]>()

    for (const s of regularServers.value) {
      if (!pathMap.has(s.configPath)) pathMap.set(s.configPath, [])
      pathMap.get(s.configPath)!.push(s)
    }

    for (const [path, servers] of pathMap) {
      const parts = path.replace(/\\/g, '/').split('/')
      const fileName = parts.pop() || path
      const parentDir = parts.pop() || ''
      groups.push({ label: parentDir ? `${parentDir}/${fileName}` : fileName, path, servers })
    }

    return groups
  })

  const toggleGroupCollapse = (path: string) => {
    collapsedGroups.value[path] = !collapsedGroups.value[path]
  }

  const checkHealth = async () => {
    const requestId = ++latestHealthRequestId
    const serverSnapshot = allServers.value.map((server) => ({ ...server }))
    if (serverSnapshot.length === 0) {
      healthStatus.value = {}
      healthChecking.value = false
      return
    }

    healthChecking.value = true
    try {
      const result = await window.api.checkMcpHealth(serverSnapshot)
      if (requestId === latestHealthRequestId) {
        healthStatus.value = result
      }
    } catch (err) {
      console.error('Health check failed:', err)
    } finally {
      if (requestId === latestHealthRequestId) {
        healthChecking.value = false
      }
    }
  }

  const loadMcp = async () => {
    loading.value = true
    try {
      const previousSelectedId = selectedServer.value?.id ?? null
      mcpConfigs.value = await window.api.scanMcp()

      if (allServers.value.length === 0) {
        selectedServer.value = null
        selectedConfigPath.value = null
      } else if (previousSelectedId) {
        const refreshedSelected =
          allServers.value.find((server) => server.id === previousSelectedId) || allServers.value[0]
        selectedServer.value = refreshedSelected
        selectedConfigPath.value = refreshedSelected.configPath
      } else {
        selectedServer.value = allServers.value[0]
        selectedConfigPath.value = allServers.value[0].configPath
      }

      void checkHealth()
    } catch (err) {
      console.error('Failed to scan MCP:', err)
    } finally {
      loading.value = false
    }
  }

  const selectServer = (server: McpServer) => {
    selectedServer.value = server
    selectedConfigPath.value = server.configPath
    isEditing.value = false
    saveStatus.value = 'idle'
  }

  const toggleEdit = async () => {
    if (isEditing.value) {
      isEditing.value = false
      return
    }
    if (selectedServer.value?.source === 'plugin') return
    if (!selectedConfigPath.value) return

    try {
      const content = await window.api.getMcpConfig(selectedConfigPath.value)
      editValue.value = content
      isEditing.value = true
    } catch (err) {
      console.error('Failed to load MCP config:', err)
    }
  }

  const saveChanges = async () => {
    if (selectedServer.value?.source === 'plugin') return
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

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      copyStatus.value[key] = true
      setTimeout(() => {
        copyStatus.value[key] = false
      }, 1500)
    } catch {
      // ignore copy failures
    }
  }

  const openInExplorer = (path: string) => {
    window.api.openInExplorer(path)
  }

  const refresh = () => {
    selectedServer.value = null
    healthStatus.value = {}
    void loadMcp()
  }

  const handleToggle = async (server: McpServer, event: Event) => {
    event.stopPropagation()
    try {
      await window.api.toggleMcpServer(
        server.configPath,
        server.name,
        !!server.disabled,
        server.projectPath
      )
      await loadMcp()
    } catch (err) {
      console.error('Failed to toggle MCP server:', err)
    }
  }

  const openAddForm = () => {
    addForm.value = {
      name: '',
      type: 'command',
      command: '',
      args: '',
      url: '',
      configPath: writableConfigs.value[0]?.path || ''
    }
    showAddForm.value = true
  }

  const submitAddForm = async () => {
    if (!addForm.value.name || !addForm.value.configPath) return

    try {
      const config: Record<string, unknown> = {
        name: addForm.value.name,
        type: addForm.value.type
      }

      if (addForm.value.type === 'http') {
        config.url = addForm.value.url
      } else {
        config.command = addForm.value.command
        config.args = addForm.value.args
          .split(/\s+/)
          .filter((a: string) => a.length > 0)
      }

      await window.api.addMcpServer(addForm.value.configPath, config)
      showAddForm.value = false
      await loadMcp()
    } catch (err) {
      console.error('Failed to add MCP server:', err)
    }
  }

  const confirmDelete = (server: McpServer) => {
    deleteTarget.value = server
    showDeleteConfirm.value = true
  }

  const executeDelete = async () => {
    if (!deleteTarget.value) return

    try {
      await window.api.deleteMcpServer(
        deleteTarget.value.configPath,
        deleteTarget.value.name,
        deleteTarget.value.projectPath
      )
      showDeleteConfirm.value = false
      if (selectedServer.value?.id === deleteTarget.value.id) {
        selectedServer.value = null
      }
      deleteTarget.value = null
      await loadMcp()
    } catch (err) {
      console.error('Failed to delete MCP server:', err)
    }
  }

  const openImportForm = () => {
    importJson.value = ''
    importConfigPath.value = writableConfigs.value[0]?.path || ''
    importError.value = ''
    showImportForm.value = true
  }

  const submitImport = async () => {
    if (!importJson.value.trim() || !importConfigPath.value) return

    importError.value = ''
    try {
      JSON.parse(importJson.value)
    } catch {
      importError.value = 'JSON 格式错误'
      return
    }

    try {
      const result = await window.api.importMcpFromJson(importConfigPath.value, importJson.value)
      showImportForm.value = false
      await loadMcp()
      if (result.imported.length === 0) {
        importError.value = '未找到可导入的服务配置'
      }
    } catch (err) {
      importError.value = String(err)
    }
  }

  const loadLogs = async () => {
    logEntries.value = await window.api.getMcpLogs()
  }

  const toggleLogPanel = async () => {
    showLogPanel.value = !showLogPanel.value
    if (showLogPanel.value) {
      await loadLogs()
    }
  }

  const clearLogs = async () => {
    await window.api.clearMcpLogs()
    logEntries.value = []
  }

  const formatLogTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  const actionLabels: Record<string, string> = {
    add: '添加',
    delete: '删除',
    enable: '启用',
    disable: '禁用',
    import: '导入',
    healthCheck: '健康检查',
    setTools: '工具配置',
    installDxt: 'DXT 安装'
  }

  const newToolName = ref('')
  const editingTools = ref<string[]>([])

  const startEditTools = () => {
    editingTools.value = [...(selectedServer.value?.allowedTools || [])]
  }

  const addTool = () => {
    const t = newToolName.value.trim()
    if (t && !editingTools.value.includes(t)) {
      editingTools.value.push(t)
      newToolName.value = ''
    }
  }

  const removeTool = (idx: number) => {
    editingTools.value.splice(idx, 1)
  }

  const saveAllowedTools = async () => {
    if (!selectedServer.value) return

    try {
      await window.api.setAllowedTools(
        selectedServer.value.configPath,
        selectedServer.value.name,
        editingTools.value,
        selectedServer.value.projectPath
      )
      await loadMcp()
    } catch (err) {
      console.error('Failed to set allowed tools:', err)
    }
  }

  const showDxtModal = ref(false)
  const dxtFilePath = ref('')
  const dxtManifest = ref<DxtManifestInfo | null>(null)
  const dxtUserConfigFields = ref<DxtUserConfigField[]>([])
  const dxtUserConfigValues = ref<Record<string, string>>({})
  const dxtConfigPath = ref('')
  const dxtError = ref('')
  const dxtInstalling = ref(false)

  const openDxtInstall = async () => {
    dxtError.value = ''
    const filePath = await window.api.openDxtFile()
    if (!filePath) return

    try {
      dxtFilePath.value = filePath
      const result = await window.api.parseDxt(filePath)
      dxtManifest.value = result.manifest
      dxtUserConfigFields.value = result.userConfigFields

      const values: Record<string, string> = {}
      for (const f of result.userConfigFields) {
        values[f.key] = f.defaultValue || ''
      }
      dxtUserConfigValues.value = values
      dxtConfigPath.value = writableConfigs.value.length > 0 ? writableConfigs.value[0].path : ''
      showDxtModal.value = true
    } catch (err) {
      dxtError.value = String(err)
    }
  }

  const executeDxtInstall = async () => {
    if (!dxtManifest.value || !dxtConfigPath.value) return

    dxtInstalling.value = true
    dxtError.value = ''
    try {
      const hasValues = Object.keys(dxtUserConfigValues.value).length > 0
      await window.api.installDxt(
        dxtFilePath.value,
        dxtConfigPath.value,
        hasValues ? dxtUserConfigValues.value : undefined
      )
      showDxtModal.value = false
      await loadMcp()
    } catch (err) {
      dxtError.value = String(err)
    } finally {
      dxtInstalling.value = false
    }
  }

  return {
    mcpConfigs,
    selectedServer,
    selectedConfigPath,
    isEditing,
    editValue,
    searchQuery,
    loading,
    saveStatus,
    copyStatus,
    healthStatus,
    healthChecking,
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
    checkHealth,
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
    dxtFilePath,
    dxtManifest,
    dxtUserConfigFields,
    dxtUserConfigValues,
    dxtConfigPath,
    dxtError,
    dxtInstalling,
    openDxtInstall,
    executeDxtInstall
  }
}
