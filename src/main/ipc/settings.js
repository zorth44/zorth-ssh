import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import mysql from 'mysql2/promise'
import { initDb } from '../db'

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    }
  } catch {}
  return null
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
}

export function registerSettingsIpc(ipcMain) {
  ipcMain.handle('settings:get', () => loadConfig())

  ipcMain.handle('settings:save', async (_, config) => {
    try {
      await initDb(config.mysql)
      saveConfig(config)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:test-db', async (_, mysqlConfig) => {
    let conn = null
    try {
      conn = await mysql.createConnection({
        host: mysqlConfig.host,
        port: mysqlConfig.port || 3306,
        user: mysqlConfig.user,
        password: mysqlConfig.password,
        database: mysqlConfig.database,
        connectTimeout: 5000
      })
      await conn.ping()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    } finally {
      if (conn) await conn.end().catch(() => {})
    }
  })

  ipcMain.handle('settings:init-db', async () => {
    const config = loadConfig()
    if (!config?.mysql) return { success: false, error: '配置不存在' }
    try {
      await initDb(config.mysql)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
