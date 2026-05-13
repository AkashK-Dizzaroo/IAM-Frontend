import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import apiClient from "@/lib/apiClient";
import { getValidHubUrl } from "@/config/env";
import { AuthContext } from "./AuthContext";
import { startOAuthLogin } from "@/features/auth/utils/oauthFlow";
import { queryClient } from "@/config/queryClient";
import { logger } from "@/lib/logger";

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
    sessionStorage.clear();
    queryClient.clear();
    setUser(null);
    setIsAuthenticated(false);
    logger.setUser('anonymous');
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
        setUser(backendUser);
        setIsAuthenticated(true);
        logger.setUser(backendUser.id || backendUser.email);
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
