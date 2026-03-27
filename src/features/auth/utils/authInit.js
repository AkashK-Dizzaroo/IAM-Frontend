/**
 * Auth initialization utility.
 * Hub→IAM handoff uses a one-time handoffCode (exchanged via POST); legacy ?accessToken= is deprecated.
 */

import { getApiBaseURL } from "@/config/env";

export const PLATFORM_TOKEN_KEY = "platform_token";
export const PLATFORM_USER_KEY = "platform_user";

/**
 * @param {string | null | undefined} token
 * @returns {boolean}
 */
export function isValidToken(token) {
  if (token == null || typeof token !== "string") return false;
  const t = token.trim();
  return t.length > 0 && t !== "undefined";
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
 * Exchange Hub handoff code for session, or read legacy URL tokens. Call before ReactDOM.createRoot.
 * @returns {Promise<void>}
 */
export async function initializeAuthFromUrl() {
  const handoffCode = readHandoffCodeFromUrl();
  if (handoffCode) {
    const cleanUrl = window.location.pathname || "/";
    window.history.replaceState({}, "", cleanUrl);
    try {
      const base = getApiBaseURL();
      const res = await fetch(`${base}/api/auth/handoff/exchange`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ code: handoffCode }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data;
      if (data?.token && isValidToken(data.token)) {
        localStorage.setItem(PLATFORM_TOKEN_KEY, data.token);
        if (data.user) {
          localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(data.user));
        }
      }
    } catch (e) {
      console.error("[IAM] Handoff exchange failed:", e);
    }
    return;
  }

  let accessToken = null;
  let userB64 = null;

  const searchParams = new URLSearchParams(window.location.search);
  accessToken = searchParams.get("accessToken") || searchParams.get("access_token");
  userB64 = searchParams.get("user");

  if (!accessToken && window.location.hash) {
    const hashPart = window.location.hash.replace(/^#/, "");
    const qIndex = hashPart.indexOf("?");
    if (qIndex >= 0) {
      const hashParams = new URLSearchParams(hashPart.substring(qIndex));
      accessToken = hashParams.get("accessToken") || hashParams.get("access_token");
      if (!userB64) userB64 = hashParams.get("user");
    }
  }

  if (!accessToken && window.location.href) {
    try {
      const url = new URL(window.location.href);
      accessToken = url.searchParams.get("accessToken") || url.searchParams.get("access_token");
      if (!userB64) userB64 = url.searchParams.get("user");
    } catch {
      /* ignore */
    }
  }

  if (isValidToken(accessToken)) {
    localStorage.setItem(PLATFORM_TOKEN_KEY, accessToken);
    if (userB64) {
      try {
        localStorage.setItem(PLATFORM_USER_KEY, atob(userB64));
      } catch {
        /* ignore */
      }
    }
  }

  const cleanUrl = window.location.pathname || "/";
  window.history.replaceState({}, "", cleanUrl);
}
