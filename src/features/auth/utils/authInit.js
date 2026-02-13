/**
 * Auth initialization utility.
 * Extracts Hub auth (accessToken, user) from URL params and syncs to localStorage.
 * Called before React mounts to avoid race conditions.
 */

export const PLATFORM_TOKEN_KEY = "platform_token";
export const PLATFORM_USER_KEY = "platform_user";

/**
 * Validates that the token exists and is not the literal "undefined" string.
 * @param {string | null | undefined} token
 * @returns {boolean}
 */
export function isValidToken(token) {
  if (token == null || typeof token !== "string") return false;
  const t = token.trim();
  return t.length > 0 && t !== "undefined";
}

/**
 * Returns the stored token only if it passes validation; otherwise null.
 * @returns {string | null}
 */
export function getStoredToken() {
  const token = localStorage.getItem(PLATFORM_TOKEN_KEY);
  return isValidToken(token) ? token : null;
}

/**
 * Extracts accessToken and user from URL, sanitizes URL immediately, then writes to localStorage if valid.
 * Call before ReactDOM.createRoot.
 */
export function initializeAuthFromUrl() {
  let accessToken = null;
  let userB64 = null;

  // 1. Primary: search params (?accessToken=xxx)
  const searchParams = new URLSearchParams(window.location.search);
  accessToken = searchParams.get("accessToken") || searchParams.get("access_token");
  userB64 = searchParams.get("user");

  // 2. Fallback: params in hash (e.g. /#?accessToken=xxx or /#/profile?accessToken=xxx)
  if (!accessToken && window.location.hash) {
    const hashPart = window.location.hash.replace(/^#/, "");
    const qIndex = hashPart.indexOf("?");
    if (qIndex >= 0) {
      const hashParams = new URLSearchParams(hashPart.substring(qIndex));
      accessToken = hashParams.get("accessToken") || hashParams.get("access_token");
      if (!userB64) userB64 = hashParams.get("user");
    }
  }

  // 3. Fallback: parse full href (handles edge cases with relative/base URLs)
  if (!accessToken && window.location.href) {
    try {
      const url = new URL(window.location.href);
      accessToken = url.searchParams.get("accessToken") || url.searchParams.get("access_token");
      if (!userB64) userB64 = url.searchParams.get("user");
    } catch (_) {
      /* ignore */
    }
  }

  // Store token BEFORE cleaning URL – ensures it's persisted before address bar updates
  if (isValidToken(accessToken)) {
    localStorage.setItem(PLATFORM_TOKEN_KEY, accessToken);
    if (userB64) {
      try {
        localStorage.setItem(PLATFORM_USER_KEY, atob(userB64));
      } catch (_) {
        // Ignore decode errors
      }
    }
  }

  // Sanitize URL to strip credentials from address bar / history (security)
  const cleanUrl = window.location.pathname || "/";
  window.history.replaceState({}, "", cleanUrl);
}
