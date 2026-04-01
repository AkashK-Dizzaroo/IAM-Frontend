import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { getValidHubUrl } from "@/config/env";
import { useAuth } from "../hooks/useAuth";

export const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const redirectStarted = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && user) return;
    if (redirectStarted.current) return;
    redirectStarted.current = true;
    const hub = getValidHubUrl().replace(/\/$/, "");
    const returnTo = encodeURIComponent(
      `${window.location.origin}${window.location.pathname}${window.location.search}`
    );
    window.location.replace(`${hub}/login?returnTo=${returnTo}`);
  }, [loading, isAuthenticated, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
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
    const userRole = user.role || user.globalRole;
    const hasRequiredRole = requiredRoles.includes(userRole);
    const isSuperAdmin =
      userRole === "SUPER_ADMIN" || userRole === "PLATFORM_ADMIN";

    if (!hasRequiredRole && !isSuperAdmin) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};
