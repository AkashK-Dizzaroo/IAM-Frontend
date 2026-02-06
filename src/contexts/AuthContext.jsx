import { createContext, useEffect, useState } from "react";
import api from "../services/api";
import { getValidHubUrl } from "../utils/hubUrl";
import {
  getStoredToken,
  PLATFORM_TOKEN_KEY,
  PLATFORM_USER_KEY,
} from "../utils/authInit";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const clearSession = () => {
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    localStorage.removeItem(PLATFORM_USER_KEY);
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

  const verifyExistingToken = async () => {
    const response = await api.post("/auth/verify", {}, { timeout: 15000 });
    const data = response.data;

    if (!data?.success || !data?.data?.user) {
      throw new Error("Invalid auth response");
    }

    const backendUser = normalizeUser(data.data.user);
    localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(backendUser));
    setUser(backendUser);
    setIsAuthenticated(true);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = getStoredToken();

      if (!token) {
        // ✅ No auto-login, no UI, no redirect
        setLoading(false);
        return;
      }

      try {
        await verifyExistingToken();
      } catch (error) {
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const logout = async () => {
    try {
      await api.post("/auth/logout").catch(() => {});
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
};
