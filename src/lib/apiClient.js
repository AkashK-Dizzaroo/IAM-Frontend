import axios from "axios";
import { env } from "@/config/env";
import { PLATFORM_USER_KEY } from "@/features/auth/utils/authInit";
import { logger } from "./logger";

const REQUEST_ID_HEADER = "x-request-id";

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pathFromConfig(configObj) {
  const base = configObj?.baseURL || "";
  const url = configObj?.url || "";
  return `${base}${url}`;
}

/**
 * HttpOnly access_token + refresh_token on API host; credentials sent cross-site to IAM API.
 * Response shape: full Axios response (callers use response.data).
 */
const apiClient = axios.create({
  baseURL: env.AXIOS_BASE_URL,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 15000,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (request) => {
    const requestId = generateRequestId();
    request.headers = request.headers || {};
    request.headers[REQUEST_ID_HEADER] = requestId;
    request.metadata = {
      requestId,
      startedAt: performance.now(),
    };

    logger.info("API request started", {
      requestId,
      method: request.method?.toUpperCase() || "GET",
      url: pathFromConfig(request),
      payload: logger.sanitize(request.data),
      params: logger.sanitize(request.params),
    });

    return request;
  },
  (error) => {
    logger.error("API request setup failed", { error: error.message });
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    const startedAt = response.config?.metadata?.startedAt || performance.now();
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    const requestId = response.config?.metadata?.requestId || response.headers?.[REQUEST_ID_HEADER];

    logger.info("API request resolved", {
      requestId,
      method: response.config?.method?.toUpperCase() || "GET",
      url: pathFromConfig(response.config),
      statusCode: response.status,
      durationMs,
      response: logger.sanitize(response.data),
    });

    return response;
  },
  (error) => {
    const startedAt = error.config?.metadata?.startedAt || performance.now();
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    const requestId =
      error.config?.metadata?.requestId ||
      error.response?.headers?.[REQUEST_ID_HEADER] ||
      error.config?.headers?.[REQUEST_ID_HEADER];

    logger.error("API request rejected", {
      requestId,
      method: error.config?.method?.toUpperCase() || "GET",
      url: pathFromConfig(error.config),
      statusCode: error.response?.status || 0,
      durationMs,
      payload: logger.sanitize(error.config?.data),
      response: logger.sanitize(error.response?.data),
      error: error.message,
    });

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