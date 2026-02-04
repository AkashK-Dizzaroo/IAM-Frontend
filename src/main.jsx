// 🚨 HARD BLOCK Azure default domain (safe, no loop)
if (window.location.hostname.endsWith("azurestaticapps.net")) {
  window.location.replace("https://iam.dizzaroo.com");
}

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

if (!GOOGLE_CLIENT_ID) {
  console.error("❌ VITE_GOOGLE_CLIENT_ID is missing");
}

// -------------------------------
// Render App
// -------------------------------
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
