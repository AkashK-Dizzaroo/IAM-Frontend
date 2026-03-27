/**
 * Re-export canonical auth init from features (single source of truth).
 */
export {
  PLATFORM_TOKEN_KEY,
  PLATFORM_USER_KEY,
  isValidToken,
  getStoredToken,
  initializeAuthFromUrl,
} from "../features/auth/utils/authInit";
