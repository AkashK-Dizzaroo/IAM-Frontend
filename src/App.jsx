import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getValidHubUrl } from './utils/hubUrl'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './config/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import { Toaster } from '@/components/ui/toaster'

// Pages
import IdentityAccessManagement from './pages/IdentityAccessManagement'
import DashboardPage from './pages/DashboardPage'
import UserProfilePage from './pages/UserProfilePage'
import ApplicationRoleAssignmentsPage from './pages/ApplicationRoleAssignmentsPage'
import AccessRequestsPage from './pages/AccessRequestsPage'
import AccountRequestsPage from './pages/AccountRequestsPage'
import UsersPage from './pages/UsersPage'
import RolesPage from './pages/RolesPage'
import AuditPage from './pages/AuditPage'
import UserProfileManagementPage from './pages/UserProfileManagementPage'
import ApplicationAccessManagementPage from './pages/ApplicationAccessManagementPage'

// Wrapper component to handle routing
// Must be inside AuthProvider
function AppRoutes() {
  const { isAuthenticated, loading, user } = useAuth()

  const isUserRole = user?.globalRole === 'USER'

  return (
    <Routes>
      {/* Main IAM route with nested routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      >
        {/* User self-service routes (for globalRole === 'USER') */}
        <Route path="profile" element={<UserProfilePage />} />
        <Route path="application-role-assignments" element={<ApplicationRoleAssignmentsPage />} />
        
        {/* Admin routes (for ADMIN role) */}
        <Route path="user-profile-management" element={<UserProfileManagementPage />} />
        <Route path="application-access-management" element={<ApplicationAccessManagementPage />} />
        
        {/* Legacy admin routes (for backward compatibility) */}
        <Route path="access-requests" element={<AccessRequestsPage />} />
        <Route path="account-requests" element={<AccountRequestsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="audit" element={<AuditPage />} />
        
        {/* Default redirect based on role */}
        <Route index element={<Navigate to={isUserRole ? '/profile' : '/user-profile-management'} replace />} />
      </Route>

      {/* Legacy route - redirect to new structure */}
      <Route
        path="/iam"
        element={
          <ProtectedRoute>
            <IdentityAccessManagement />
          </ProtectedRoute>
        }
      />

      {/* Unauthorized */}
      <Route 
        path="/unauthorized" 
        element={
          <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
              <div className="text-6xl mb-4">🔒</div>
              <h1 className="text-3xl font-bold mb-4 text-gray-800">Access Denied</h1>
              <p className="text-gray-600 mb-6">
                You don't have permission to access this application.
              </p>
              <button
                onClick={() => {
                  window.location.href = getValidHubUrl()
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Hub
              </button>
            </div>
          </div>
        } 
      />

      {/* Catch-all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App