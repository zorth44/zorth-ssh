<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-title">SSH 密钥管理</div>

      <!-- Key list -->
      <div class="key-list">
        <div v-if="!keys.length" class="empty-keys">暂无 SSH 密钥</div>
        <div v-for="k in keys" :key="k.id" class="key-item">
          <span class="key-icon">🔑</span>
          <div class="key-info">
            <div class="key-name">{{ k.name }}</div>
            <div class="key-date">{{ formatDate(k.created_at) }}</div>
          </div>
          <button class="btn btn-ghost btn-danger-text" @click="deleteKey(k)">删除</button>
        </div>
      </div>

      <hr class="divider" />

      <!-- Add key form -->
      <div class="form-group">
        <label class="form-label">密钥名称</label>
        <input v-model="form.name" placeholder="My Server Key" />
      </div>
      <div class="form-group">
        <label class="form-label">私钥内容 *</label>
        <textarea
          v-model="form.private_key"
          rows="6"
          placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
          style="font-family: monospace; font-size: 12px; resize: vertical"
        />
      </div>
      <div class="form-group">
        <label class="form-label">私钥密码（可选）</label>
        <input v-model="form.passphrase" type="password" placeholder="如果有密码保护才需填写" />
      </div>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

      <div class="form-actions">
        <button class="btn btn-ghost" @click="emit('close')">关闭</button>
        <button class="btn btn-primary" :disabled="adding" @click="addKey">
          {{ adding ? '添加中...' : '添加密钥' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const emit = defineEmits(['close'])

const keys = ref([])
const adding = ref(false)
const errorMsg = ref('')

const form = reactive({
  name: '',
  private_key: '',
  passphrase: ''
})

onMounted(loadKeys)

async function loadKeys() {
  const res = await window.api.key.list()
  if (res.success) keys.value = res.data
}

async function addKey() {
  errorMsg.value = ''
  if (!form.name.trim() || !form.private_key.trim()) {
    errorMsg.value = '请填写密钥名称和私钥内容'
    return
  }
  adding.value = true
  const res = await window.api.key.create({
    name: form.name.trim(),
    private_key: form.private_key.trim(),
    passphrase: form.passphrase || null
  })
  adding.value = false
  if (res.success) {
    form.name = ''
    form.private_key = ''
    form.passphrase = ''
    await loadKeys()
  } else {
    errorMsg.value = '添加失败：' + res.error
  }
}

async function deleteKey(k) {
  if (!confirm(`确认删除密钥「${k.name}」？\n引用此密钥的服务器将需要重新配置。`)) return
  const res = await window.api.key.delete(k.id)
  if (res.success) await loadKeys()
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.key-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.empty-keys {
  padding: 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.key-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
}

.key-icon { font-size: 14px; }

.key-info { flex: 1; min-width: 0; }

.key-name { font-size: 13px; }

.key-date { font-size: 11px; color: var(--text-muted); }

.btn-danger-text { color: var(--error); }
.btn-danger-text:hover { background: rgba(244,67,54,0.1); }
</style>
