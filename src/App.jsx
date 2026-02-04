import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./config/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster";
import { getValidHubUrl } from "./utils/hubUrl";

// Pages
import IdentityAccessManagement from "./pages/IdentityAccessManagement";
import DashboardPage from "./pages/DashboardPage";
import UserProfilePage from "./pages/UserProfilePage";
import ApplicationRoleAssignmentsPage from "./pages/ApplicationRoleAssignmentsPage";
import AccessRequestsPage from "./pages/AccessRequestsPage";
import AccountRequestsPage from "./pages/AccountRequestsPage";
import UsersPage from "./pages/UsersPage";
import RolesPage from "./pages/RolesPage";
import AuditPage from "./pages/AuditPage";
import UserProfileManagementPage from "./pages/UserProfileManagementPage";
import ApplicationAccessManagementPage from "./pages/ApplicationAccessManagementPage";

// -------------------------------
// App Routes (inside AuthProvider)
// -------------------------------
function AppRoutes() {
  const { loading, user } = useAuth();

  // ⏳ Wait for auth to resolve
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  const isUserRole = user?.globalRole === "USER";

  return (
    <Routes>
      {/* Root */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      >
        {/* User routes */}
        <Route path="profile" element={<UserProfilePage />} />
        <Route
          path="application-role-assignments"
          element={<ApplicationRoleAssignmentsPage />}
        />

        {/* Admin routes */}
        <Route
          path="user-profile-management"
          element={<UserProfileManagementPage />}
        />
        <Route
          path="application-access-management"
          element={<ApplicationAccessManagementPage />}
        />
        <Route path="access-requests" element={<AccessRequestsPage />} />
        <Route path="account-requests" element={<AccountRequestsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="audit" element={<AuditPage />} />

        {/* Default redirect AFTER auth is ready */}
        <Route
          index
          element={
            <Navigate
              to={isUserRole ? "/profile" : "/user-profile-management"}
              replace
            />
          }
        />
      </Route>

      {/* Legacy IAM route */}
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
              <h1 className="text-3xl font-bold mb-4 text-gray-800">
                Access Denied
              </h1>
              <p className="text-gray-600 mb-6">
                You don't have permission to access this application.
              </p>
              <button
                onClick={() => {
                  window.location.href = getValidHubUrl();
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Hub
              </button>
            </div>
          </div>
        }
      />

      {/* ❌ REMOVE redirect loop */}
      {/* <Route path="*" element={<Navigate to="/" replace />} /> */}

      {/* ✅ Safe fallback */}
      <Route
        path="*"
        element={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-gray-600">Page not found</div>
          </div>
        }
      />
    </Routes>
  );
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
  );
}

export default App;
