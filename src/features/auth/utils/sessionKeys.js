/**
 * localStorage keys used by the IAM auth layer.
 * Tokens themselves live in HttpOnly cookies on the IAM origin (set by the Hub backend
 * during OAuth callback). The user object is cached client-side for instant UI rendering
 * before /auth/verify confirms the session.
 */
export const PLATFORM_USER_KEY = "platform_user";
export const PLATFORM_TOKEN_KEY = "access_token";

/** Keys for in-flight OAuth Authorization Code + PKCE state. */
export const OAUTH_STATE_KEY = "iam_oauth_state";
export const OAUTH_PKCE_VERIFIER_KEY = "iam_oauth_pkce_verifier";
