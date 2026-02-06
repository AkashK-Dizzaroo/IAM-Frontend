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

const DEBUG_ENDPOINT = "http://127.0.0.1:7242/ingest/991fd1d6-0b04-4ae6-b7da-5dd8319fddf2";

/**
 * Extracts accessToken and user from URL, sanitizes URL immediately, then writes to localStorage if valid.
 * Call before ReactDOM.createRoot.
 */
export function initializeAuthFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("accessToken");
  const userB64 = params.get("user");

  // Sanitize URL immediately to strip credentials from address bar / history
  const cleanUrl = window.location.pathname + (window.location.hash || "") || "/";
  window.history.replaceState({}, "", cleanUrl);

  let storedToken = false;
  if (isValidToken(accessToken)) {
    localStorage.setItem(PLATFORM_TOKEN_KEY, accessToken);
    storedToken = true;
    if (userB64) {
      try {
        localStorage.setItem(PLATFORM_USER_KEY, atob(userB64));
      } catch (_) {
        // Ignore decode errors
      }
    }
  }

  if (import.meta.env.DEV) {
    fetch(DEBUG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "authInit.js:initializeAuthFromUrl",
        message: "Auth init from URL",
        data: {
          hasAccessToken: !!accessToken,
          hasUser: !!userB64,
          storedToken,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
      }),
    }).catch(() => {});
  }
}
