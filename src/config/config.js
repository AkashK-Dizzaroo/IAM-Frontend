const config = {
  API_URL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  VITE_GOOGLE_CLIENT_ID: "190301231532-ke9k8019m3o3im1ef3se0dcppngmpjj2.apps.googleusercontent.com",
  VITE_GOOGLE_REDIRECT_URI: "http://localhost:5173/auth/google/callback",
  // Add other configuration values as needed
};

export { config };
