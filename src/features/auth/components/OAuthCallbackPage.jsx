import { useEffect, useRef } from "react";
import { consumePkceVerifier, consumeOAuthState } from "@/features/auth/utils/oauthFlow";

/**
 * OAuth callback landing page.
 *
 * The Hub IdP redirects the browser here with ?code=&state=. We:
 *   1. Verify state matches the value we stored before /authorize.
 *   2. Forward code + state + the PKCE verifier to the backend's /api/oauth/iam/callback endpoint.
 *      In dev, Vite proxies /api to http://localhost:4001. In prod, this uses VITE_API_URL.
 *      The backend exchanges the code server-side using IAM's client_secret and sets HttpOnly
 *      cookies on the backend's origin, then 302s back to /.
 */
let processingCallback = false;

export default function OAuthCallbackPage() {
  useEffect(() => {
    if (processingCallback) return;
    processingCallback = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const expectedState = consumeOAuthState();
    const verifier = consumePkceVerifier();

    if (error) {
      window.location.replace(`/?oauth_error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || !state || state !== expectedState) {
      window.location.replace("/?oauth_error=state_mismatch");
      return;
    }

    const cb = new URLSearchParams({ code, state });
    if (verifier) cb.append("code_verifier", verifier);

    // In dev, use relative path (Vite proxies to backend). In prod, use absolute API URL.
    const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
    const callbackUrl = apiUrl
      ? `${apiUrl}/api/oauth/iam/callback?${cb.toString()}`
      : `/api/oauth/iam/callback?${cb.toString()}`;
    window.location.replace(callbackUrl);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
        <p className="text-gray-600">Signing you in…</p>
      </div>
    </div>
  );
}
