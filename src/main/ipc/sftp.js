import { Client } from 'ssh2'
import { randomUUID } from 'crypto'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { query } from '../db'
import { decrypt } from '../crypto'
import { loadConfig } from './settings'

const sessions = new Map()

function getSecret() {
  return loadConfig()?.encryptionKey || 'zorth-default'
}

async function buildConnOpts(serverId) {
  const rows = await query('SELECT * FROM servers WHERE id=?', [serverId])
  if (!rows.length) throw new Error('服务器不存在')
  const server = rows[0]
  const secret = getSecret()
  const opts = {
    host: server.host,
    port: server.port || 22,
    username: server.username,
    readyTimeout: 15000
  }
  if (server.auth_type === 'key' && server.key_id) {
    const keyRows = await query('SELECT * FROM ssh_keys WHERE id=?', [server.key_id])
    if (keyRows.length) {
      opts.privateKey = decrypt(keyRows[0].private_key, secret)
      if (keyRows[0].passphrase) opts.passphrase = decrypt(keyRows[0].passphrase, secret)
    }
  } else {
    opts.password = decrypt(server.password, secret)
  }
  return opts
}

export function registerSftpIpc(ipcMain, win) {
  ipcMain.handle('sftp:connect', async (_, serverId) => {
    try {
      const connOpts = await buildConnOpts(serverId)
      const sessionId = randomUUID()
      const session = await new Promise((resolve, reject) => {
        const conn = new Client()
        conn.on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) { conn.end(); return reject(err) }
            resolve({ conn, sftp })
          })
        })
        conn.on('error', reject)
        conn.connect(connOpts)
      })
      sessions.set(sessionId, session)
      return { success: true, sessionId }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('sftp:disconnect', (_, sessionId) => {
    const s = sessions.get(sessionId)
    if (s) {
      try { s.conn.end() } catch {}
      sessions.delete(sessionId)
    }
    return { success: true }
  })

  ipcMain.handle('sftp:realpath', async (_, { sessionId, remotePath }) => {
    const s = sessions.get(sessionId)
    if (!s) return { success: false, error: '会话不存在' }
    return new Promise((resolve) => {
      s.sftp.realpath(remotePath, (err, p) => {
        resolve(err ? { success: false, error: err.message } : { success: true, path: p })
      })
    })
  })

  ipcMain.handle('sftp:list-remote', async (_, { sessionId, remotePath }) => {
    const s = sessions.get(sessionId)
    if (!s) return { success: false, error: '会话不存在' }
    return new Promise((resolve) => {
      s.sftp.readdir(remotePath, (err, list) => {
        if (err) return resolve({ success: false, error: err.message })
        const data = list
          .map(item => ({
            name: item.filename,
            isDir: item.longname.startsWith('d'),
            size: item.attrs.size || 0,
            modifiedAt: new Date(item.attrs.mtime * 1000).toISOString()
          }))
          .sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
            return a.name.localeCompare(b.name)
          })
        resolve({ success: true, data })
      })
    })
  })

  ipcMain.handle('sftp:list-local', async (_, dirPath) => {
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true })
      const data = []
      for (const e of entries) {
        try {
          const st = await fsp.stat(path.join(dirPath, e.name))
          data.push({
            name: e.name,
            isDir: e.isDirectory(),
            size: st.size,
            modifiedAt: st.mtime.toISOString()
          })
        } catch {}
      }
      data.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('sftp:home-local', () => app.getPath('home'))

  ipcMain.handle('sftp:upload', async (_, { sessionId, localPaths, remoteDir }) => {
    const s = sessions.get(sessionId)
    if (!s) return { success: false, error: '会话不存在' }
    const results = []
    for (const localPath of localPaths) {
      const filename = path.basename(localPath)
      const sep = remoteDir.endsWith('/') ? '' : '/'
      const remotePath = remoteDir + sep + filename
      const transferId = randomUUID()
      try {
        const total = fs.statSync(localPath).size
        await new Promise((resolve, reject) => {
          s.sftp.fastPut(localPath, remotePath, {
            step: (transferred) => {
              if (!win.isDestroyed()) {
                win.webContents.send('sftp:progress', { transferId, filename, transferred, total, direction: 'upload' })
              }
            }
          }, (err) => err ? reject(err) : resolve())
        })
        if (!win.isDestroyed()) {
          win.webContents.send('sftp:progress', { transferId, filename, transferred: total, total, direction: 'upload', done: true })
        }
        results.push({ filename, success: true })
      } catch (err) {
        if (!win.isDestroyed()) {
          win.webContents.send('sftp:progress', { transferId, filename, error: err.message, direction: 'upload', done: true })
        }
        results.push({ filename, success: false, error: err.message })
      }
    }
    return { success: true, results }
  })

  ipcMain.handle('sftp:download', async (_, { sessionId, remoteFiles, localDir }) => {
    const s = sessions.get(sessionId)
    if (!s) return { success: false, error: '会话不存在' }
    const results = []
    for (const remotePath of remoteFiles) {
      const filename = path.posix.basename(remotePath)
      const localPath = path.join(localDir, filename)
      const transferId = randomUUID()
      try {
        const stat = await new Promise((resolve, reject) => {
          s.sftp.stat(remotePath, (err, st) => err ? reject(err) : resolve(st))
        })
        await new Promise((resolve, reject) => {
          s.sftp.fastGet(remotePath, localPath, {
            step: (transferred) => {
              if (!win.isDestroyed()) {
                win.webContents.send('sftp:progress', { transferId, filename, transferred, total: stat.size, direction: 'download' })
              }
            }
          }, (err) => err ? reject(err) : resolve())
        })
        if (!win.isDestroyed()) {
          win.webContents.send('sftp:progress', { transferId, filename, transferred: stat.size, total: stat.size, direction: 'download', done: true })
        }
        results.push({ filename, success: true })
      } catch (err) {
        if (!win.isDestroyed()) {
          win.webContents.send('sftp:progress', { transferId, filename, error: err.message, direction: 'download', done: true })
        }
        results.push({ filename, success: false, error: err.message })
      }
    }
    return { success: true, results }
  })

  ipcMain.handle('sftp:mkdir-remote', async (_, { sessionId, remotePath }) => {
    const s = sessions.get(sessionId)
    if (!s) return { success: false, error: '会话不存在' }
    return new Promise((resolve) => {
      s.sftp.mkdir(remotePath, (err) => resolve(err ? { success: false, error: err.message } : { success: true }))
    })
  })

  ipcMain.handle('sftp:delete-remote', async (_, { sessionId, entries }) => {
    const s = sessions.get(sessionId)
    if (!s) return { success: false, error: '会话不存在' }
    try {
      for (const e of entries) {
        await new Promise((resolve, reject) => {
          const fn = e.isDir ? s.sftp.rmdir.bind(s.sftp) : s.sftp.unlink.bind(s.sftp)
          fn(e.path, (err) => err ? reject(err) : resolve())
        })
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('sftp:rename-remote', async (_, { sessionId, oldPath, newPath }) => {
    const s = sessions.get(sessionId)
    if (!s) return { success: false, error: '会话不存在' }
    return new Promise((resolve) => {
      s.sftp.rename(oldPath, newPath, (err) => resolve(err ? { success: false, error: err.message } : { success: true }))
    })
  })

  ipcMain.handle('sftp:mkdir-local', async (_, dirPath) => {
    try {
      await fsp.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('sftp:delete-local', async (_, paths) => {
    try {
      for (const p of paths) await fsp.rm(p, { recursive: true, force: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('sftp:rename-local', async (_, { oldPath, newPath }) => {
    try {
      await fsp.rename(oldPath, newPath)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
