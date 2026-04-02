import axios from "axios";
import { env } from "@/config/env";
import { PLATFORM_USER_KEY } from "@/features/auth/utils/authInit";

/**
 * HttpOnly access_token + refresh_token on API host; credentials sent cross-site to IAM API.
 * Response shape: full Axios response (callers use response.data).
 */
const apiClient = axios.create({
  baseURL: `${env.API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 15000,
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isDevEnv =
        import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === "true";
      const devMode = localStorage.getItem("dev_mode") === "true";
      localStorage.removeItem(PLATFORM_USER_KEY);
      if (devMode) {
        console.warn("[API] 401 — session invalid");
      } else if (!isDevEnv && !window.location.pathname.includes("/login")) {
        window.location.href = `${env.getValidHubUrl()}/login`;
      }
    }
    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;