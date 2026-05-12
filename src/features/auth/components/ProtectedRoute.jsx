import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { startOAuthLogin } from "@/features/auth/utils/oauthFlow";
import { AppShellSkeleton } from "@/components/ui/AppShellSkeleton";

export const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const redirectStarted = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && user) return;
    if (redirectStarted.current) return;
    redirectStarted.current = true;
    // Kick off the OAuth Authorization Code + PKCE flow against the Hub IdP.
    // The Hub will silently re-issue a session if the user already has one
    // there, otherwise it will prompt for login and redirect back here.
    startOAuthLogin().catch((err) => {
      redirectStarted.current = false;
      console.error("[IAM] startOAuthLogin failed", err);
    });
  }, [loading, isAuthenticated, user]);

  if (loading) {
    return <AppShellSkeleton />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-2 text-gray-600">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        <p className="text-sm">Redirecting to sign in…</p>
      </div>
    );
  }

  if (requiredRoles.length > 0) {
    const userRole = user.role;
    const hasRequiredRole = requiredRoles.includes(userRole);
    const isSuperAdmin =
      userRole === "SUPER_ADMIN" || userRole === "PLATFORM_ADMIN";

    if (!hasRequiredRole && !isSuperAdmin) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};
