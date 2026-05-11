import { useEffect, useRef } from "react";
import { consumePkceVerifier, consumeOAuthState } from "@/features/auth/utils/oauthFlow";

/**
 * OAuth callback landing page.
 *
 * The Hub IdP redirects the browser here with ?code=&state=. We:
 *   1. Verify state matches the value we stored before /authorize.
 *   2. Forward code + state + the PKCE verifier to /api/oauth/iam/callback on the same origin.
 *      Vite proxies that path to the Hub backend in dev; in prod the Static Web App config maps
 *      /api/* to the API origin. The backend exchanges the code server-side using IAM's
 *      client_secret and sets HttpOnly cookies on the IAM origin, then 302s to /.
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
    window.location.replace(`/api/oauth/iam/callback?${cb.toString()}`);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
        <p className="text-gray-600">Signing you in…</p>
      </div>
    </div>
  );
}
