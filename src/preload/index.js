import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (config) => ipcRenderer.invoke('settings:save', config),
    testDb: (cfg) => ipcRenderer.invoke('settings:test-db', cfg),
    initDb: () => ipcRenderer.invoke('settings:init-db')
  },
  server: {
    list: () => ipcRenderer.invoke('server:list'),
    create: (s) => ipcRenderer.invoke('server:create', s),
    update: (s) => ipcRenderer.invoke('server:update', s),
    delete: (id) => ipcRenderer.invoke('server:delete', id)
  },
  group: {
    list: () => ipcRenderer.invoke('group:list'),
    create: (name) => ipcRenderer.invoke('group:create', name),
    delete: (id) => ipcRenderer.invoke('group:delete', id)
  },
  key: {
    list: () => ipcRenderer.invoke('key:list'),
    create: (k) => ipcRenderer.invoke('key:create', k),
    delete: (id) => ipcRenderer.invoke('key:delete', id)
  },
  terminal: {
    connect: (serverId) => ipcRenderer.invoke('terminal:connect', serverId),
    input: (sessionId, data) => ipcRenderer.send('terminal:input', { sessionId, data }),
    resize: (sessionId, cols, rows) => ipcRenderer.send('terminal:resize', { sessionId, cols, rows }),
    disconnect: (sessionId) => ipcRenderer.invoke('terminal:disconnect', sessionId),
    onOutput: (cb) => {
      const handler = (_, { sessionId, data }) => cb(sessionId, data)
      ipcRenderer.on('terminal:output', handler)
      return () => ipcRenderer.removeListener('terminal:output', handler)
    },
    onClosed: (cb) => {
      const handler = (_, { sessionId }) => cb(sessionId)
      ipcRenderer.on('terminal:closed', handler)
      return () => ipcRenderer.removeListener('terminal:closed', handler)
    }
  },
  sftp: {
    connect: (serverId) => ipcRenderer.invoke('sftp:connect', serverId),
    disconnect: (sessionId) => ipcRenderer.invoke('sftp:disconnect', sessionId),
    realpath: (sessionId, remotePath) => ipcRenderer.invoke('sftp:realpath', { sessionId, remotePath }),
    listRemote: (sessionId, remotePath) => ipcRenderer.invoke('sftp:list-remote', { sessionId, remotePath }),
    listLocal: (dirPath) => ipcRenderer.invoke('sftp:list-local', dirPath),
    homeLocal: () => ipcRenderer.invoke('sftp:home-local'),
    upload: (sessionId, localPaths, remoteDir) => ipcRenderer.invoke('sftp:upload', { sessionId, localPaths, remoteDir }),
    download: (sessionId, remoteFiles, localDir) => ipcRenderer.invoke('sftp:download', { sessionId, remoteFiles, localDir }),
    mkdirRemote: (sessionId, remotePath) => ipcRenderer.invoke('sftp:mkdir-remote', { sessionId, remotePath }),
    deleteRemote: (sessionId, entries) => ipcRenderer.invoke('sftp:delete-remote', { sessionId, entries }),
    renameRemote: (sessionId, oldPath, newPath) => ipcRenderer.invoke('sftp:rename-remote', { sessionId, oldPath, newPath }),
    mkdirLocal: (dirPath) => ipcRenderer.invoke('sftp:mkdir-local', dirPath),
    deleteLocal: (paths) => ipcRenderer.invoke('sftp:delete-local', paths),
    renameLocal: (oldPath, newPath) => ipcRenderer.invoke('sftp:rename-local', { oldPath, newPath }),
    onProgress: (cb) => {
      const handler = (_, data) => cb(data)
      ipcRenderer.on('sftp:progress', handler)
      return () => ipcRenderer.removeListener('sftp:progress', handler)
    }
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
})
