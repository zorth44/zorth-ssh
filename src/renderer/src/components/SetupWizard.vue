<template>
  <div class="wizard">
    <div class="wizard-card">
      <div class="wizard-logo">⚡</div>
      <h1 class="wizard-title">欢迎使用 Zorth SSH</h1>
      <p class="wizard-sub">首次使用请配置共享数据库连接</p>

      <div class="wizard-body">
        <div class="section-title">MySQL 数据库</div>

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
          <input v-model="form.encryptionKey" placeholder="所有团队成员填写相同的密钥" />
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            用于加密存储服务器密码，团队成员需使用同一个值
          </div>
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <div v-if="successMsg" class="success-msg">{{ successMsg }}</div>

        <div class="wizard-actions">
          <button class="btn btn-secondary" :disabled="testing" @click="testConnection">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? '保存中...' : '保存并启动' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const emit = defineEmits(['done'])

const form = reactive({
  host: 'localhost',
  port: 3306,
  database: 'zorth_ssh',
  user: 'root',
  password: '',
  encryptionKey: ''
})

const testing = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function testConnection() {
  errorMsg.value = ''
  successMsg.value = ''
  testing.value = true
  const res = await window.api.settings.testDb({
    host: form.host,
    port: form.port,
    database: form.database,
    user: form.user,
    password: form.password
  })
  testing.value = false
  if (res.success) {
    successMsg.value = '连接成功！'
  } else {
    errorMsg.value = '连接失败：' + res.error
  }
}

async function save() {
  errorMsg.value = ''
  if (!form.host || !form.database || !form.user) {
    errorMsg.value = '请填写完整数据库信息'
    return
  }
  if (!form.encryptionKey) {
    errorMsg.value = '请填写团队共享密钥'
    return
  }
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
    emit('done')
  } else {
    errorMsg.value = '保存失败：' + res.error
  }
}
</script>

<style scoped>
.wizard {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: 24px;
}

.wizard-card {
  width: 480px;
  background: var(--bg-modal);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  padding: 32px;
}

.wizard-logo {
  font-size: 36px;
  text-align: center;
  margin-bottom: 12px;
}

.wizard-title {
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 6px;
}

.wizard-sub {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 28px;
}

.wizard-body {
  display: flex;
  flex-direction: column;
}

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

.wizard-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
