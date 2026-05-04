import { ref } from 'vue'

const theme = ref(localStorage.getItem('zorth-theme') || 'dark')

function apply(t) {
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem('zorth-theme', t)
}

// Apply immediately on load
apply(theme.value)

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply(theme.value)
  }
  return { theme, toggle }
}
