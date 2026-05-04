import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const servers = ref([])
  const groups = ref([])
  const tabs = ref([])
  const activeTabId = ref(null)
  const toasts = ref([])

  const groupedServers = computed(() => {
    const map = new Map()
    map.set(null, { id: null, name: '未分组', servers: [] })
    for (const g of groups.value) {
      map.set(g.id, { id: g.id, name: g.name, servers: [] })
    }
    for (const s of servers.value) {
      const key = s.group_id || null
      if (!map.has(key)) map.set(key, { id: key, name: '未分组', servers: [] })
      map.get(key).servers.push(s)
    }
    return [...map.values()].filter(g => g.servers.length > 0 || g.id !== null)
  })

  async function loadServers() {
    const res = await window.api.server.list()
    if (res.success) servers.value = res.data
    const gRes = await window.api.group.list()
    if (gRes.success) groups.value = gRes.data
  }

  async function connectServer(server) {
    const tabId = `tab-${Date.now()}`
    tabs.value.push({
      id: tabId,
      type: 'terminal',
      sessionId: null,
      serverId: server.id,
      label: server.name,
      host: server.host,
      status: 'connecting',
      error: null
    })
    activeTabId.value = tabId

    const res = await window.api.terminal.connect(server.id)
    const tab = tabs.value.find(t => t.id === tabId)
    if (!tab) return

    if (res.success) {
      tab.sessionId = res.sessionId
      tab.status = 'connected'
    } else {
      tab.status = 'error'
      tab.error = res.error
    }
  }

  async function openFileManager(server) {
    const tabId = `fm-${Date.now()}`
    tabs.value.push({
      id: tabId,
      type: 'sftp',
      sftpSessionId: null,
      serverId: server.id,
      label: `${server.name} · 文件`,
      host: server.host,
      status: 'connecting',
      error: null
    })
    activeTabId.value = tabId

    const res = await window.api.sftp.connect(server.id)
    const tab = tabs.value.find(t => t.id === tabId)
    if (!tab) return

    if (res.success) {
      tab.sftpSessionId = res.sessionId
      tab.status = 'connected'
    } else {
      tab.status = 'error'
      tab.error = res.error
    }
  }

  function closeTab(tabId) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab?.sessionId) window.api.terminal.disconnect(tab.sessionId).catch(() => {})
    if (tab?.sftpSessionId) window.api.sftp.disconnect(tab.sftpSessionId).catch(() => {})
    tabs.value = tabs.value.filter(t => t.id !== tabId)
    if (activeTabId.value === tabId) {
      activeTabId.value = tabs.value.length ? tabs.value[tabs.value.length - 1].id : null
    }
  }

  function handleSessionClosed(sessionId) {
    const tab = tabs.value.find(t => t.sessionId === sessionId)
    if (tab) { tab.status = 'disconnected'; tab.sessionId = null }
  }

  function toast(message, type = 'info', duration = 3000) {
    const id = Date.now()
    toasts.value.push({ id, message, type })
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, duration)
  }

  return {
    servers, groups, tabs, activeTabId, toasts,
    groupedServers,
    loadServers, connectServer, openFileManager, closeTab, handleSessionClosed, toast
  }
})
