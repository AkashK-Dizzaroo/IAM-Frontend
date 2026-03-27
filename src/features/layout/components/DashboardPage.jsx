import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { useAbacScope } from "../../abac/contexts/AbacScopeContext";
import { useQuery } from "@tanstack/react-query";
import { abacService } from "../../abac/api/abacService";
import { getValidHubUrl } from "@/config/env";
import { getDisplayRole } from "@/lib/utils";
import {
  Shield,
  ArrowLeft,
  LogOut,
  User,
  Users,
  FolderOpen,
  Layers,
  FileText,
  FlaskConical,
  AlertTriangle,
  Database,
  ShieldCheck,
  Globe2,
  AppWindow,
  BarChart2,
  Tag,
  UserCog,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

/** Axios wraps the body; backend sends { success, data: apps[] }. */
function normalizeApplicationsList(queryData) {
  const body = queryData?.data;
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

/** Small section label for sidebar groups */
const NavSection = ({ label }) => (
  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-4 pb-1.5 first:pt-1 select-none">
    {label}
  </p>
);

/** Single nav item button */
const NavItem = ({ tab, isActive, onClick, sidebarCollapsed }) => {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={sidebarCollapsed ? tab.label : undefined}
      className={`
        w-full flex items-center gap-2.5
        ${sidebarCollapsed
          ? "justify-center px-0 py-2.5 mx-auto w-10 h-10 rounded-lg mb-0.5"
          : "px-3 py-2 rounded-lg mb-0.5"
        }
        text-sm font-medium transition-colors text-left
        ${isActive
          ? "bg-primary/10 text-primary"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }
      `}
    >
      {Icon && (
        <Icon
          size={15}
          className={`flex-shrink-0 ${
            isActive ? "text-primary" : "text-gray-400"
          }`}
        />
      )}
      {!sidebarCollapsed && (
        <>
          <span className="flex-1 truncate">{tab.label}</span>
          {isActive && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
          )}
        </>
      )}
    </button>
  );
};

