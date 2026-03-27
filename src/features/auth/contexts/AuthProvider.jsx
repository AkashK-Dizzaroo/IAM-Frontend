import { useEffect, useState, useMemo } from "react";
import apiClient from "@/lib/apiClient";
import { getValidHubUrl } from "@/config/env";
import { AuthContext } from "./AuthContext";
import { PLATFORM_TOKEN_KEY, isValidToken } from "@/features/auth/utils/authInit";

const PLATFORM_USER_KEY = "platform_user";

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

  const normalizeUser = (backendUser) => {
    if (!backendUser.globalRole) {
      backendUser.globalRole = "USER";
    }
    return backendUser;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const storedUserStr = localStorage.getItem(PLATFORM_USER_KEY);
      const storedUser = storedUserStr ? (() => { try { return JSON.parse(storedUserStr); } catch { return null; } })() : null;
      const hasToken = isValidToken(localStorage.getItem(PLATFORM_TOKEN_KEY));

      // Token handoff: if we have token+user from URL (Hub launch), use them without verify
      if (hasToken && storedUser && (storedUser.id || storedUser._id)) {
        const normalized = normalizeUser(storedUser);
        setUser(normalized);
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      try {
        const response = await apiClient.post("/auth/verify", {}, { timeout: 15000 });
        const data = response.data;

        if (data?.success && data?.data?.user) {
          const backendUser = normalizeUser(data.data.user);
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

  // Legacy RBAC /users/me/assignments was removed; app-owner/manager lists stay empty until ABAC surfaces them.
  const rolesReady = true;

  const effectiveRoles = useMemo(() => {
    if (!user) return DEFAULT_EFFECTIVE_ROLES;

    const hubRoles = user?.hubRoles ?? [];
    const assignments = [];

    const isHubOwner   = hubRoles.includes('HUB_OWNER') || user?.globalRole === 'ADMIN';
    const isITSupport  = hubRoles.includes('IT_SUPPORT');

    // Backend populates role as { id, name, roleCode } — never a bare ObjectId string
    const getRoleCode = (a) => {
      const role = a?.role;
      if (!role || typeof role !== 'object') return null;
      return role.roleCode ?? role.code ?? null;
    };

    const getAppId = (a) => {
      const app = a?.application;
      if (!app) return null;
      if (typeof app === 'object') return String(app._id ?? app.id ?? '');
      return String(app);
    };

    const appOwnerOf = assignments
      .filter(a => getRoleCode(a) === 'APP_OWNER' && a.isActive !== false)
      .map(a => getAppId(a))
      .filter(Boolean);

    const appManagerOf = assignments
      .filter(a => getRoleCode(a) === 'APP_MANAGER' && a.isActive !== false)
      .map(a => getAppId(a))
      .filter(Boolean);

    const isAppOwner   = appOwnerOf.length > 0;
    const isAppManager = appManagerOf.length > 0;
    const isElevated   = isHubOwner || isITSupport || isAppOwner || isAppManager;
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
      window.location.href = `${getValidHubUrl()}/logout`;
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
