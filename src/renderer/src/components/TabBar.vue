<template>
  <div class="tabbar">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab"
      :class="{ active: tab.id === activeId }"
      @click="emit('select', tab.id)"
    >
      <span class="tab-status" :class="tab.status" />
      <span class="tab-label">{{ tab.label }}</span>
      <button
        class="tab-close"
        @click.stop="emit('close', tab.id)"
        title="关闭"
      >✕</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tabs: { type: Array, default: () => [] },
  activeId: { type: String, default: null }
})
const emit = defineEmits(['select', 'close'])
</script>

<style scoped>
.tabbar {
  display: flex;
  align-items: flex-end;
  height: var(--tabbar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-shrink: 0;
}

.tabbar::-webkit-scrollbar { height: 3px; }

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 100%;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  border-right: 1px solid var(--border);
  white-space: nowrap;
  min-width: 100px;
  max-width: 180px;
  transition: background 0.1s, color 0.1s;
  position: relative;
}

.tab:hover { background: var(--bg-hover); color: var(--text-primary); }

.tab.active {
  background: var(--bg-primary);
  color: var(--text-primary);
}
.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
}

.tab-status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);
}
.tab-status.connecting { background: var(--warning); animation: pulse 1s infinite; }
.tab-status.connected { background: var(--success); }
.tab-status.disconnected { background: var(--text-muted); }
.tab-status.error { background: var(--error); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.tab-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}
.tab:hover .tab-close { opacity: 1; }
.tab-close:hover { background: var(--bg-tertiary); color: var(--text-primary); }
</style>
