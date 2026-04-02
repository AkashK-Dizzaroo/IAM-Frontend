/**
 * Returns a valid Hub URL for redirects.
 * Guards against unexpanded pipeline variables (e.g. $(VITE_HUB_URL)) that cause
 * redirects to same-origin paths and infinite reload loops.
 */
export function getValidHubUrl() {
  const raw = import.meta.env.VITE_HUB_URL
  const fallback = 'https://hub.dizzaroo.com'
  const devFallback = 'http://localhost:5000'

  if (import.meta.env.DEV) {
    return raw && isValidHubUrl(raw) ? raw : devFallback
  }

  if (!raw || !isValidHubUrl(raw)) {
    console.warn('[IAM] VITE_HUB_URL invalid or unset, using fallback:', raw || '(empty)')
    return fallback
  }

  return raw
}

function isValidHubUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false
  if (url.includes('$') || url.includes('(')) return false
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false
  return true
}
