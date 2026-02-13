import { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { getValidHubUrl } from "@/config/env";
import { AuthContext } from "./AuthContext";
import { PLATFORM_TOKEN_KEY, isValidToken } from "@/features/auth/utils/authInit";

const PLATFORM_USER_KEY = "platform_user";

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
