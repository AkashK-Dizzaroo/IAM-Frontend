import { useEffect, useState, useMemo, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { useAbacScope } from "@/features/scope";
import { applicationService } from "@/features/applications";
import { getValidHubUrl } from "@/config/env";
import { buildNavGroups } from "./navConfig";
import { TopHeader } from "./TopHeader";
import { Sidebar } from "./Sidebar";

function normalizeApplicationsList(queryData) {
  const body = queryData?.data;
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

const GLOBAL_SCOPE_PATHS = ["/users", "/hub-attributes", "/global-policies", "/applications", "/facilities", "/resources", "/audit"];

export const DashboardPage = () => {
  const { user, logout, effectiveRoles, loading, rolesReady } = useAuth();
  const { scope, selectedAppKey, selectedAppName, selectedAppId, selectApp, selectGlobal } =
    useAbacScope();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("iam_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("iam_sidebar_collapsed", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const { data: appsData } = useQuery({
    queryKey: ["abac", "applications"],
    queryFn: applicationService.getAbacApplications,
    enabled: effectiveRoles.isHubOwner || effectiveRoles.isAppOwner,
    staleTime: 5 * 60 * 1000,
  });
  const allApps = normalizeApplicationsList(appsData);

  const apps = effectiveRoles.isHubOwner
    ? allApps
    : allApps.filter((a) => effectiveRoles.appOwnerOf.includes(a.id));

  const isGlobalScope = scope === "global";
  const isAppScope = scope === "app" && !!selectedAppKey;

  const navGroups = useMemo(
    () => buildNavGroups({ effectiveRoles, isGlobalScope, isAppScope, selectedAppId }),
    [effectiveRoles, isGlobalScope, isAppScope, selectedAppId],
  );

  useEffect(() => {
    if (
      effectiveRoles.isAppOwner &&
      !effectiveRoles.isHubOwner &&
      apps.length === 1 &&
      !selectedAppKey
    ) {
      const app = apps[0];
      selectApp(app.key, app.name ?? app.key, app.id);
    }
  }, [apps, effectiveRoles.isAppOwner, effectiveRoles.isHubOwner, selectedAppKey, selectApp]);

  useEffect(() => {
    if (scope === "app" && GLOBAL_SCOPE_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"))) {
      selectGlobal();
    }
  }, [location.pathname, scope, selectGlobal]);

  if (loading || !rolesReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleBackToHub = () => {
    window.location.href = getValidHubUrl() + "/hub";
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <TopHeader
        user={user}
        effectiveRoles={effectiveRoles}
        onBackToHub={handleBackToHub}
        onLogout={() => logout()}
        onToggleMobileNav={() => setMobileNavOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          toggleSidebar={toggleSidebar}
          navGroups={navGroups}
          isGlobalScope={isGlobalScope}
          isAppScope={isAppScope}
          selectedAppKey={selectedAppKey}
          selectedAppName={selectedAppName}
          effectiveRoles={effectiveRoles}
          apps={apps}
          selectGlobal={selectGlobal}
          selectApp={selectApp}
          navigate={navigate}
          location={location}
          user={user}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <main className="flex-1 overflow-y-auto bg-gray-50 min-h-0 transition-all duration-200">
          <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
