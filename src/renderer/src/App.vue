<template>
  <div class="app-root">
    <!-- Title bar -->
    <div class="titlebar">
      <div class="titlebar-drag">
        <span class="app-logo">⚡</span>
        <span class="app-name">Zorth SSH</span>
      </div>
      <div class="titlebar-right">
        <button class="theme-toggle" :title="theme === 'dark' ? '切换亮色主题' : '切换暗色主题'" @click="toggleTheme">
          <span class="theme-icon">{{ theme === 'dark' ? '☀' : '🌙' }}</span>
          <span class="theme-label">{{ theme === 'dark' ? '亮色' : '暗色' }}</span>
        </button>
        <div class="titlebar-sep" />
        <button class="win-btn" @click="api.window.minimize()">&#8212;</button>
        <button class="win-btn" @click="api.window.maximize()">&#9633;</button>
        <button class="win-btn close" @click="api.window.close()">&#10005;</button>
      </div>
    </div>

    <!-- Setup wizard -->
    <SetupWizard v-if="!ready" @done="onSetupDone" />

    <!-- Main layout -->
    <div v-else class="layout">
      <Sidebar
        @connect="store.connectServer"
        @open-fm="store.openFileManager"
        @add="openServerModal(null)"
        @edit="openServerModal"
        @settings="settingsVisible = true"
        @keys="keysVisible = true"
      />
      <div class="main-area">
        <TabBar
          :tabs="store.tabs"
          :active-id="store.activeTabId"
          @select="id => store.activeTabId = id"
          @close="store.closeTab"
        />
        <div class="terminal-area">
          <div v-if="!store.tabs.length" class="empty-hint">
            <div class="empty-icon">⚡</div>
            <div class="empty-line">双击左侧服务器 — 打开终端</div>
            <div class="empty-line">右键左侧服务器 — 文件管理器 / 编辑 / 删除</div>
          </div>
          <div
            v-for="tab in store.tabs"
            :key="tab.id"
            class="terminal-wrapper"
            :class="{ active: tab.id === store.activeTabId }"
          >
            <TerminalPane
              v-if="tab.type === 'terminal'"
              :tab="tab"
              :is-active="tab.id === store.activeTabId"
            />
            <FileManager
              v-else-if="tab.type === 'sftp'"
              :tab="tab"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ServerModal
      v-if="serverModalVisible"
      :server="editingServer"
      @close="serverModalVisible = false"
      @saved="onServerSaved"
    />
    <KeysModal v-if="keysVisible" @close="keysVisible = false" />
    <SettingsModal
      v-if="settingsVisible"
      @close="settingsVisible = false"
      @saved="onSettingsSaved"
    />

    <!-- Toasts -->
    <div class="toast-container">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.type">
        {{ t.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from './stores/useAppStore'
import { useTheme } from './composables/useTheme'
import SetupWizard from './components/SetupWizard.vue'
import Sidebar from './components/Sidebar.vue'
import TabBar from './components/TabBar.vue'
import TerminalPane from './components/TerminalPane.vue'
import FileManager from './components/FileManager.vue'
import ServerModal from './components/ServerModal.vue'
import KeysModal from './components/KeysModal.vue'
import SettingsModal from './components/SettingsModal.vue'

const api = window.api
const store = useAppStore()
const { theme, toggle: toggleTheme } = useTheme()

const ready = ref(false)
const serverModalVisible = ref(false)
const editingServer = ref(null)
const keysVisible = ref(false)
const settingsVisible = ref(false)

let unsubOutput = null
let unsubClosed = null

onMounted(async () => {
  const config = await api.settings.get()
  if (config?.mysql) {
    const res = await api.settings.initDb()
    if (res.success) {
      ready.value = true
      await store.loadServers()
    }
  }

  unsubOutput = api.terminal.onOutput((sessionId, data) => {
    store._lastOutput = { sessionId, data }
  })
  unsubClosed = api.terminal.onClosed((sessionId) => {
    store.handleSessionClosed(sessionId)
  })
})

onUnmounted(() => {
  unsubOutput?.()
  unsubClosed?.()
})

async function onSetupDone() {
  ready.value = true
  await store.loadServers()
}

function openServerModal(server) {
  editingServer.value = server || null
  serverModalVisible.value = true
}

async function onServerSaved() {
  serverModalVisible.value = false
  await store.loadServers()
  store.toast('保存成功', 'success')
}

async function onSettingsSaved() {
  settingsVisible.value = false
  await store.loadServers()
  store.toast('设置已保存', 'success')
}
</script>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--titlebar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.titlebar-drag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
}

.app-logo { font-size: 15px; }
.app-name { color: var(--text-primary); }

.titlebar-right {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.titlebar-sep {
  width: 1px;
  height: 16px;
  background: var(--border-light);
  margin: 0 2px;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  height: var(--titlebar-height);
  padding: 0 10px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  border-radius: 0;
}
.theme-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.theme-icon { font-size: 14px; line-height: 1; }
.theme-label { font-size: 12px; }

.win-btn {
  width: 46px;
  height: var(--titlebar-height);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-secondary);
  transition: background 0.1s;
}
.win-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.win-btn.close:hover { background: #c42b1c; color: #fff; }

.layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.terminal-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.terminal-wrapper {
  display: none;
  position: absolute;
  inset: 0;
}
.terminal-wrapper.active {
  display: flex;
  flex-direction: column;
}

.empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

.empty-line:first-of-type {
  color: var(--text-secondary);
  font-size: 14px;
}

.empty-line:last-of-type {
  font-size: 12px;
}

.empty-icon {
  font-size: 40px;
  opacity: 0.3;
}

.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 200;
}

.toast {
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  animation: slideIn 0.2s ease;
}
.toast.success { background: #1e4d2b; border-left: 3px solid var(--success); }
.toast.error { background: #4d1e1e; border-left: 3px solid var(--error); }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
