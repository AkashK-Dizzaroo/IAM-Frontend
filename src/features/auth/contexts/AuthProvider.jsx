import { useEffect, useState, useMemo } from "react";
import apiClient from "@/lib/apiClient";
import { getValidHubUrl } from "@/config/env";
import { AuthContext } from "./AuthContext";
import { PLATFORM_TOKEN_KEY, PLATFORM_USER_KEY } from "@/features/auth/utils/authInit";

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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const clearSession = () => {
    localStorage.removeItem(PLATFORM_USER_KEY);
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    localStorage.removeItem("dev_mode");
    setUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const verifyRes = await apiClient.post("/auth/verify", {}, { timeout: 15000 });
        const body = verifyRes.data;

        if (body?.success && body?.data?.user) {
          const backendUser = body.data.user;
          localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(backendUser));
          setUser(backendUser);
          setIsAuthenticated(true);
        } else {
          clearSession();
          window.location.href = `${getValidHubUrl()}/login`;
        }
      } catch (error) {
        const isDev = import.meta.env.DEV || localStorage.getItem("dev_mode") === "true";
        clearSession();
        if (!isDev) {
          window.location.href = `${getValidHubUrl()}/login`;
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

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
