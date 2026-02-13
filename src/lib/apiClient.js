import axios from "axios";
import { env } from "@/config/env";
import { PLATFORM_TOKEN_KEY, isValidToken } from "@/features/auth/utils/authInit";

/**
 * Singleton Axios instance for all API calls.
 * - Auth: Bearer token (from Hub handoff) or HttpOnly cookies
 * - On 401: redirects to Hub login
 */
const apiClient = axios.create({
  baseURL: `${env.API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(PLATFORM_TOKEN_KEY);
    if (token && isValidToken(token)) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (e) => Promise.reject(e)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("Session expired. Redirecting to Hub login...");
      const isDevEnv =
        import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === "true";
      const devMode = localStorage.getItem("dev_mode") === "true";

      localStorage.removeItem("platform_user");
      localStorage.removeItem(PLATFORM_TOKEN_KEY);

      if (devMode) {
        console.warn("[API] 401 in dev mode - backend rejected");
      } else if (!isDevEnv && !window.location.pathname.includes("/login")) {
        window.location.href = `${env.getValidHubUrl()}/login`;
      }
    }
    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;
