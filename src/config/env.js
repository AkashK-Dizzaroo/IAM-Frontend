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

function isValidUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  if (url.includes("$") || url.includes("(")) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  return true;
}

/**
 * Platform API base URL (same variable as Hub: VITE_API_URL). Set in .env — no prod URL fallback.
 */
export function getApiBaseURL() {
  return fromVite("VITE_API_URL") ?? "";
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
