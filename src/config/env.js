/**
 * Environment configuration.
 * Uses .env / Vite build-time variables. No hardcoded secrets.
 */

const sanitize = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
};

const fromVite = (key) => sanitize(import.meta.env[key]);

const PROD_HUB_URL = "https://hub.dizzaroo.com";
const DEV_HUB_URL = "http://localhost:5000";
const DEFAULT_DEV_API_URL = "http://localhost:4001";

function isValidUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  if (url.includes("$") || url.includes("(")) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  return true;
}

/**
 * Absolute API origin (e.g. https://api.example.com) from VITE_API_URL.
 * Used for production builds and any code that needs a full URL. In dev, defaults when unset.
 */
export function getApiBaseURL() {
  const raw = fromVite("VITE_API_URL");
  if (raw) return raw.replace(/\/$/, "");
  if (import.meta.env.DEV) return DEFAULT_DEV_API_URL;
  return "";
}

/**
 * Base path for Axios. In development, use same-origin `/api` so Vite proxies to the backend
 * and HttpOnly cookies (refresh_token) are stored on the IAM origin (e.g. :5001).
 * In production, use VITE_API_URL + `/api`.
 */
export function getAxiosBaseURL() {
  if (import.meta.env.DEV) return "/api";
  const base = getApiBaseURL();
  if (!base) {
    console.warn("[IAM] VITE_API_URL unset in production; axios baseURL falls back to /api");
    return "/api";
  }
  return `${base.replace(/\/$/, "")}/api`;
}

/**
 * Hub URL for redirects. Guards against unexpanded pipeline variables.
 */
export function getValidHubUrl() {
  const raw = fromVite("VITE_HUB_URL");
  if (import.meta.env.DEV) {
    return raw && isValidUrl(raw) ? raw : DEV_HUB_URL;
  }
  if (!raw || !isValidUrl(raw)) {
    console.warn("[IAM] VITE_HUB_URL invalid or unset, using fallback:", raw || "(empty)");
    return PROD_HUB_URL;
  }
  return raw;
}

export const env = {
  API_BASE_URL: getApiBaseURL(),
  AXIOS_BASE_URL: getAxiosBaseURL(),
  HUB_URL: getValidHubUrl(),
  getApiBaseURL,
  getAxiosBaseURL,
  getValidHubUrl,
  GOOGLE_CLIENT_ID: fromVite("VITE_GOOGLE_CLIENT_ID"),
};
