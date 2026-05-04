import { Client } from 'ssh2'
import { randomUUID } from 'crypto'
import { query } from '../db'
import { decrypt } from '../crypto'
import { loadConfig } from './settings'

const sessions = new Map()

function getSecret() {
  return loadConfig()?.encryptionKey || 'zorth-default'
}

export function registerTerminalIpc(ipcMain, win) {
  ipcMain.handle('terminal:connect', async (_, serverId) => {
    try {
      const rows = await query('SELECT * FROM servers WHERE id=?', [serverId])
      if (!rows.length) return { success: false, error: '服务器不存在' }
      const server = rows[0]
      const secret = getSecret()
      const sessionId = randomUUID()

      const connOpts = {
        host: server.host,
        port: server.port || 22,
        username: server.username,
        readyTimeout: 15000,
        keepaliveInterval: 10000
      }

      if (server.auth_type === 'key' && server.key_id) {
        const keyRows = await query('SELECT * FROM ssh_keys WHERE id=?', [server.key_id])
        if (keyRows.length) {
          connOpts.privateKey = decrypt(keyRows[0].private_key, secret)
          if (keyRows[0].passphrase) {
            connOpts.passphrase = decrypt(keyRows[0].passphrase, secret)
          }
        }
      } else {
        connOpts.password = decrypt(server.password, secret)
      }

      return new Promise((resolve) => {
        const conn = new Client()

        conn.on('ready', () => {
          conn.shell({ term: 'xterm-256color' }, (err, stream) => {
            if (err) {
              conn.end()
              return resolve({ success: false, error: err.message })
            }

            sessions.set(sessionId, { conn, stream, serverId })

            stream.on('data', (data) => {
              if (!win.isDestroyed()) {
                win.webContents.send('terminal:output', {
                  sessionId,
                  data: Buffer.from(data).toString('base64')
                })
              }
            })

            stream.stderr.on('data', (data) => {
              if (!win.isDestroyed()) {
                win.webContents.send('terminal:output', {
                  sessionId,
                  data: Buffer.from(data).toString('base64')
                })
              }
            })

            stream.on('close', () => {
              sessions.delete(sessionId)
              if (!win.isDestroyed()) {
                win.webContents.send('terminal:closed', { sessionId })
              }
              conn.end()
            })

            resolve({ success: true, sessionId })
          })
        })

        conn.on('error', (err) => {
          resolve({ success: false, error: err.message })
        })

        conn.connect(connOpts)
      })
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.on('terminal:input', (_, { sessionId, data }) => {
    sessions.get(sessionId)?.stream.write(data)
  })

  ipcMain.on('terminal:resize', (_, { sessionId, cols, rows }) => {
    sessions.get(sessionId)?.stream.setWindow(rows, cols, 0, 0)
  })

  ipcMain.handle('terminal:disconnect', (_, sessionId) => {
    const session = sessions.get(sessionId)
    if (session) {
      try { session.stream.close() } catch {}
      try { session.conn.end() } catch {}
      sessions.delete(sessionId)
    }
    return { success: true }
  })
}
