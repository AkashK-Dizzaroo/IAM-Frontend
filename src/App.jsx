import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/config/queryClient";
import { AuthProvider, useAuth, ProtectedRoute } from "@/features/auth";
import { Toaster } from "@/components/ui/toaster";
import { getValidHubUrl } from "@/config/env";
import { DashboardPage } from "@/features/layout";
import {
  UserProfilePage,
  ApplicationRoleAssignmentsPage,
} from "@/features/profile";
import {
  UserProfileManagementPage,
  UsersPage,
  AccountRequestsPage,
} from "@/features/users";
import { RolesPage } from "@/features/roles";
import { AccessRequestsPage } from "@/features/access-requests";
import { AuditPage } from "@/features/audit";
import { ApplicationAccessManagementPage } from "@/features/applications";

function AppRoutes() {
  const { loading, user } = useAuth();

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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      >
        <Route path="profile" element={<UserProfilePage />} />
        <Route
          path="application-role-assignments"
          element={<ApplicationRoleAssignmentsPage />}
        />
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
                You don&apos;t have permission to access this application.
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
