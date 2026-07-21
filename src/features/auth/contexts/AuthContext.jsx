import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import apiClient from "@/lib/apiClient";
import { getValidHubUrl } from "@/config/env";
import { startOAuthLogin } from "@/features/auth/utils/oauthFlow";
import { queryClient } from "@/config/queryClient";
import { logger } from "@/lib/logger";

const AuthContext = createContext(null);

export const DEFAULT_EFFECTIVE_ROLES = {
  isHubOwner: false,
  isAppOwner: false,
  appOwnerOf: [],
  isElevated: false,
  canAccessAdmin: false,
};

const PLATFORM_USER_KEY = "platform_user";

function persistUserToStorage(user) {
  if (!user?.id) return;
  try {
    const safe = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      displayName: user.displayName || user.name || "",
      profilePicture: user.profilePicture || null,
      hubRoles: Array.isArray(user.hubRoles) ? user.hubRoles : [],
      status: user.status || "active",
    };
    localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(safe));
  } catch {
    /* ignore quota/security errors */
  }
}

function clearUserFromStorage() {
  try { localStorage.removeItem(PLATFORM_USER_KEY); } catch { /* ignore */ }
}

// Pages where session failure must NOT trigger a fresh OAuth redirect — the
// browser is already in a navigation flow that owns the auth lifecycle.
const OAUTH_FLOW_PATHS = new Set(["/callback", "/logout"]);

function isInOAuthFlowPath() {
  const p = (typeof window !== "undefined" && window.location.pathname) || "";
  return OAUTH_FLOW_PATHS.has(p);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Guard against React StrictMode double-invoking the init effect in development.
  const initInFlight = useRef(false);
  // Avoid re-entering the OAuth redirect while one is already in progress
  // (e.g. focus/blur events firing during the navigation).
  const oauthRedirectInFlightRef = useRef(false);

  const clearSession = useCallback(() => {
    sessionStorage.clear();
    queryClient.clear();
    setUser(null);
    setIsAuthenticated(false);
    clearUserFromStorage();
    logger.setUser('anonymous');
  }, []);

  const triggerLogin = useCallback(() => {
    if (oauthRedirectInFlightRef.current) return;
    if (isInOAuthFlowPath()) return;
    oauthRedirectInFlightRef.current = true;
    startOAuthLogin().catch((e) => {
      oauthRedirectInFlightRef.current = false;
      console.error("[IAM] Failed to start OAuth flow", e);
    });
  }, []);

  const verifySession = useCallback(async ({ redirectOnFailure = true } = {}) => {
    try {
      const verifyRes = await apiClient.post("/auth/verify", {}, { timeout: 15000 });
      const body = verifyRes.data;

      if (body?.success && body?.data?.user) {
        const backendUser = body.data.user;
        setUser(backendUser);
        setIsAuthenticated(true);
        persistUserToStorage(backendUser);
        logger.setUser(backendUser.id || backendUser.email);
        return true;
      }
      // 200 with success:false — iam:session-expired already handles 401s.
      clearSession();
      if (redirectOnFailure && !oauthRedirectInFlightRef.current) triggerLogin();
      return false;
    } catch {
      // iam:session-expired fires synchronously on 401 before this catch runs,
      // so only clean up if the OAuth flow hasn't already started.
      if (!oauthRedirectInFlightRef.current) {
        clearSession();
        if (redirectOnFailure) triggerLogin();
      }
      return false;
    }
  }, [clearSession, triggerLogin]);

  // 1. Initial mount verification
  useEffect(() => {
    // StrictMode mounts → unmounts → remounts; the ref persists across that
    // cycle so the second invocation bails out immediately.
    if (initInFlight.current) return;
    initInFlight.current = true;

    const initializeAuth = async () => {
      if (isInOAuthFlowPath()) {
        setLoading(false);
        return;
      }
      await verifySession({ redirectOnFailure: true });
      setLoading(false);
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once at mount only.

  // 2. Global 401 listener — catches expired sessions mid-use without polling.
  // apiClient dispatches "iam:session-expired" on every 401 response, so any
  // API call (users list, policy fetch, etc.) will instantly clear state and
  // redirect rather than leaving the UI in a broken half-authenticated state.
  useEffect(() => {
    const handleSessionExpired = () => {
      if (isInOAuthFlowPath()) return;
      console.warn("[IAM] Global session expiration caught. Redirecting to login.");
      clearSession();
      triggerLogin();
    };

    window.addEventListener("iam:session-expired", handleSessionExpired);
    return () => window.removeEventListener("iam:session-expired", handleSessionExpired);
  }, [clearSession, triggerLogin]);

  const rolesReady = true;

  const effectiveRoles = useMemo(() => {
    if (!user) return DEFAULT_EFFECTIVE_ROLES;

    const hubRoles = user?.hubRoles ?? [];
    const isHubOwner = hubRoles.includes("HUB_OWNER");

    const appOwnerOf = Array.isArray(user.ownedAppIds) ? user.ownedAppIds : [];
    const isAppOwner = appOwnerOf.length > 0;
    const isElevated = isHubOwner || isAppOwner;
    const canAccessAdmin = isHubOwner || isAppOwner;

    return {
      isHubOwner,
      isAppOwner,
      appOwnerOf,
      isElevated,
      canAccessAdmin,
    };
  }, [user]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout").catch(() => {});
    } finally {
      clearSession();
      const hubBase = getValidHubUrl().replace(/\/$/, "");
      const logoutUrl = `${hubBase}/logout`;

      /* Tell the Hub tab that opened this one to drop its React session immediately
         (cookies already cleared by the API call above). The opener tab syncs itself
         via its own in-app navigation — this tab never touches or closes it. */
      try {
        const hubOrigin = new URL(hubBase).origin;
        if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "dizzaroo-hub-auth", action: "session-ended" },
            hubOrigin
          );
        }
      } catch {
        /* ignore */
      }

      // Always navigate this (IAM) tab itself, regardless of whether it has an opener.
      if (typeof window !== "undefined" && !window.closed) {
        window.location.href = logoutUrl;
      }
    }
  }, [clearSession]);

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated,
      logout,
      effectiveRoles,
      rolesReady,
    }),
    [user, loading, isAuthenticated, logout, effectiveRoles, rolesReady]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export { AuthContext };
