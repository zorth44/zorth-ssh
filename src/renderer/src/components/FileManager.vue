<template>
  <div class="fm">
    <!-- Connecting / error state -->
    <div v-if="tab.status !== 'connected'" class="fm-status">
      <div v-if="tab.status === 'connecting'" class="spin">◌</div>
      <div v-else class="status-icon">✕</div>
      <div>{{ tab.status === 'connecting' ? '正在建立 SFTP 连接...' : '连接失败' }}</div>
      <div v-if="tab.error" class="status-detail">{{ tab.error }}</div>
    </div>

    <template v-else>
      <!-- Dual pane area -->
      <div class="pane-area">
        <FilePane
          ref="localPane"
          title="本地"
          type="local"
          @path-change="localPath = $event"
          @selection-change="localSelected = $event"
        />

        <!-- Transfer controls -->
        <div class="transfer-col">
          <button
            class="transfer-btn"
            :disabled="!localSelected.length || transferring"
            title="上传选中文件到远端当前目录"
            @click="upload"
          >
            →
          </button>
          <button
            class="transfer-btn"
            :disabled="!remoteSelected.length || transferring"
            title="下载选中文件到本地当前目录"
            @click="download"
          >
            ←
          </button>
        </div>

        <FilePane
          ref="remotePane"
          :title="`远端 · ${tab.host}`"
          type="remote"
          :session-id="tab.sftpSessionId"
          @path-change="remotePath = $event"
          @selection-change="remoteSelected = $event"
        />
      </div>

      <!-- Transfer queue -->
      <div v-if="transfers.length" class="transfer-queue">
        <div v-for="t in transfers" :key="t.id" class="transfer-item">
          <span class="t-direction">{{ t.direction === 'upload' ? '↑' : '↓' }}</span>
          <span class="t-name">{{ t.filename }}</span>
          <div class="t-bar-wrap">
            <div class="t-bar" :style="{ width: t.percent + '%' }" :class="{ done: t.done, error: t.error }" />
          </div>
          <span class="t-pct">
            <template v-if="t.error">失败</template>
            <template v-else-if="t.done">✓</template>
            <template v-else>{{ t.percent }}%</template>
          </span>
          <button v-if="t.done || t.error" class="t-clear" @click="removeTransfer(t.id)">✕</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import FilePane from './FilePane.vue'

const props = defineProps({ tab: { type: Object, required: true } })

const localPane = ref(null)
const remotePane = ref(null)
const localPath = ref('')
const remotePath = ref('')
const localSelected = ref([])
const remoteSelected = ref([])
const transfers = ref([])
const transferring = ref(false)

let unsubProgress = null

onMounted(() => {
  unsubProgress = window.api.sftp.onProgress((data) => {
    const existing = transfers.value.find(t => t.id === data.transferId)
    if (!existing) {
      transfers.value.push({
        id: data.transferId,
        filename: data.filename,
        direction: data.direction,
        percent: 0,
        done: false,
        error: null
      })
    } else {
      if (data.total > 0) {
        existing.percent = Math.round((data.transferred / data.total) * 100)
      }
      if (data.done) {
        existing.percent = 100
        existing.done = true
        existing.error = data.error || null
        if (!data.error) {
          // auto-remove after 3s
          setTimeout(() => removeTransfer(data.transferId), 3000)
        }
      }
    }
  })
})

onUnmounted(() => {
  unsubProgress?.()
})

function removeTransfer(id) {
  transfers.value = transfers.value.filter(t => t.id !== id)
}

async function upload() {
  if (!localSelected.value.length) return
  const remoteDir = remotePath.value
  if (!remoteDir) return

  const sep = localPath.value.includes('\\') ? '\\' : '/'
  const base = localPath.value.endsWith(sep) ? localPath.value : localPath.value + sep
  const localPaths = localSelected.value
    .filter(e => !e.isDir)
    .map(e => base + e.name)

  if (!localPaths.length) return

  transferring.value = true
  await window.api.sftp.upload(props.tab.sftpSessionId, localPaths, remoteDir)
  transferring.value = false
  remotePane.value?.refresh()
}

async function download() {
  if (!remoteSelected.value.length) return
  const localDir = localPath.value
  if (!localDir) return

  const sep = remotePath.value.endsWith('/') ? '' : '/'
  const remoteFiles = remoteSelected.value
    .filter(e => !e.isDir)
    .map(e => remotePath.value + sep + e.name)

  if (!remoteFiles.length) return

  transferring.value = true
  await window.api.sftp.download(props.tab.sftpSessionId, remoteFiles, localDir)
  transferring.value = false
  localPane.value?.refresh()
}
</script>

<style scoped>
.fm {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.fm-status {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 14px;
}

.spin {
  font-size: 28px;
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-icon { font-size: 28px; color: var(--error); }

.status-detail { font-size: 12px; color: var(--text-muted); }

.pane-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
}

.transfer-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 6px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  flex-shrink: 0;
}

.transfer-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.15s;
  border: none;
}
.transfer-btn:hover:not(:disabled) { background: var(--accent); }
.transfer-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* Transfer queue */
.transfer-queue {
  flex-shrink: 0;
  max-height: 120px;
  overflow-y: auto;
  background: var(--bg-secondary);
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.transfer-item {
  display: grid;
  grid-template-columns: 16px 1fr 140px 36px 20px;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
  font-size: 12px;
  border-radius: 3px;
}
.transfer-item:hover { background: var(--bg-hover); }

.t-direction {
  color: var(--accent);
  font-weight: bold;
}

.t-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.t-bar-wrap {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.t-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.2s;
}
.t-bar.done { background: var(--success); }
.t-bar.error { background: var(--error); }

.t-pct {
  text-align: right;
  color: var(--text-muted);
  font-size: 11px;
}

.t-clear {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-muted);
  border-radius: 2px;
  cursor: pointer;
}
.t-clear:hover { background: var(--bg-hover); color: var(--text-primary); }
</style>
