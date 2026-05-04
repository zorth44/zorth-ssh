<template>
  <div class="file-pane">
    <!-- Header -->
    <div class="pane-header">
      <span class="pane-title">{{ title }}</span>
      <div class="pane-tools">
        <button class="btn btn-ghost" title="新建文件夹" @click="startCreate">+ 文件夹</button>
        <button class="btn btn-ghost" :disabled="!selected.size" title="删除" @click="doDelete">删除</button>
        <button class="btn btn-ghost" :disabled="selected.size !== 1" title="重命名" @click="startRename">重命名</button>
        <button class="btn btn-ghost" title="刷新" @click="refresh">↻</button>
      </div>
    </div>

    <!-- Path bar -->
    <div class="path-bar">
      <button class="path-up" :disabled="isRoot" @click="navigateUp" title="上级目录">↑</button>
      <input
        class="path-input"
        :value="currentPath"
        @keyup.enter="navigateTo($event.target.value)"
        @blur="$event.target.value = currentPath"
      />
    </div>

    <!-- File list -->
    <div class="file-list" @click.self="clearSelect">
      <div v-if="loading" class="pane-hint">加载中...</div>
      <div v-else-if="error" class="pane-hint error">{{ error }}</div>
      <div v-else-if="!entries.length" class="pane-hint">（空目录）</div>

      <!-- New folder row -->
      <div v-if="creating" class="file-item creating">
        <span class="fi-icon">📁</span>
        <input
          ref="createInput"
          v-model="createName"
          class="fi-rename-input"
          placeholder="文件夹名称"
          @keyup.enter="confirmCreate"
          @keyup.escape="creating = false"
          @blur="creating = false"
        />
      </div>

      <div
        v-for="entry in entries"
        :key="entry.name"
        class="file-item"
        :class="{ selected: selected.has(entry.name) }"
        @click.exact="selectOne(entry)"
        @click.ctrl.exact="toggleSelect(entry)"
        @click.meta.exact="toggleSelect(entry)"
        @dblclick="onDblClick(entry)"
      >
        <span class="fi-icon">{{ entryIcon(entry) }}</span>

        <!-- Rename input -->
        <input
          v-if="renamingEntry?.name === entry.name"
          ref="renameInput"
          v-model="renameName"
          class="fi-rename-input"
          @keyup.enter="confirmRename"
          @keyup.escape="renamingEntry = null"
          @blur="renamingEntry = null"
          @click.stop
        />
        <span v-else class="fi-name">{{ entry.name }}</span>

        <span class="fi-size">{{ entry.isDir ? '' : formatSize(entry.size) }}</span>
        <span class="fi-date">{{ formatDate(entry.modifiedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  title: String,
  type: { type: String, default: 'local' },  // 'local' | 'remote'
  sessionId: { type: String, default: null },
  initialPath: { type: String, default: null }
})

const emit = defineEmits(['path-change', 'selection-change'])

const currentPath = ref('')
const entries = ref([])
const selected = ref(new Set())
const loading = ref(false)
const error = ref('')
const creating = ref(false)
const createName = ref('')
const createInput = ref(null)
const renamingEntry = ref(null)
const renameName = ref('')
const renameInput = ref(null)

const isRoot = computed(() => {
  const p = currentPath.value
  return p === '/' || /^[A-Z]:\\?$/i.test(p)
})

onMounted(async () => {
  if (props.type === 'remote' && props.sessionId) {
    const res = await window.api.sftp.realpath(props.sessionId, '.')
    await navigateTo(res.success ? res.path : '/')
  } else {
    const home = props.initialPath || await window.api.sftp.homeLocal()
    await navigateTo(home)
  }
})

watch(() => props.sessionId, async (id) => {
  if (props.type === 'remote' && id) {
    const res = await window.api.sftp.realpath(id, '.')
    await navigateTo(res.success ? res.path : '/')
  }
})

async function navigateTo(p) {
  if (!p) return
  loading.value = true
  error.value = ''
  selected.value = new Set()
  let res
  if (props.type === 'remote') {
    res = await window.api.sftp.listRemote(props.sessionId, p)
  } else {
    res = await window.api.sftp.listLocal(p)
  }
  loading.value = false
  if (res.success) {
    currentPath.value = p
    entries.value = res.data
    emit('path-change', p)
  } else {
    error.value = res.error
  }
}

function navigateUp() {
  const p = currentPath.value
  if (props.type === 'local' && /^[A-Z]:\\$/i.test(p)) return
  const parent = p.endsWith('/')
    ? p.slice(0, p.lastIndexOf('/', p.length - 2) + 1) || '/'
    : p.includes('/')
      ? p.slice(0, p.lastIndexOf('/')) || '/'
      : p.replace(/\\[^\\]+\\?$/, '') || p
  navigateTo(parent || '/')
}

function refresh() {
  navigateTo(currentPath.value)
}

function onDblClick(entry) {
  if (entry.isDir) {
    const sep = props.type === 'remote' ? '/' : (currentPath.value.includes('\\') ? '\\' : '/')
    const base = currentPath.value.endsWith(sep) ? currentPath.value : currentPath.value + sep
    navigateTo(base + entry.name)
  }
}

function selectOne(entry) {
  selected.value = new Set([entry.name])
  emit('selection-change', [entry])
}

function toggleSelect(entry) {
  const s = new Set(selected.value)
  s.has(entry.name) ? s.delete(entry.name) : s.add(entry.name)
  selected.value = s
  emit('selection-change', entries.value.filter(e => s.has(e.name)))
}

function clearSelect() {
  selected.value = new Set()
  emit('selection-change', [])
}

function startCreate() {
  creating.value = true
  createName.value = ''
  nextTick(() => createInput.value?.focus())
}

async function confirmCreate() {
  const name = createName.value.trim()
  creating.value = false
  if (!name) return
  const sep = props.type === 'remote' ? '/' : (currentPath.value.includes('\\') ? '\\' : '/')
  const base = currentPath.value.endsWith(sep) ? currentPath.value : currentPath.value + sep
  const newPath = base + name
  let res
  if (props.type === 'remote') {
    res = await window.api.sftp.mkdirRemote(props.sessionId, newPath)
  } else {
    res = await window.api.sftp.mkdirLocal(newPath)
  }
  if (res.success) refresh()
}

function startRename() {
  if (selected.value.size !== 1) return
  const name = [...selected.value][0]
  renamingEntry.value = entries.value.find(e => e.name === name)
  renameName.value = name
  nextTick(() => renameInput.value?.focus())
}

async function confirmRename() {
  const entry = renamingEntry.value
  const newName = renameName.value.trim()
  renamingEntry.value = null
  if (!newName || newName === entry.name) return
  const sep = props.type === 'remote' ? '/' : (currentPath.value.includes('\\') ? '\\' : '/')
  const base = currentPath.value.endsWith(sep) ? currentPath.value : currentPath.value + sep
  const oldPath = base + entry.name
  const newPath = base + newName
  let res
  if (props.type === 'remote') {
    res = await window.api.sftp.renameRemote(props.sessionId, oldPath, newPath)
  } else {
    res = await window.api.sftp.renameLocal(oldPath, newPath)
  }
  if (res.success) refresh()
}

async function doDelete() {
  if (!selected.value.size) return
  const names = [...selected.value]
  if (!confirm(`确认删除 ${names.length} 个项目？此操作不可撤销。`)) return
  const sep = props.type === 'remote' ? '/' : (currentPath.value.includes('\\') ? '\\' : '/')
  const base = currentPath.value.endsWith(sep) ? currentPath.value : currentPath.value + sep
  let res
  if (props.type === 'remote') {
    const ents = names.map(n => {
      const e = entries.value.find(x => x.name === n)
      return { path: base + n, isDir: e?.isDir || false }
    })
    res = await window.api.sftp.deleteRemote(props.sessionId, ents)
  } else {
    res = await window.api.sftp.deleteLocal(names.map(n => base + n))
  }
  if (res.success) { selected.value = new Set(); refresh() }
}

// Expose for FileManager to call
defineExpose({ currentPath, selected, entries, refresh, navigateTo })

function entryIcon(entry) {
  if (entry.isDir) return '📁'
  const ext = entry.name.split('.').pop().toLowerCase()
  if (['jpg','jpeg','png','gif','svg','webp','bmp'].includes(ext)) return '🖼'
  if (['mp4','mkv','avi','mov','wmv'].includes(ext)) return '🎬'
  if (['mp3','wav','flac','ogg'].includes(ext)) return '🎵'
  if (['zip','tar','gz','bz2','rar','7z','xz'].includes(ext)) return '📦'
  if (['js','ts','vue','py','go','java','c','cpp','h','rs','rb','php'].includes(ext)) return '📝'
  if (['log'].includes(ext)) return '📋'
  if (['pdf'].includes(ext)) return '📕'
  if (['sh','bash','zsh'].includes(ext)) return '⚙'
  return '📄'
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3)
  return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i]
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.file-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  background: var(--bg-primary);
  overflow: hidden;
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.pane-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.pane-tools {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.pane-tools .btn-ghost {
  padding: 3px 8px;
  font-size: 12px;
}

.path-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.path-up {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}
.path-up:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.path-up:disabled { opacity: 0.3; cursor: default; }

.path-input {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 3px 8px;
  font-size: 12px;
  font-family: monospace;
  color: var(--text-primary);
  outline: none;
}
.path-input:focus { border-color: var(--accent); }

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px;
}

.pane-hint {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
.pane-hint.error { color: var(--error); }

.file-item {
  display: grid;
  grid-template-columns: 20px 1fr auto auto;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s;
}
.file-item:hover { background: var(--bg-hover); }
.file-item.selected { background: var(--bg-active); }
.file-item.creating { cursor: default; }

.fi-icon { font-size: 13px; }

.fi-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fi-rename-input {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--accent);
  border-radius: 2px;
  padding: 1px 4px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  min-width: 0;
}

.fi-size {
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
  text-align: right;
  min-width: 50px;
}

.fi-date {
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
  min-width: 70px;
  text-align: right;
}
</style>
