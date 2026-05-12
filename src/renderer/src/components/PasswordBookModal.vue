<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal pb-modal">
      <div class="modal-title">
        <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="5" y="2" width="14" height="20" rx="2"/>
          <path d="M12 10v4M10 12h4"/>
          <path d="M9 7h6M9 17h3"/>
        </svg>
        密码本
        <span class="title-note">仅显示密码认证的服务器</span>
      </div>

      <div v-if="loading" class="pb-loading">加载中...</div>
      <div v-else-if="!entries.length" class="pb-empty">暂无使用密码认证的服务器</div>
      <div v-else class="pb-list">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="pb-row"
          :class="{ editing: editingId === entry.id }"
        >
          <div class="pb-info">
            <div class="pb-name">{{ entry.name }}</div>
            <div class="pb-addr">{{ entry.username }}@{{ entry.host }}</div>
          </div>

          <template v-if="editingId === entry.id">
            <input
              ref="editInputRef"
              v-model="editingPassword"
              class="pb-input"
              type="text"
              placeholder="输入新密码"
              @keyup.enter="savePassword(entry)"
              @keyup.esc="cancelEdit"
            />
            <button class="pb-btn save" :disabled="saving" @click="savePassword(entry)">
              {{ saving ? '…' : '保存' }}
            </button>
            <button class="pb-btn cancel" @click="cancelEdit">取消</button>
          </template>
          <template v-else>
            <div class="pb-pwd-wrap">
              <span class="pb-pwd" :class="{ visible: entry.shown }">
                {{ entry.shown ? (entry.plaintext ?? '…') : '••••••••' }}
              </span>
              <button class="pb-icon-btn" :title="entry.shown ? '隐藏' : '查看'" @click="toggleShow(entry)">
                <svg v-if="!entry.shown" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
            <button class="pb-btn edit" @click="startEdit(entry)">更新密码</button>
          </template>
        </div>
      </div>

      <div class="form-actions" style="margin-top: 12px">
        <button class="btn btn-ghost" @click="emit('close')">关闭</button>
        <button class="btn btn-ghost" @click="refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:13px;height:13px;margin-right:4px">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          刷新
        </button>
      </div>

      <div v-if="errorMsg" class="error-msg" style="margin-top: 8px">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { useAppStore } from '../stores/useAppStore'

const emit = defineEmits(['close'])
const store = useAppStore()

const loading = ref(true)
const entries = ref([])
const editingId = ref(null)
const editingPassword = ref('')
const saving = ref(false)
const errorMsg = ref('')
const editInputRef = ref(null)

async function load() {
  loading.value = true
  errorMsg.value = ''
  await store.loadServers()
  const pwdServers = store.servers.filter(s => s.auth_type === 'password')
  entries.value = pwdServers.map(s => ({
    id: s.id,
    name: s.name,
    host: s.host,
    username: s.username,
    shown: false,
    plaintext: null
  }))
  loading.value = false
}

async function toggleShow(entry) {
  if (entry.shown) {
    entry.shown = false
    return
  }
  if (entry.plaintext === null) {
    const res = await window.api.server.getPlaintext(entry.id)
    entry.plaintext = res.success ? res.password : '(获取失败)'
  }
  entry.shown = true
}

async function startEdit(entry) {
  if (entry.plaintext === null) {
    const res = await window.api.server.getPlaintext(entry.id)
    entry.plaintext = res.success ? res.password : ''
  }
  editingId.value = entry.id
  editingPassword.value = entry.plaintext || ''
  await nextTick()
  editInputRef.value?.focus()
}

function cancelEdit() {
  editingId.value = null
  editingPassword.value = ''
}

async function savePassword(entry) {
  if (saving.value) return
  errorMsg.value = ''
  saving.value = true
  const res = await window.api.server.updatePassword(entry.id, editingPassword.value)
  saving.value = false
  if (res.success) {
    entry.plaintext = editingPassword.value
    entry.shown = false
    cancelEdit()
    store.toast('密码已更新', 'success')
  } else {
    errorMsg.value = '保存失败：' + res.error
  }
}

async function refresh() {
  cancelEdit()
  await load()
}

onMounted(load)
</script>

<style scoped>
.pb-modal {
  width: 580px;
  max-width: 96vw;
}

.title-icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
  vertical-align: middle;
  opacity: 0.8;
}

.title-note {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  margin-left: 8px;
}

.pb-loading, .pb-empty {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.pb-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 50vh;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px;
}

.pb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.pb-row.editing {
  border-color: var(--accent);
}

.pb-info {
  flex: 0 0 180px;
  min-width: 0;
}

.pb-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pb-addr {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pb-pwd-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.pb-pwd {
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 13px;
  color: var(--text-muted);
  letter-spacing: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pb-pwd.visible {
  color: var(--text-primary);
  letter-spacing: normal;
  user-select: text;
}

.pb-icon-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
}

.pb-icon-btn svg {
  width: 14px;
  height: 14px;
}

.pb-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.pb-input {
  flex: 1;
  height: 28px;
  font-size: 13px;
  padding: 0 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'Consolas', 'Menlo', monospace;
}

.pb-input:focus {
  outline: none;
  border-color: var(--accent);
}

.pb-btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.1s;
}

.pb-btn.edit {
  background: var(--bg-hover);
  color: var(--text-secondary);
}
.pb-btn.edit:hover {
  background: var(--accent);
  color: #fff;
}

.pb-btn.save {
  background: var(--accent);
  color: #fff;
}
.pb-btn.save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pb-btn.cancel {
  background: transparent;
  color: var(--text-muted);
  border-color: var(--border);
}
.pb-btn.cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
