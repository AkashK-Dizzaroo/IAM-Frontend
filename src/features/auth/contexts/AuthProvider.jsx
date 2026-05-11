import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import apiClient from "@/lib/apiClient";
import { getValidHubUrl } from "@/config/env";
import { AuthContext } from "./AuthContext";
import { PLATFORM_TOKEN_KEY, PLATFORM_USER_KEY } from "@/features/auth/utils/sessionKeys";
import { startOAuthLogin } from "@/features/auth/utils/oauthFlow";

export const DEFAULT_EFFECTIVE_ROLES = {
  isHubOwner: false,
  isITSupport: false,
  isAppOwner: false,
  isAppManager: false,
  appOwnerOf: [],
  appManagerOf: [],
  isElevated: false,
  canAccessAdmin: false,
};

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
  // Avoid re-entering the OAuth redirect while one is already in progress
  // (e.g. focus/blur events firing during the navigation).
  const oauthRedirectInFlightRef = useRef(false);

  const clearSession = () => {
    localStorage.removeItem(PLATFORM_USER_KEY);
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    localStorage.removeItem("dev_mode");
    setUser(null);
    setIsAuthenticated(false);
  };

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
        localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(backendUser));
        setUser(backendUser);
        setIsAuthenticated(true);
        return true;
      }
      clearSession();
      if (redirectOnFailure) triggerLogin();
      return false;
    } catch {
      clearSession();
      if (redirectOnFailure) triggerLogin();
      return false;
    }
  }, [triggerLogin]);

  useEffect(() => {
    const initializeAuth = async () => {
      // Don't pre-empt the OAuth callback page — let it complete its exchange,
      // which will set cookies and navigate the browser.
      if (isInOAuthFlowPath()) {
        setLoading(false);
        return;
      }
      await verifySession({ redirectOnFailure: true });
      setLoading(false);
    };

    initializeAuth();
  }, [verifySession]);

  // Re-verify when this window/tab regains focus.
  useEffect(() => {
    const check = () => {
      if (isAuthenticated) verifySession({ redirectOnFailure: true });
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [isAuthenticated, verifySession]);

  // Poll session every 5s while authenticated — ensures prompt logout even when
  // the IAM window stays focused the whole time after a Hub logout.
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      verifySession({ redirectOnFailure: true });
    }, 5_000);
    return () => clearInterval(id);
  }, [isAuthenticated, verifySession]);

  const rolesReady = true;

  const effectiveRoles = useMemo(() => {
    if (!user) return DEFAULT_EFFECTIVE_ROLES;

    const hubRoles = user?.hubRoles ?? [];
    const isHubOwner = hubRoles.includes("HUB_OWNER");
    const isITSupport = hubRoles.includes("IT_SUPPORT");

    // Derived from application_owners table — returned by /auth/verify as ownedAppIds
    const appOwnerOf = Array.isArray(user.ownedAppIds) ? user.ownedAppIds : [];
    const appManagerOf = [];

    const isAppOwner = appOwnerOf.length > 0;
    const isAppManager = appManagerOf.length > 0;
    const isElevated = isHubOwner || isITSupport || isAppOwner || isAppManager;
    const canAccessAdmin = isHubOwner || isITSupport || isAppOwner || isAppManager;

    return {
      isHubOwner,
      isITSupport,
      isAppOwner,
      isAppManager,
      appOwnerOf,
      appManagerOf,
      isElevated,
      canAccessAdmin,
    };
  }, [user]);

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout").catch(() => {});
    } finally {
      clearSession();
      const hubBase = getValidHubUrl().replace(/\/$/, "");
      const logoutUrl = `${hubBase}/logout`;

      /* Tell Hub tabs to drop React session immediately (cookies already cleared by API). */
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

      if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
        try {
          window.opener.location.href = logoutUrl;
        } catch {
          /* ignore */
        }
        window.close();
      }
      if (typeof window !== "undefined" && !window.closed) {
        window.location.href = logoutUrl;
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        logout,
        effectiveRoles,
        rolesReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
