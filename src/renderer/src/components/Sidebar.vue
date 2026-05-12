<template>
  <div class="sidebar">
    <!-- Search -->
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索服务器..."
      />
    </div>

    <!-- Tag filter bar -->
    <div v-if="allTags.length" class="tag-filter-bar">
      <div class="tag-filter-list">
        <span
          v-for="tag in allTags"
          :key="tag"
          class="tag-chip"
          :class="{ selected: selectedTags.has(tag) }"
          :style="tagChipStyle(tag)"
          @click="toggleTag(tag)"
        >{{ tag }}</span>
      </div>
      <button v-if="selectedTags.size" class="tag-clear-btn" title="清除筛选" @click="clearTags">✕</button>
    </div>

    <!-- Server list -->
    <div class="server-list">
      <template v-if="filtered.length === 0">
        <div class="empty-list">{{ selectedTags.size ? '无匹配服务器' : '暂无服务器' }}</div>
      </template>

      <template v-for="group in filtered" :key="group.id ?? 'ungrouped'">
        <div class="group-header" @click="toggleGroup(group.id)">
          <span class="group-arrow" :class="{ open: !collapsed.has(group.id) }">›</span>
          <span class="group-name">{{ group.name }}</span>
          <span class="group-count">{{ group.servers.length }}</span>
        </div>

        <template v-if="!collapsed.has(group.id)">
          <div
            v-for="server in group.servers"
            :key="server.id"
            class="server-item"
            @dblclick="emit('connect', server)"
            @contextmenu.prevent="showMenu($event, server)"
          >
            <svg class="server-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
            <div class="server-info">
              <div class="server-name">{{ server.name }}</div>
              <div v-if="parseTags(server.tags).length" class="server-tags">
                <span
                  v-for="tag in parseTags(server.tags)"
                  :key="tag"
                  class="tag-chip sm"
                  :class="{ selected: selectedTags.has(tag) }"
                  :style="tagChipStyle(tag)"
                  @click.stop="toggleTag(tag)"
                >{{ tag }}</span>
              </div>
              <div class="server-addr">{{ server.username }}@{{ server.host }}</div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <button class="add-btn" @click="emit('add')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;flex-shrink:0">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建服务器
      </button>
      <div class="footer-btns">
        <button class="footer-btn" title="刷新服务器列表" @click="emit('refresh')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
        </button>
        <button class="footer-btn" title="密码本" @click="emit('password-book')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <path d="M12 10v4M10 12h4"/>
            <path d="M9 7h6M9 17h3"/>
          </svg>
        </button>
        <button class="footer-btn" title="SSH 密钥" @click="emit('keys')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
        </button>
        <button class="footer-btn" title="设置" @click="emit('settings')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Context menu -->
    <div
      v-if="menu.visible"
      class="ctx-menu"
      :style="{ top: menu.y + 'px', left: menu.x + 'px' }"
      @mouseleave="hideMenu"
    >
      <div class="ctx-item" @click="onConnect">连接终端</div>
      <div class="ctx-item" @click="onOpenFm">文件管理器</div>
      <div class="ctx-item" @click="onEdit">编辑</div>
      <hr class="ctx-divider" />
      <div class="ctx-item danger" @click="onDelete">删除</div>
    </div>
    <div v-if="menu.visible" class="ctx-backdrop" @click="hideMenu" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/useAppStore'
import { useTheme } from '../composables/useTheme'

const emit = defineEmits(['connect', 'open-fm', 'edit', 'add', 'settings', 'keys', 'password-book', 'refresh'])
const store = useAppStore()
const { theme } = useTheme()

const keyword = ref('')
const collapsed = ref(new Set())
const selectedTags = ref(new Set())
const menu = ref({ visible: false, x: 0, y: 0, server: null })

const TAG_HUES = [210, 260, 140, 25, 330, 180, 50, 0]

