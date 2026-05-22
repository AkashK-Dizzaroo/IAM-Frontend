import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/config/queryClient";
import { AuthProvider, useAuth, ProtectedRoute } from "@/features/auth";
import { AppShellSkeleton } from "@/components/ui/AppShellSkeleton";
import { Toaster } from "@/components/ui/toaster";
import { getValidHubUrl } from "@/config/env";
import { AbacScopeProvider } from "@/features/abac/contexts/AbacScopeContext";

// Auth flow pages are needed immediately on load — keep them eager.
import LogoutPage from "@/features/auth/components/LogoutPage";
import OAuthCallbackPage from "@/features/auth/components/OAuthCallbackPage";

// Shell is the authenticated frame — load it eagerly so the sidebar renders
// without a flash once the session resolves.
import { DashboardPage } from "@/features/layout";

// All route-level pages are lazy: the browser downloads each chunk only when
// the user first navigates to that route.
const MyProfilePage = lazy(() => import("@/features/profile/pages/MyProfilePage").then(m => ({ default: m.MyProfilePage })));
const AccountRequestsPage = lazy(() => import("@/features/users/pages/AccountRequestsPage").then(m => ({ default: m.AccountRequestsPage })));
const AbacUsersPage = lazy(() => import("@/features/abac/pages/AbacUsersPage").then(m => ({ default: m.AbacUsersPage })));
const AbacApplicationsPage = lazy(() => import("@/features/abac/pages/AbacApplicationsPage").then(m => ({ default: m.AbacApplicationsPage })));
const AccessRequestsPage = lazy(() => import("@/features/access-requests/pages/AccessRequestsPage").then(m => ({ default: m.AccessRequestsPage })));
const FacilitiesPage = lazy(() => import("@/features/layout/pages/FacilitiesPage").then(m => ({ default: m.FacilitiesPage })));
const AuditPage = lazy(() => import("@/features/audit/pages/AuditPage").then(m => ({ default: m.AuditPage })));
const ResourceManagementPage = lazy(() => import("@/features/resources/pages/ResourceManagementPage").then(m => ({ default: m.ResourceManagementPage })));
const AppResourcesPage = lazy(() => import("@/features/resources/pages/AppResourcesPage").then(m => ({ default: m.AppResourcesPage })));
const HubAttributesPage = lazy(() => import("@/features/abac/pages/HubAttributesPage").then(m => ({ default: m.HubAttributesPage })));
const GlobalPoliciesPage = lazy(() => import("@/features/abac/pages/GlobalPoliciesPage").then(m => ({ default: m.GlobalPoliciesPage })));
const AppAttributesPage = lazy(() => import("@/features/abac/pages/AppAttributesPage").then(m => ({ default: m.AppAttributesPage })));
const AppUserAttributesPage = lazy(() => import("@/features/abac/pages/AppUserAttributesPage").then(m => ({ default: m.AppUserAttributesPage })));
const AppUsersManagementPage = lazy(() => import("@/features/abac/pages/AppUsersManagementPage").then(m => ({ default: m.AppUsersManagementPage })));
const AppPoliciesPage = lazy(() => import("@/features/abac/pages/AppPoliciesPage").then(m => ({ default: m.AppPoliciesPage })));
const PolicyTesterPage = lazy(() => import("@/features/abac/pages/PolicyTesterPage").then(m => ({ default: m.PolicyTesterPage })));
const CoverageGapsPage = lazy(() => import("@/features/abac/pages/CoverageGapsPage").then(m => ({ default: m.CoverageGapsPage })));

function AppRoutes() {
  const { loading, user, effectiveRoles } = useAuth();

  if (loading) {
    return <AppShellSkeleton />;
  }

  const getDefaultRedirect = () => {
    if (effectiveRoles.isHubOwner) return "/users";
    if (effectiveRoles.isAppOwner) return "/app-policies";
    return "/my-profile";
  };

  return (
    <Suspense fallback={<AppShellSkeleton />}>
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
        <Route path="app-resources" element={<AppResourcesPage />} />
        <Route path="users" element={<AbacUsersPage />} />
        <Route path="applications" element={<AbacApplicationsPage />} />
        <Route path="account-approvals" element={<AccountRequestsPage />} />
        <Route path="access-approvals" element={<AccessRequestsPage />} />
        <Route path="facilities" element={<FacilitiesPage />} />
        <Route path="audit" element={<AuditPage />} />

        {/* ── Global scope ABAC pages ──────────────────────────────── */}
        <Route path="hub-attributes" element={<HubAttributesPage />} />
<Route path="global-policies" element={<GlobalPoliciesPage />} />

        {/* ── App scope ABAC pages ─────────────────────────────────── */}
        <Route path="app-attributes" element={<AppAttributesPage />} />
        <Route path="app-user-attributes" element={<AppUsersManagementPage />} />
        <Route path="app-users" element={<AppUsersManagementPage />} />
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
          element={<Navigate to="/access-approvals" replace />}
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

      <Route path="/callback" element={<OAuthCallbackPage />} />
      <Route path="/logout" element={<LogoutPage />} />

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
    </Suspense>
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
