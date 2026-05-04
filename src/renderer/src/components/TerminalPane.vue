<template>
  <div class="pane" @click="termFocus">
    <!-- Terminal container — always in DOM so xterm has real dimensions -->
    <div ref="termEl" class="xterm-wrap" />

    <!-- Status overlay — covers terminal when not connected -->
    <div v-if="tab.status !== 'connected'" class="status-overlay">
      <template v-if="tab.status === 'connecting'">
        <div class="spin">◌</div>
        <div>正在连接 {{ tab.host }}...</div>
      </template>

      <template v-else-if="tab.status === 'error'">
        <div class="status-icon err">✕</div>
        <div>连接失败</div>
        <div class="status-detail">{{ tab.error }}</div>
        <button class="btn btn-secondary" style="margin-top:12px" @click.stop="reconnect">重试</button>
      </template>

      <template v-else-if="tab.status === 'disconnected'">
        <div class="status-icon">○</div>
        <div>连接已断开</div>
        <button class="btn btn-secondary" style="margin-top:12px" @click.stop="reconnect">重新连接</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAppStore } from '../stores/useAppStore'

const props = defineProps({
  tab: { type: Object, required: true },
  isActive: { type: Boolean, default: false }
})

const store = useAppStore()
const termEl = ref(null)
let term = null
let fitAddon = null
let resizeObserver = null
let unsubOutput = null
let unsubClosed = null

onMounted(() => {
  term = new Terminal({
    theme: {
      background: '#0d0d0d',
      foreground: '#f0f0f0',
      cursor: '#4f9eff',
      selectionBackground: '#264f78'
    },
    fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.2,
    cursorBlink: true,
    allowProposedApi: true
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)

  // Open into a real, visible container — no display:none here
  term.open(termEl.value)

  term.onData((data) => {
    if (props.tab.sessionId) {
      window.api.terminal.input(props.tab.sessionId, data)
    }
  })

  term.onResize(({ cols, rows }) => {
    if (props.tab.sessionId) {
      window.api.terminal.resize(props.tab.sessionId, cols, rows)
    }
  })

  resizeObserver = new ResizeObserver(() => {
    if (props.tab.status === 'connected') fitAddon.fit()
  })
  resizeObserver.observe(termEl.value)

  unsubOutput = window.api.terminal.onOutput((sessionId, data) => {
    if (sessionId === props.tab.sessionId && term) {
      term.write(Uint8Array.from(atob(data), c => c.charCodeAt(0)))
    }
  })

  unsubClosed = window.api.terminal.onClosed((sessionId) => {
    if (sessionId === props.tab.sessionId) {
      store.handleSessionClosed(sessionId)
    }
  })

  // Already connected when component mounts (e.g. tab switch)
  if (props.tab.status === 'connected') {
    requestAnimationFrame(() => { fitAddon.fit(); term.focus() })
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  unsubOutput?.()
  unsubClosed?.()
  term?.dispose()
})

watch(() => props.tab.status, (status) => {
  if (status === 'connected') {
    requestAnimationFrame(() => { fitAddon?.fit(); term?.focus() })
  }
})

watch(() => props.isActive, (active) => {
  if (active && props.tab.status === 'connected') {
    requestAnimationFrame(() => { fitAddon?.fit(); term?.focus() })
  }
})

function termFocus() {
  if (props.tab.status === 'connected') term?.focus()
}

async function reconnect() {
  props.tab.status = 'connecting'
  props.tab.error = null
  term?.clear()
  const res = await window.api.terminal.connect(props.tab.serverId)
  if (res.success) {
    props.tab.sessionId = res.sessionId
    props.tab.status = 'connected'
  } else {
    props.tab.status = 'error'
    props.tab.error = res.error
  }
}
</script>

<style scoped>
.pane {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #0d0d0d;
  overflow: hidden;
}

.xterm-wrap {
  flex: 1;
  padding: 6px;
  overflow: hidden;
}

/* Overlay sits on top of terminal, covers it completely */
.status-overlay {
  position: absolute;
  inset: 0;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 14px;
  z-index: 1;
}

.spin {
  font-size: 28px;
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-icon { font-size: 28px; opacity: 0.5; }
.status-icon.err { color: var(--error); opacity: 1; }

.status-detail {
  font-size: 12px;
  color: var(--text-muted);
  max-width: 320px;
  text-align: center;
  word-break: break-all;
}

:deep(.xterm) { height: 100%; }
:deep(.xterm-viewport) { overflow-y: auto !important; }
</style>
