// 🚨 HARD BLOCK Azure default domain (safe, no loop)
if (window.location.hostname.endsWith("azurestaticapps.net")) {
  window.location.replace("https://iam.dizzaroo.com");
}

import { initializeAuthFromUrl } from "./utils/authInit";
initializeAuthFromUrl();

// -------------------------------
// React App Bootstrap
// -------------------------------
import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import "./index.css";

// -------------------------------
// Environment Variables
// -------------------------------
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Error boundary to surface React crashes instead of blank page
class AppErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[IAM] App crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "600px", margin: "2rem auto" }}>
          <h1 style={{ color: "#dc2626", marginBottom: "1rem" }}>Application Error</h1>
          <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <details style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "1rem" }}>
            <summary>Technical details</summary>
            <pre style={{ overflow: "auto", background: "#f3f4f6", padding: "1rem", borderRadius: "4px", marginTop: "0.5rem" }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

// Guard: missing Google Client ID crashes @react-oauth/google - show clear error instead
function Root() {
  if (!GOOGLE_CLIENT_ID || typeof GOOGLE_CLIENT_ID !== "string" || !GOOGLE_CLIENT_ID.trim()) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center", marginTop: "4rem" }}>
        <h1 style={{ color: "#dc2626", marginBottom: "1rem" }}>Configuration Error</h1>
        <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
          VITE_GOOGLE_CLIENT_ID is not set. Configure it in your Azure DevOps pipeline variables for the IAM app.
        </p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}

// -------------------------------
// Render App
// -------------------------------
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Root />
    </AppErrorBoundary>
  </React.StrictMode>
);
