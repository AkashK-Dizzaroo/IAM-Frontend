// sessionStorage keys for in-flight OAuth Authorization Code + PKCE state.
// Tokens themselves live in HttpOnly cookies on the IAM origin.
const OAUTH_STATE_KEY = "iam_oauth_state";
const OAUTH_PKCE_VERIFIER_KEY = "iam_oauth_pkce_verifier";

const DEV_HUB_API_URL = "http://localhost:4001";
const DEV_REDIRECT_URI = "http://localhost:5001/callback";
const DEFAULT_CLIENT_ID = "iam_app";

function fromVite(key) {
  const v = import.meta.env[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t || t === "undefined" || t === "null") return undefined;
  return t;
}

function getHubAuthorizeBase() {
  const explicit = fromVite("VITE_OAUTH_AUTHORIZE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const apiBase =
    fromVite("VITE_HUB_OAUTH_API_URL") ||
    fromVite("VITE_API_URL") ||
    (import.meta.env.DEV ? DEV_HUB_API_URL : "");
  if (!apiBase) console.warn("[IAM] VITE_API_URL is not set — OAuth authorize URL will be wrong");
  return `${apiBase.replace(/\/$/, "")}/api/oauth/authorize`;
}

function getOAuthClientId() {
  return fromVite("VITE_OAUTH_CLIENT_ID") || DEFAULT_CLIENT_ID;
}

function getOAuthRedirectUri() {
  const explicit = fromVite("VITE_OAUTH_REDIRECT_URI");
  if (explicit) return explicit;
  if (import.meta.env.DEV) return DEV_REDIRECT_URI;
  console.warn("[IAM] VITE_OAUTH_REDIRECT_URI is not set — OAuth redirect will fail");
  return "";
}

function base64UrlEncode(bytes) {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCodePoint(bytes[i]);
  let encoded = btoa(str).replaceAll("+", "-").replaceAll("/", "_");
  while (encoded.endsWith("=")) encoded = encoded.slice(0, -1);
  return encoded;
}

async function generatePkceVerifierAndChallenge() {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode(verifierBytes);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

function generateState() {
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  return base64UrlEncode(stateBytes);
}

/**
 * Begin the Authorization Code + PKCE flow against the Hub IdP.
 * Stores the verifier + state in sessionStorage and navigates the browser to /api/oauth/authorize.
 */
export async function startOAuthLogin() {
  const { verifier, challenge } = await generatePkceVerifierAndChallenge();
  const state = generateState();
  sessionStorage.setItem(OAUTH_PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: getOAuthClientId(),
    redirect_uri: getOAuthRedirectUri(),
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: "openid profile email",
  });

  window.location.assign(`${getHubAuthorizeBase()}?${params.toString()}`);
}

export function consumePkceVerifier() {
  const v = sessionStorage.getItem(OAUTH_PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_PKCE_VERIFIER_KEY);
  return v;
}

export function consumeOAuthState() {
  const s = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  return s;
}
