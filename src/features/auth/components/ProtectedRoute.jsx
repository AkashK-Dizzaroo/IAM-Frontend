import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return null;
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
