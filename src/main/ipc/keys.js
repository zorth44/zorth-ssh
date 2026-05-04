import { query } from '../db'
import { encrypt } from '../crypto'
import { loadConfig } from './settings'

function getSecret() {
  return loadConfig()?.encryptionKey || 'zorth-default'
}

export function registerKeysIpc(ipcMain) {
  ipcMain.handle('key:list', async () => {
    try {
      const rows = await query('SELECT id, name, created_at FROM ssh_keys ORDER BY name')
      return { success: true, data: rows }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('key:create', async (_, keyData) => {
    try {
      const secret = getSecret()
      const encKey = encrypt(keyData.private_key, secret)
      const encPass = keyData.passphrase ? encrypt(keyData.passphrase, secret) : null
      const result = await query(
        'INSERT INTO ssh_keys (name, private_key, passphrase) VALUES (?, ?, ?)',
        [keyData.name, encKey, encPass]
      )
      return { success: true, id: result.insertId }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('key:delete', async (_, id) => {
    try {
      await query('UPDATE servers SET key_id=NULL WHERE key_id=?', [id])
      await query('DELETE FROM ssh_keys WHERE id=?', [id])
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
