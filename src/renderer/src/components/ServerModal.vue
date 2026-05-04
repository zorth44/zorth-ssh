<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal" style="width: 500px">
      <div class="modal-title">{{ server?.id ? '编辑服务器' : '新建服务器' }}</div>

      <div class="form-group">
        <label class="form-label">名称 *</label>
        <input v-model="form.name" placeholder="生产-Web01" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">主机地址 *</label>
          <input v-model="form.host" placeholder="192.168.1.100" />
        </div>
        <div class="form-group" style="flex: 0 0 90px">
          <label class="form-label">端口</label>
          <input v-model.number="form.port" type="number" placeholder="22" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">用户名 *</label>
        <input v-model="form.username" placeholder="root" />
      </div>

      <div class="form-group">
        <label class="form-label">认证方式</label>
        <div class="radio-group">
          <label class="radio-label">
            <input v-model="form.auth_type" type="radio" value="password" />
            <span>密码</span>
          </label>
          <label class="radio-label">
            <input v-model="form.auth_type" type="radio" value="key" />
            <span>SSH Key</span>
          </label>
        </div>
      </div>

      <div v-if="form.auth_type === 'password'" class="form-group">
        <label class="form-label">密码</label>
        <input v-model="form.password" type="password" placeholder="留空则连接时输入" />
      </div>

      <div v-else class="form-group">
        <label class="form-label">SSH Key</label>
        <select v-model="form.key_id">
          <option :value="null">— 选择密钥 —</option>
          <option v-for="k in keys" :key="k.id" :value="k.id">{{ k.name }}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">分组</label>
        <div class="group-row">
          <select v-model="form.group_id" style="flex: 1">
            <option :value="null">— 不分组 —</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <button class="btn btn-ghost" style="flex-shrink: 0" @click="newGroupVisible = true">+ 新建</button>
        </div>
        <div v-if="newGroupVisible" class="new-group-row">
          <input v-model="newGroupName" placeholder="分组名称" @keyup.enter="addGroup" />
          <button class="btn btn-primary" style="flex-shrink: 0" @click="addGroup">确定</button>
          <button class="btn btn-ghost" style="flex-shrink: 0" @click="newGroupVisible = false">取消</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">标签（逗号分隔）</label>
        <input v-model="form.tags" placeholder="nginx, production" />
      </div>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

      <div class="form-actions">
        <button class="btn btn-ghost" @click="emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAppStore } from '../stores/useAppStore'

const props = defineProps({ server: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])
const store = useAppStore()

const keys = ref([])
const groups = ref([])
const saving = ref(false)
const errorMsg = ref('')
const newGroupVisible = ref(false)
const newGroupName = ref('')

const form = reactive({
  name: props.server?.name || '',
  host: props.server?.host || '',
  port: props.server?.port || 22,
  username: props.server?.username || '',
  auth_type: props.server?.auth_type || 'password',
  password: '',
  key_id: props.server?.key_id || null,
  group_id: props.server?.group_id || null,
  tags: props.server?.tags || ''
})

onMounted(async () => {
  const kRes = await window.api.key.list()
  if (kRes.success) keys.value = kRes.data
  const gRes = await window.api.group.list()
  if (gRes.success) groups.value = gRes.data
})

async function addGroup() {
  if (!newGroupName.value.trim()) return
  const res = await window.api.group.create(newGroupName.value.trim())
  if (res.success) {
    const gRes = await window.api.group.list()
    if (gRes.success) {
      groups.value = gRes.data
      store.groups = gRes.data
    }
    form.group_id = res.id
    newGroupName.value = ''
    newGroupVisible.value = false
  }
}

async function save() {
  errorMsg.value = ''
  if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
    errorMsg.value = '请填写名称、主机地址和用户名'
    return
  }
  saving.value = true
  const payload = { ...form }
  if (props.server?.id) payload.id = props.server.id

  const res = props.server?.id
    ? await window.api.server.update(payload)
    : await window.api.server.create(payload)

  saving.value = false
  if (res.success) {
    emit('saved')
  } else {
    errorMsg.value = '保存失败：' + res.error
  }
}
</script>

<style scoped>
.radio-group {
  display: flex;
  gap: 16px;
}
.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
}
.radio-label input { width: auto; cursor: pointer; }

.group-row { display: flex; gap: 8px; align-items: center; }

.new-group-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}
</style>
