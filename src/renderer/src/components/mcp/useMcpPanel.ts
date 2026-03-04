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
    // Deep-clone to strip Vue reactive proxies which can fail IPC serialization
    const serverSnapshot = JSON.parse(JSON.stringify(allServers.value)) as typeof allServers.value
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
      console.error('[MCP] Health check failed:', err)
    } finally {
      if (requestId === latestHealthRequestId) {
        healthChecking.value = false
      }
    }
  }

  const loadMcp = async (initialServerId?: string) => {
    loading.value = true
    try {
      const previousSelectedId = selectedServer.value?.id ?? null
      mcpConfigs.value = await window.api.scanMcp()

      if (allServers.value.length === 0) {
        selectedServer.value = null
        selectedConfigPath.value = null
      } else if (initialServerId) {
        // Deep-link from dashboard: select the specified server
        const target = allServers.value.find((s) => s.id === initialServerId) || allServers.value[0]
        selectedServer.value = target
        selectedConfigPath.value = target.configPath
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

  /**
   * 在 parsed config 中找到包含指定 serverName 的 mcpServers 容器
   * 支持:
   *   - 顶层 { mcpServers: {...} }
   *   - .claude.json 格式 { projects: { [path]: { mcpServers: {...} } } }
   *   - _disabled_mcpServers
   */
  const findServerScope = (
    fullConfig: Record<string, unknown>,
    serverName: string,
    projectPath?: string
  ): { container: Record<string, unknown>; key: 'mcpServers' | '_disabled_mcpServers' } | null => {
    // 如果有 projectPath，优先在 projects[projectPath] 中查找
    if (projectPath) {
      const projects = fullConfig.projects as Record<string, Record<string, unknown>> | undefined
      if (projects && projects[projectPath]) {
        const scope = projects[projectPath]
        const mcpServers = scope.mcpServers as Record<string, unknown> | undefined
        if (mcpServers && serverName in mcpServers) {
          return { container: scope, key: 'mcpServers' }
        }
        const disabled = scope._disabled_mcpServers as Record<string, unknown> | undefined
        if (disabled && serverName in disabled) {
          return { container: scope, key: '_disabled_mcpServers' }
        }
      }
    }

    // 顶层 mcpServers
    const topMcp = fullConfig.mcpServers as Record<string, unknown> | undefined
    if (topMcp && serverName in topMcp) {
      return { container: fullConfig, key: 'mcpServers' }
    }
    const topDisabled = fullConfig._disabled_mcpServers as Record<string, unknown> | undefined
    if (topDisabled && serverName in topDisabled) {
      return { container: fullConfig, key: '_disabled_mcpServers' }
    }

    // 遍历所有 projects
    const projects = fullConfig.projects as Record<string, Record<string, unknown>> | undefined
    if (projects) {
      for (const pConfig of Object.values(projects)) {
        if (!pConfig || typeof pConfig !== 'object') continue
        const mcpSrv = pConfig.mcpServers as Record<string, unknown> | undefined
        if (mcpSrv && serverName in mcpSrv) {
          return { container: pConfig, key: 'mcpServers' }
        }
        const disSrv = pConfig._disabled_mcpServers as Record<string, unknown> | undefined
        if (disSrv && serverName in disSrv) {
          return { container: pConfig, key: '_disabled_mcpServers' }
        }
      }
    }

    return null
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
      const serverName = selectedServer.value?.name
      if (!serverName) return

      const fullConfig = JSON.parse(content)
      const scope = findServerScope(fullConfig, serverName, selectedServer.value?.projectPath)

      if (scope) {
        const servers = scope.container[scope.key] as Record<string, unknown>
        const serverConfig = servers[serverName]
        editValue.value = JSON.stringify({ [serverName]: serverConfig }, null, 2)
      } else {
        // fallback：显示整个文件
        editValue.value = content
      }
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
      let editedObj: unknown
      try {
        editedObj = JSON.parse(editValue.value)
      } catch {
        throw new Error('JSON 格式错误，请检查后重试')
      }

      // 结构校验：必须是纯对象
      if (editedObj === null || typeof editedObj !== 'object' || Array.isArray(editedObj)) {
        throw new Error('配置必须是 JSON 对象（不能是数组或原始类型）')
      }

      const editedRecord = editedObj as Record<string, unknown>
      const editedKeys = Object.keys(editedRecord)

      // 单服务编辑模式：限制只能有 1 个 key
      if (editedKeys.length === 0) {
        throw new Error('配置不能为空对象，请至少保留服务名称')
      }
      if (editedKeys.length > 1) {
        throw new Error(`单服务编辑模式只允许 1 个顶层 key，当前有 ${editedKeys.length} 个`)
      }

      // server config 值必须是对象
      const serverConfigValue = editedRecord[editedKeys[0]]
      if (
        serverConfigValue === null ||
        typeof serverConfigValue !== 'object' ||
        Array.isArray(serverConfigValue)
      ) {
        throw new Error('服务配置值必须是 JSON 对象（如 { "command": "...", "args": [...] }）')
      }

      const fullContent = await window.api.getMcpConfig(selectedConfigPath.value)
      const fullConfig = JSON.parse(fullContent)

      const oldName = selectedServer.value?.name
      const scope = oldName
        ? findServerScope(fullConfig, oldName, selectedServer.value?.projectPath)
        : null

      if (scope && oldName) {
        const servers = scope.container[scope.key] as Record<string, unknown>
        const newName = editedKeys[0]

        // 重命名冲突检测：如果目标名称已存在，阻止覆盖
        if (newName !== oldName && servers[newName]) {
          throw new Error(`服务名 "${newName}" 已存在，请使用其他名称`)
        }

        // 如果重命名了 server，删除旧的
        if (newName !== oldName) {
          delete servers[oldName]
        }
        // 写入新配置（仅一个 key）
        servers[newName] = editedRecord[newName]
      } else {
        // fallback：确保顶层 mcpServers 存在并合并（仅一个 key）
        if (!fullConfig.mcpServers) fullConfig.mcpServers = {}
        fullConfig.mcpServers[editedKeys[0]] = editedRecord[editedKeys[0]]
      }

      const mergedContent = JSON.stringify(fullConfig, null, 2)
      await window.api.saveMcpConfig(selectedConfigPath.value, mergedContent)
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
        config.args = addForm.value.args.split(/\s+/).filter((a: string) => a.length > 0)
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
      // Vue reactive Proxy 对象无法通过 Electron IPC 结构化克隆，需转换为普通对象
      const plainConfigValues = hasValues
        ? Object.fromEntries(Object.entries(dxtUserConfigValues.value))
        : undefined
      await window.api.installDxt(
        String(dxtFilePath.value),
        String(dxtConfigPath.value),
        plainConfigValues
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
