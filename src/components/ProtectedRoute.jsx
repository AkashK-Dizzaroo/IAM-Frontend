import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth()

  // Don't show anything while loading
  // AuthContext will handle the loading UI
  if (loading) {
    return null
  }

  // If not authenticated, AuthContext will handle redirect
  // Just show a fallback message (shouldn't be visible since redirect happens in AuthContext)
  if (!isAuthenticated || !user) {
    return null
  }

  // Role-based access control (currently disabled)
  if (requiredRoles.length > 0) {
    const userRole = user.role || user.globalRole
    
    // Check if user has required role
    const hasRequiredRole = requiredRoles.includes(userRole)
    
    // Super admins and platform admins always have access
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'PLATFORM_ADMIN'
    
    if (!hasRequiredRole && !isSuperAdmin) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return children
}

export default ProtectedRoute