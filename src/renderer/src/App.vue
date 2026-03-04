<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DashboardView from './components/DashboardView.vue'
import SkillsPanel from './components/SkillsPanel.vue'
import McpPanel from './components/McpPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const activeView = ref('dashboard')
const initialItemId = ref<string | undefined>(undefined)

const navigate = (view: string, itemId?: string) => {
  initialItemId.value = itemId
  activeView.value = view
}
</script>

<template>
  <div
    class="flex h-screen bg-forge-bg text-neutral-300 font-sans selection:bg-orange-900 selection:text-white overflow-hidden"
  >
    <!-- Sidebar -->
    <Sidebar :active-view="activeView" @navigate="navigate" />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col h-screen overflow-hidden">
      <DashboardView v-if="activeView === 'dashboard'" @navigate="navigate" />
      <SkillsPanel v-else-if="activeView === 'skills'" :initial-skill-id="initialItemId" />
      <McpPanel v-else-if="activeView === 'mcp'" :initial-server-id="initialItemId" />
      <SettingsPanel v-else-if="activeView === 'settings'" />
    </main>
  </div>
</template>
