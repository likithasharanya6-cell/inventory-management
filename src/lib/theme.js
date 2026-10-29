export function getTheme() {
  try { return localStorage.getItem('theme') || 'light' } catch { return 'light' }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem('theme', theme) } catch {}
}