function parseTags(tags) {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

function tagHue(tag) {
  let hash = 0
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return TAG_HUES[hash % TAG_HUES.length]
}

function tagChipStyle(tag) {
  const hue = tagHue(tag)
  if (theme.value === 'dark') {
    return {
      background: `hsl(${hue},50%,16%)`,
      color: `hsl(${hue},80%,72%)`,
      borderColor: `hsl(${hue},50%,28%)`
    }
  }
  return {
    background: `hsl(${hue},60%,92%)`,
    color: `hsl(${hue},60%,28%)`,
    borderColor: `hsl(${hue},50%,75%)`
  }
}

const allTags = computed(() => {
  const set = new Set()
  for (const g of store.groupedServers) {
    for (const s of g.servers) {
      for (const t of parseTags(s.tags)) set.add(t)
    }
  }
  return [...set].sort()
})

const filtered = computed(() => {
  let groups = store.groupedServers

  if (keyword.value.trim()) {
    const kw = keyword.value.toLowerCase()
    groups = groups
      .map(g => ({
        ...g,
        servers: g.servers.filter(s =>
          s.name.toLowerCase().includes(kw) ||
          s.host.toLowerCase().includes(kw) ||
          s.username.toLowerCase().includes(kw) ||
          (s.tags || '').toLowerCase().includes(kw)
        )
      }))
      .filter(g => g.servers.length)
  }

  if (selectedTags.value.size > 0) {
    groups = groups
      .map(g => ({
        ...g,
        servers: g.servers.filter(s => {
          const tags = parseTags(s.tags)
          return [...selectedTags.value].some(t => tags.includes(t))
        })
      }))
      .filter(g => g.servers.length)
  }

  return groups
})

function toggleGroup(id) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

function toggleTag(tag) {
  const next = new Set(selectedTags.value)
  if (next.has(tag)) next.delete(tag)
  else next.add(tag)
  selectedTags.value = next
}

function clearTags() {
  selectedTags.value = new Set()
}

function showMenu(e, server) {
  const rect = document.querySelector('.sidebar').getBoundingClientRect()
  menu.value = {
    visible: true,
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    server
  }
}

function hideMenu() {
  menu.value.visible = false
}

function onConnect() {
  emit('connect', menu.value.server)
  hideMenu()
}

function onOpenFm() {
  emit('open-fm', menu.value.server)
  hideMenu()
}

function onEdit() {
  emit('edit', menu.value.server)
  hideMenu()
}

async function onDelete() {
  const s = menu.value.server
  hideMenu()
  if (!confirm(`确认删除服务器「${s.name}」？`)) return
  const res = await window.api.server.delete(s.id)
  if (res.success) {
    await store.loadServers()
  }
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.search-icon { font-size: 12px; opacity: 0.5; flex-shrink: 0; }

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 2px 0;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
}

.search-input::placeholder { color: var(--text-muted); }

/* ─── Tag filter bar ─── */
.tag-filter-bar {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}

.tag-filter-list {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-clear-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  background: var(--bg-hover);
  margin-top: 1px;
  border: none;
}

.tag-clear-btn:hover {
  color: var(--error);
  background: rgba(244, 67, 54, 0.15);
}

/* ─── Tag chip (shared by filter bar and server items) ─── */
.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  line-height: 1.4;
  transition: opacity 0.1s, box-shadow 0.1s;
}

.tag-chip:hover { opacity: 0.8; }

.tag-chip.selected {
  box-shadow: 0 0 0 1.5px currentColor;
}

.tag-chip.sm {
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 8px;
}

/* ─── Server list ─── */
.server-list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 4px;
}

.empty-list {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px 4px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  user-select: none;
}
.group-header:hover { color: var(--text-secondary); }

.group-arrow {
  display: inline-block;
  transition: transform 0.15s;
  font-size: 13px;
  line-height: 1;
}
.group-arrow.open { transform: rotate(90deg); }

.group-name { flex: 1; }
.group-count {
  background: var(--bg-tertiary);
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: normal;
}

.server-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px 6px 20px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 4px;
  transition: background 0.1s;
}
.server-item:hover { background: var(--bg-hover); }
.server-item:active { background: var(--bg-active); }

.server-icon { width: 15px; height: 15px; flex-shrink: 0; opacity: 0.65; margin-top: 2px; }

.server-info { min-width: 0; flex: 1; }

.server-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin: 3px 0 2px;
}

.server-addr {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── Footer ─── */
.sidebar-footer {
  border-top: 1px solid var(--border);
  padding: 8px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.add-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.add-btn:hover { background: var(--accent); }

.footer-btns { display: flex; gap: 4px; }

.footer-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
  color: var(--text-secondary);
}
.footer-btn svg { width: 15px; height: 15px; }
.footer-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ─── Context menu ─── */
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 49;
}

.ctx-menu {
  position: absolute;
  background: var(--bg-modal);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 4px;
  min-width: 120px;
  z-index: 50;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}

.ctx-item {
  padding: 7px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
}
.ctx-item:hover { background: var(--bg-hover); }
.ctx-item.danger { color: var(--error); }
.ctx-item.danger:hover { background: rgba(244,67,54,0.15); }
.ctx-divider { border-color: var(--border); margin: 3px 0; }
</style>
