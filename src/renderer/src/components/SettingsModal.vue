<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-title">设置</div>

      <div class="section-title">MySQL 数据库连接</div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">主机地址</label>
          <input v-model="form.host" placeholder="localhost" />
        </div>
        <div class="form-group" style="flex: 0 0 90px">
          <label class="form-label">端口</label>
          <input v-model.number="form.port" type="number" placeholder="3306" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">数据库名</label>
        <input v-model="form.database" placeholder="zorth_ssh" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input v-model="form.user" placeholder="root" />
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input v-model="form.password" type="password" placeholder="(空)" />
        </div>
      </div>

      <hr class="divider" />

      <div class="section-title">加密配置</div>
      <div class="form-group">
        <label class="form-label">团队共享密钥</label>
        <input v-model="form.encryptionKey" placeholder="与团队成员保持一致" />
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px">
          修改此密钥后，已存储的密码将无法正确解密，需重新录入
        </div>
      </div>

      <div v-if="msg" class="error-msg" :class="{ 'success-msg': msgType === 'success' }">
        {{ msg }}
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" :disabled="testing" @click="testDb">
          {{ testing ? '测试中...' : '测试连接' }}
        </button>
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

const emit = defineEmits(['close', 'saved'])

const form = reactive({
  host: '',
  port: 3306,
  database: '',
  user: '',
  password: '',
  encryptionKey: ''
})

const testing = ref(false)
const saving = ref(false)
const msg = ref('')
const msgType = ref('error')

onMounted(async () => {
  const config = await window.api.settings.get()
  if (config) {
    Object.assign(form, config.mysql)
    form.encryptionKey = config.encryptionKey || ''
  }
})

async function testDb() {
  msg.value = ''
  testing.value = true
  const res = await window.api.settings.testDb({
    host: form.host,
    port: form.port,
    database: form.database,
    user: form.user,
    password: form.password
  })
  testing.value = false
  msgType.value = res.success ? 'success' : 'error'
  msg.value = res.success ? '连接成功！' : '连接失败：' + res.error
}

async function save() {
  msg.value = ''
  saving.value = true
  const res = await window.api.settings.save({
    mysql: {
      host: form.host,
      port: form.port,
      database: form.database,
      user: form.user,
      password: form.password
    },
    encryptionKey: form.encryptionKey
  })
  saving.value = false
  if (res.success) {
    emit('saved')
  } else {
    msgType.value = 'error'
    msg.value = '保存失败：' + res.error
  }
}
</script>

<style scoped>
.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.form-row {
  display: flex;
  gap: 10px;
}
.form-row > * { flex: 1; }
</style>
