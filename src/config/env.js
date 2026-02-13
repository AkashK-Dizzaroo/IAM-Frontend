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

const PROD_API_URL = "https://hub-iam-api.dizzaroo.com";
const PROD_HUB_URL = "https://hub.dizzaroo.com";
const DEV_HUB_URL = "http://localhost:5000";

function isValidUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  if (url.includes("$") || url.includes("(")) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  return true;
}

/**
 * API base URL - localhost uses local backend, otherwise env or prod fallback.
 */
export function getApiBaseURL() {
  if (typeof window !== "undefined") {
    const o = window.location.origin;
    if (o.startsWith("http://localhost") || o.startsWith("http://127.0.0.1")) {
      return "http://localhost:4001";
    }
  }
  return fromVite("VITE_API_URL") || PROD_API_URL;
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
  HUB_URL: getValidHubUrl(),
  getApiBaseURL,
  getValidHubUrl,
  GOOGLE_CLIENT_ID: fromVite("VITE_GOOGLE_CLIENT_ID"),
};
