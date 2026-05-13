/**
 * localStorage/sessionStorage keys used by the IAM auth layer.
 * Tokens themselves live in HttpOnly cookies on the IAM origin.
 */

/** Keys for in-flight OAuth Authorization Code + PKCE state. */
export const OAUTH_STATE_KEY = "iam_oauth_state";
export const OAUTH_PKCE_VERIFIER_KEY = "iam_oauth_pkce_verifier";
