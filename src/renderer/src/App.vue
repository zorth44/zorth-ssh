<template>
  <div class="app-root">
    <!-- Title bar -->
    <div class="titlebar">
      <div class="titlebar-drag">
        <svg class="app-logo" viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;color:var(--accent)">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span class="app-name">Zorth SSH</span>
      </div>
      <div class="titlebar-right">
        <button class="theme-toggle" :title="theme === 'dark' ? '切换亮色主题' : '切换暗色主题'" @click="toggleTheme">
          <svg v-if="theme === 'dark'" class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
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
        @password-book="passwordBookVisible = true"
        @refresh="store.loadServers()"
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
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" style="width:40px;height:40px;opacity:0.3">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
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
    <PasswordBookModal v-if="passwordBookVisible" @close="passwordBookVisible = false" />
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
import PasswordBookModal from './components/PasswordBookModal.vue'

const api = window.api
const store = useAppStore()
const { theme, toggle: toggleTheme } = useTheme()

const ready = ref(false)
const serverModalVisible = ref(false)
const editingServer = ref(null)
const keysVisible = ref(false)
const settingsVisible = ref(false)
const passwordBookVisible = ref(false)

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

.app-logo { flex-shrink: 0; }
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

.theme-icon { width: 14px; height: 14px; flex-shrink: 0; }
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
  line-height: 1;
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
