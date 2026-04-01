/**
 * Auth initialization utility.
 * Hub→IAM uses only handoffCode: POST /api/auth/handoff/exchange sets HttpOnly cookies + token.
 * Legacy ?accessToken= URL params are not supported (they skipped refresh cookies).
 */

export const PLATFORM_TOKEN_KEY = "access_token";
export const PLATFORM_USER_KEY = "platform_user";

/**
 * @param {string | null | undefined} token
 * @returns {boolean}
 */
export function isValidToken(token) {
  if (token == null || typeof token !== "string") return false;
  const t = token.trim();
  if (t.length === 0 || t === "undefined") return false;

  try {
    const base64Url = t.split(".")[1];
    if (!base64Url) return false;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const { exp } = JSON.parse(jsonPayload);
    const currentTime = Math.floor(Date.now() / 1000);
    if (exp && exp < currentTime + 30) {
      return false;
    }
    return true;
  } catch (e) {
    console.error("Failed to parse JWT", e);
    return false;
  }
}

/**
 * @returns {string | null}
 */
export function getStoredToken() {
  const token = localStorage.getItem(PLATFORM_TOKEN_KEY);
  return isValidToken(token) ? token : null;
}

function readHandoffCodeFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  let code = searchParams.get("handoffCode");
  if (!code && window.location.hash) {
    const hashPart = window.location.hash.replace(/^#/, "");
    const qIndex = hashPart.indexOf("?");
    if (qIndex >= 0) {
      const hashParams = new URLSearchParams(hashPart.substring(qIndex));
      code = hashParams.get("handoffCode");
    }
  }
  if (!code) {
    try {
      const url = new URL(window.location.href);
      code = url.searchParams.get("handoffCode");
    } catch {
      /* ignore */
    }
  }
  return code;
}

/**
 * Exchange Hub handoff code for session (HttpOnly cookies + Bearer in localStorage).
 * Call before ReactDOM.createRoot. Uses axios with credentials so cookies are set cross-origin.
 * @returns {Promise<void>}
 */
export async function initializeAuthFromUrl() {
  const handoffCode = readHandoffCodeFromUrl();
  if (!handoffCode) {
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname || "/");

  try {
    const { default: apiClient } = await import("@/lib/apiClient");
    const res = await apiClient.post(
      "/auth/handoff/exchange",
      { code: handoffCode },
      { withCredentials: true }
    );
    const json = res.data;
    if (!json?.success) {
      console.error("[IAM] Handoff exchange failed:", json?.error || json);
      localStorage.removeItem(PLATFORM_TOKEN_KEY);
      localStorage.removeItem(PLATFORM_USER_KEY);
      return;
    }
    const payload = json?.data ?? json;
    if (payload?.token && isValidToken(payload.token)) {
      localStorage.setItem(PLATFORM_TOKEN_KEY, payload.token);
      if (payload.user) {
        localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(payload.user));
      }
      apiClient.defaults.headers.common.Authorization = `Bearer ${payload.token}`;
    } else {
      console.error("[IAM] Handoff response missing token", json);
      localStorage.removeItem(PLATFORM_TOKEN_KEY);
      localStorage.removeItem(PLATFORM_USER_KEY);
    }
  } catch (e) {
    console.error("[IAM] Handoff exchange failed:", e);
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    localStorage.removeItem(PLATFORM_USER_KEY);
  }
}
