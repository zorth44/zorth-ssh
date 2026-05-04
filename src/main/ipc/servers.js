import { query } from '../db'
import { encrypt } from '../crypto'
import { loadConfig } from './settings'

function getSecret() {
  return loadConfig()?.encryptionKey || 'zorth-default'
}

export function registerServersIpc(ipcMain) {
  ipcMain.handle('server:list', async () => {
    try {
      const rows = await query(`
        SELECT s.*, g.name AS group_name, k.name AS key_name
        FROM servers s
        LEFT JOIN \`groups\` g ON s.group_id = g.id
        LEFT JOIN ssh_keys k ON s.key_id = k.id
        ORDER BY g.name, s.name
      `)
      return { success: true, data: rows }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('server:create', async (_, s) => {
    try {
      const encPwd = s.password ? encrypt(s.password, getSecret()) : null
      const result = await query(
        `INSERT INTO servers (name, host, port, username, auth_type, password, key_id, group_id, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.name, s.host, s.port || 22, s.username,
         s.auth_type || 'password', encPwd,
         s.key_id || null, s.group_id || null, s.tags || null]
      )
      return { success: true, id: result.insertId }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('server:update', async (_, s) => {
    try {
      const encPwd = s.password ? encrypt(s.password, getSecret()) : null
      await query(
        `UPDATE servers SET name=?, host=?, port=?, username=?, auth_type=?,
         password=?, key_id=?, group_id=?, tags=?, updated_at=NOW()
         WHERE id=?`,
        [s.name, s.host, s.port || 22, s.username,
         s.auth_type || 'password', encPwd,
         s.key_id || null, s.group_id || null, s.tags || null, s.id]
      )
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('server:delete', async (_, id) => {
    try {
      await query('DELETE FROM servers WHERE id=?', [id])
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('group:list', async () => {
    try {
      const rows = await query('SELECT * FROM `groups` ORDER BY name')
      return { success: true, data: rows }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('group:create', async (_, name) => {
    try {
      const result = await query('INSERT INTO `groups` (name) VALUES (?)', [name])
      return { success: true, id: result.insertId }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('group:delete', async (_, id) => {
    try {
      await query('UPDATE servers SET group_id=NULL WHERE group_id=?', [id])
      await query('DELETE FROM `groups` WHERE id=?', [id])
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
