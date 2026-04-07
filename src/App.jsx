import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/config/queryClient";
import { AuthProvider, useAuth, ProtectedRoute } from "@/features/auth";
import { Toaster } from "@/components/ui/toaster";
import { getValidHubUrl } from "@/config/env";
import { DashboardPage } from "@/features/layout";
import { MyProfilePage } from "@/features/profile";
import {
  UserProfileManagementPage,
  AccountRequestsPage,
} from "@/features/users";
import { AbacScopeProvider } from "@/features/abac/contexts/AbacScopeContext";
import { AbacUsersPage } from "@/features/abac/pages/AbacUsersPage";
import { HubAttributesPage } from "@/features/abac/pages/HubAttributesPage";

import { GlobalPoliciesPage } from "@/features/abac/pages/GlobalPoliciesPage";
import { AppAttributesPage } from "@/features/abac/pages/AppAttributesPage";
import { AppUserAttributesPage } from "@/features/abac/pages/AppUserAttributesPage";
import { AppPoliciesPage } from "@/features/abac/pages/AppPoliciesPage";
import { PolicyTesterPage } from "@/features/abac/pages/PolicyTesterPage";
import { CoverageGapsPage } from "@/features/abac/pages/CoverageGapsPage";
import { AuditPage } from "@/features/audit";
import { ResourceManagementPage } from "@/features/resources";
import { AbacApplicationsPage } from "@/features/abac/pages/AbacApplicationsPage";

function AppRoutes() {
  const { loading, user, effectiveRoles } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const getDefaultRedirect = () => {
    if (effectiveRoles.isHubOwner) return "/users";
    if (effectiveRoles.isAppOwner) return "/app-policies";
    if (effectiveRoles.isITSupport) return "/account-approvals";
    return "/my-profile";
  };

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
        {/* ── Active routes ──────────────────────────────────────────── */}
        <Route path="my-profile" element={<MyProfilePage />} />
        <Route path="resources" element={<ResourceManagementPage />} />
        <Route path="users" element={<AbacUsersPage />} />
        <Route path="applications" element={<AbacApplicationsPage />} />
        <Route path="account-approvals" element={<AccountRequestsPage />} />
        <Route path="audit" element={<AuditPage />} />

        {/* ── Global scope ABAC pages ──────────────────────────────── */}
        <Route path="hub-attributes" element={<HubAttributesPage />} />
<Route path="global-policies" element={<GlobalPoliciesPage />} />

        {/* ── App scope ABAC pages ─────────────────────────────────── */}
        <Route path="app-attributes" element={<AppAttributesPage />} />
        <Route path="app-user-attributes" element={<AppUserAttributesPage />} />
        <Route path="app-policies" element={<AppPoliciesPage />} />
        <Route path="policy-tester" element={<PolicyTesterPage />} />
        <Route path="coverage-gaps" element={<CoverageGapsPage />} />

        {/* ── Backward-compatibility redirects ───────────────────────── */}
        <Route path="profile" element={<Navigate to="/my-profile" replace />} />
        <Route
          path="application-role-assignments"
          element={<Navigate to="/my-profile" replace />}
        />
        <Route
          path="account-requests"
          element={<Navigate to="/account-approvals" replace />}
        />
        <Route
          path="access-requests"
          element={<Navigate to="/account-approvals" replace />}
        />
        <Route
          path="user-profile-management"
          element={<Navigate to="/users" replace />}
        />
        <Route
          path="resource-management"
          element={<Navigate to="/resources" replace />}
        />
        <Route
          path="application-access-management"
          element={<Navigate to="/applications" replace />}
        />

        <Route
          index
          element={<Navigate to={getDefaultRedirect()} replace />}
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
          <AbacScopeProvider>
            <AppRoutes />
            <Toaster />
          </AbacScopeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
