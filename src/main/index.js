import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { registerSettingsIpc } from './ipc/settings'
import { registerServersIpc } from './ipc/servers'
import { registerTerminalIpc } from './ipc/terminal'
import { registerKeysIpc } from './ipc/keys'
import { registerSftpIpc } from './ipc/sftp'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  const win = createWindow()

  registerSettingsIpc(ipcMain)
  registerServersIpc(ipcMain)
  registerTerminalIpc(ipcMain, win)
  registerKeysIpc(ipcMain)
  registerSftpIpc(ipcMain, win)

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