export const DashboardPage = () => {
  const { user, logout, effectiveRoles, loading, rolesReady } = useAuth();
  const { scope, selectedAppKey, selectedAppName, selectApp, selectGlobal } =
    useAbacScope();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("iam_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("iam_sidebar_collapsed", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const { data: appsData } = useQuery({
    queryKey: ["abac", "applications"],
    queryFn: abacService.getApplications,
    enabled: effectiveRoles.isHubOwner || effectiveRoles.isAppOwner,
    staleTime: 5 * 60 * 1000,
  });
  const apps = normalizeApplicationsList(appsData);

  useEffect(() => {
    if (
      effectiveRoles.isAppOwner &&
      !effectiveRoles.isHubOwner &&
      apps.length > 0 &&
      !selectedAppKey
    ) {
      const ownedKeys =
        effectiveRoles.appOwnerOf
          ?.map((appId) => {
            const match = apps.find(
              (a) => a.id === appId || a.mongoId === appId
            );
            return match?.key;
          })
          .filter(Boolean) ?? [];

      if (ownedKeys.length === 1) {
        const app = apps.find((a) => a.key === ownedKeys[0]);
        if (app) selectApp(app.key, app.name ?? app.key);
      }
    }
  }, [apps, effectiveRoles.isAppOwner, effectiveRoles.appOwnerOf]);

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

  const isGlobalScope = scope === "global";
  const isAppScope = scope === "app" && !!selectedAppKey;

  // ── Nav item definitions ────────────────────────────────────────
  const navPersonal = [
    {
      id: "my-profile",
      label: "My Profile",
      icon: User,
      path: "/my-profile",
      show: true,
    },
  ];

  const navAdmin = [
    {
      id: "account-approvals",
      label: "Account Approvals",
      icon: ShieldCheck,
      path: "/account-approvals",
      show: effectiveRoles.isHubOwner || effectiveRoles.isITSupport,
    },
  ];

  const navGlobal = [
    {
      id: "users",
      label: "Users",
      icon: Users,
      path: "/users",
      show: effectiveRoles.isHubOwner && isGlobalScope,
    },
    {
      id: "hub-attributes",
      label: "Hub Attributes",
      icon: Tag,
      path: "/hub-attributes",
      show: effectiveRoles.isHubOwner && isGlobalScope,
    },
    {
      id: "resource-classifications",
      label: "Resource Classifications",
      icon: Database,
      path: "/resource-classifications",
      show: effectiveRoles.isHubOwner && isGlobalScope,
    },
    {
      id: "global-policies",
      label: "Global Policies",
      icon: Globe2,
      path: "/global-policies",
      show: effectiveRoles.isHubOwner && isGlobalScope,
    },
    {
      id: "applications",
      label: "Applications",
      icon: AppWindow,
      path: "/applications",
      show: effectiveRoles.isHubOwner && isGlobalScope,
    },
  ];

  const navApp = [
    {
      id: "app-attributes",
      label: "App Attributes",
      icon: Layers,
      path: "/app-attributes",
      show: (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope,
    },
    {
      id: "app-user-attributes",
      label: "App User Attributes",
      icon: UserCog,
      path: "/app-user-attributes",
      show: (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope,
    },
    {
      id: "app-policies",
      label: "App Policies",
      icon: FileText,
      path: "/app-policies",
      show: (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope,
    },
    {
      id: "policy-tester",
      label: "Policy Tester",
      icon: FlaskConical,
      path: "/policy-tester",
      show: (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope,
    },
    {
      id: "audit",
      label: "Audit Trail",
      icon: BarChart2,
      path: "/audit",
      show: (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope,
    },
    {
      id: "coverage-gaps",
      label: "Coverage Gaps",
      icon: AlertTriangle,
      path: "/coverage-gaps",
      show: (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope,
    },
  ];

  const navResources = [
    {
      id: "resources",
      label: "Resources",
      icon: FolderOpen,
      path: "/resources",
      show: effectiveRoles.isHubOwner || effectiveRoles.isAppOwner,
    },
  ];

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const renderGroup = (items) =>
    items
      .filter((t) => t.show)
      .map((tab) => (
        <NavItem
          key={tab.id}
          tab={tab}
          isActive={isActive(tab.path)}
          onClick={() => navigate(tab.path)}
          sidebarCollapsed={sidebarCollapsed}
        />
      ));

  const showAdmin = effectiveRoles.isHubOwner || effectiveRoles.isITSupport;
  const showGlobal = effectiveRoles.isHubOwner && isGlobalScope;
  const showApp = (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope;
  const showResources = effectiveRoles.isHubOwner || effectiveRoles.isAppOwner;

  const handleBackToHub = () => {
    window.location.href = getValidHubUrl() + "/hub";
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">

      {/* ── Top header ─────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white shadow-sm border-b border-gray-100 z-10">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">

            {/* Left: back + branding */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToHub}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Hub"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900 leading-tight">
                    Identity & Access Management
                  </h1>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    {effectiveRoles.canAccessAdmin
                      ? "Manage users and application access"
                      : "View your profile and access information"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: logout */}
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + content ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside
          className={`
            flex-shrink-0 flex flex-col
            bg-white border-r border-gray-100
            overflow-hidden transition-all duration-200 ease-in-out
            ${sidebarCollapsed ? "w-14" : "w-60"}
          `}
        >

          {/* Section 1: Scope selector */}
          {sidebarCollapsed ? (
            <div className="px-3 py-3 border-b border-gray-100 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setSidebarCollapsed(false);
                  try {
                    localStorage.setItem("iam_sidebar_collapsed", "false");
                  } catch {
                    /* ignore */
                  }
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                title="Expand sidebar"
              >
                <Globe2 size={16} />
              </button>
            </div>
          ) : (
            <div className="px-3 py-3 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1 select-none">
                Scope
              </p>

              {/* Global button */}
              <button
                type="button"
                onClick={() => {
                  selectGlobal();
                  navigate("/users");
                }}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                  text-sm font-medium transition-colors text-left mb-1
                  ${scope === "global"
                    ? "bg-primary/10 text-primary"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
              >
                <svg
                  width="15" height="15" fill="none"
                  stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  className="flex-shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                Global
                {scope === "global" && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                )}
              </button>

              {/* App scope selector — only for Hub Owners and App Owners */}
              {(effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-3 mb-1.5 px-1 select-none">
                    Application
                  </p>
                  <select
                    value={selectedAppKey ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const app = apps.find((a) => a.key === val);
                      selectApp(val, app?.name ?? val);
                      navigate("/app-policies");
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select app…</option>
                    {apps.map((app) => (
                      <option key={app.key} value={app.key}>
                        {app.name ?? app.key}
                      </option>
                    ))}
                  </select>
                  {scope === "app" && selectedAppName && (
                    <p className="text-[11px] text-primary font-medium px-1 mt-1.5 truncate">
                      Viewing: {selectedAppName}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Nav items (scrollable) */}
          <nav className="flex-1 overflow-y-auto px-2 py-2 min-h-0">

            {!sidebarCollapsed && <NavSection label="Personal" />}
            {renderGroup(navPersonal)}

            {showAdmin && (
              <>
                {!sidebarCollapsed && <NavSection label="Administration" />}
                {renderGroup(navAdmin)}
              </>
            )}

            {showGlobal && (
              <>
                {!sidebarCollapsed && <NavSection label="Global Config" />}
                {renderGroup(navGlobal)}
              </>
            )}

            {showApp && (
              <>
                {!sidebarCollapsed && (
                  <NavSection label={`App: ${selectedAppName ?? "…"}`} />
                )}
                {renderGroup(navApp)}
              </>
            )}

            {showResources && (
              <>
                {!sidebarCollapsed && <NavSection label="Resources" />}
                {renderGroup(navResources)}
              </>
            )}
          </nav>

          {/* Collapse / expand toggle */}
          <div className="px-2 pb-2 flex-shrink-0">
            <button
              type="button"
              onClick={toggleSidebar}
              className="
                w-full flex items-center justify-center
                py-1.5 rounded-lg
                text-gray-400 hover:text-gray-600
                hover:bg-gray-50 transition-colors
              "
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                width="14" height="14"
                fill="none" stroke="currentColor" strokeWidth="2"
                viewBox="0 0 24 24"
                className={`transition-transform duration-200 ${
                  sidebarCollapsed ? "rotate-180" : ""
                }`}
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {!sidebarCollapsed && (
                <span className="ml-1.5 text-xs">Collapse</span>
              )}
            </button>
          </div>

          {/* Section 3: User info (fixed bottom) */}
          <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
            {sidebarCollapsed ? (
              <div className="flex justify-center">
                <div
                  className="
                    w-7 h-7 rounded-full bg-primary/15
                    flex items-center justify-center
                    text-primary text-xs font-semibold
                  "
                  title={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
                >
                  {user?.firstName?.charAt(0)}
                  {user?.lastName?.charAt(0)}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 text-primary text-xs font-semibold">
                  {user?.firstName?.charAt(0)}
                  {user?.lastName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {getDisplayRole(effectiveRoles)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content area ──────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-gray-50 min-h-0 transition-all duration-200">
          <div className="p-6 max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};






