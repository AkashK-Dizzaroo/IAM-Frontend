import axios from 'axios';

// When IAM runs on localhost, use local backend so verify hits same server that issued the token (avoids ERR_NETWORK/CORS to Azure)
function getApiBaseURL() {
  if (typeof window !== 'undefined') {
    const o = window.location.origin;
    if (o.startsWith('http://localhost') || o.startsWith('http://127.0.0.1')) {
      return 'http://localhost:4001';
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:4001';
}

const api = axios.create({
  baseURL: `${getApiBaseURL()}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the auth token and resolve baseURL for localhost
api.interceptors.request.use(
  (config) => {
    config.baseURL = `${getApiBaseURL()}/api`;
    const token = localStorage.getItem('platform_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      const isDevEnv = import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true';
      const devMode = localStorage.getItem('dev_mode') === 'true';
      
      if (devMode) {
        // In dev mode with dummy credentials, don't clear localStorage
        // The error will be handled by the calling code
        console.warn('[API] 401 error in dev mode - backend rejected dummy token');
      } else if (!isDevEnv) {
        // Only redirect in production when not in dev mode
        localStorage.removeItem('platform_token');
        localStorage.removeItem('platform_user');
        window.location.href = '/login';
      }
      // In dev env without dev_mode flag, let the AuthContext handle the error
    }
    return Promise.reject(error);
  }
);

export default api; 