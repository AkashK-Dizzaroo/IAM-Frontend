import axios from "axios";
import { env, getAxiosBaseURL } from "@/config/env";
import { PLATFORM_TOKEN_KEY, isValidToken } from "@/features/auth/utils/authInit";

/**
 * Singleton Axios instance for all API calls.
 * - Dev: baseURL `/api` (Vite proxy → backend) so cookies are same-origin with IAM
 * - Prod: full API URL + /api from VITE_API_URL
 * - On 401: cookie-based refresh + Bearer update
 */

const apiClient = axios.create({
  baseURL: getAxiosBaseURL(),
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
  withCredentials: true,
});

/** Single in-flight refresh so parallel 401s do not stampede /auth/refresh */
let refreshPromise = null;

function triggerRefresh() {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post("/auth/refresh", {}, { withCredentials: true })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function isAuthExemptUrl(url) {
  if (!url || typeof url !== "string") return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/handoff/exchange")
  );
}

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
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || "";

    if (status === 401 && !isAuthExemptUrl(url) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await triggerRefresh();
        const body = refreshResponse.data;
        const payload = body?.data ?? body;
        const newToken = payload?.token;

        if (newToken) {
          localStorage.setItem(PLATFORM_TOKEN_KEY, newToken);
          apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
        throw new Error("No token returned from refresh");
      } catch (refreshError) {
        console.warn("Session expired. Redirecting to Hub login...");
        const isDevEnv =
          import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === "true";
        const devMode = localStorage.getItem("dev_mode") === "true";

        localStorage.removeItem("platform_user");
        localStorage.removeItem(PLATFORM_TOKEN_KEY);

        if (devMode) {
          console.warn("[API] Refresh failed in dev mode - backend rejected");
        } else if (!isDevEnv && !window.location.pathname.includes("/login")) {
          window.location.href = `${env.getValidHubUrl()}/login`;
        }
        return Promise.reject(refreshError);
      }
    }

    if (status === 401 && !isAuthExemptUrl(url) && originalRequest._retry) {
      const isDevEnv =
        import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === "true";
      const devMode = localStorage.getItem("dev_mode") === "true";
      localStorage.removeItem("platform_user");
      localStorage.removeItem(PLATFORM_TOKEN_KEY);
      if (!devMode && !isDevEnv && !window.location.pathname.includes("/login")) {
        window.location.href = `${env.getValidHubUrl()}/login`;
      }
    }

    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;
