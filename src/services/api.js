import axios from 'axios';

const api = axios.create({
  // Prefer VITE_API_URL, but fall back to the Backend-Clinical-trial-Platform local port
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:4001'}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the auth token
api.interceptors.request.use(
  (config) => {
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