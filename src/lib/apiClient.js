import axios from "axios";
import { env } from "@/config/env";
import { logger } from "./logger";
import { secureRandomId } from "./random";

// Single-flight mutex so concurrent 401s share one refresh request.
let _iamRefreshPromise = null;

function singleFlightRefresh() {
  if (!_iamRefreshPromise) {
    _iamRefreshPromise = axios
      .post(
        `${env.AXIOS_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true, headers: { "Content-Type": "application/json" } }
      )
      .then((res) => {
        if (!res.data?.success) throw new Error(res.data?.error || "Refresh failed");
        return res.data;
      })
      .finally(() => { _iamRefreshPromise = null; });
  }
  return _iamRefreshPromise;
}

const REQUEST_ID_HEADER = "x-request-id";

function generateRequestId() {
  return secureRandomId();
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
  async (request) => {
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
  async (error) => {
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
      const isAuthEndpoint = error.config?.url?.includes("/auth/");

      if (!isAuthEndpoint && error.config && !error.config._retry) {
        error.config._retry = true;
        try {
          await singleFlightRefresh();
          return apiClient(error.config);
        } catch {
          // Silent refresh failed — fall through to the OAuth redirect below.
        }
      }

      const devMode = localStorage.getItem("dev_mode") === "true";
      if (devMode) {
        console.warn("[API] 401 — session invalid, triggering OAuth flow");
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("iam:session-expired"));
      }
    }
    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;