import { memo } from "react";
import { Globe2, AppWindow } from "lucide-react";
import { getDisplayRole } from "@/lib/roles";

const NavSection = ({ label }) => (
  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-4 pb-1.5 first:pt-1 select-none">
    {label}
  </p>
);

const NavItem = memo(({ tab, isActive, onClick, sidebarCollapsed }) => {
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
          {tab.badge && (
            <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 flex-shrink-0">
              {tab.badge}
            </span>
          )}
          {isActive && !tab.badge && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
          )}
        </>
      )}
    </button>
  );
});

function ScopeSelector({
  sidebarCollapsed,
  setSidebarCollapsed,
  isGlobalScope,
  isAppScope,
  selectedAppKey,
  selectedAppName,
  effectiveRoles,
  apps,
  selectGlobal,
  selectApp,
  navigate,
}) {
  if (sidebarCollapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          setSidebarCollapsed(false);
          try { localStorage.setItem("iam_sidebar_collapsed", "false"); } catch { /* ignore */ }
        }}
        title={
          isGlobalScope
            ? "Hub Management"
            : selectedAppName
            ? `App: ${selectedAppName}`
            : "Select application"
        }
        className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors mb-0.5"
      >
        {isGlobalScope ? <Globe2 size={15} /> : <AppWindow size={15} />}
      </button>
    );
  }

  return (
    <div className="px-1 mb-1">
      <select
        value={isGlobalScope && effectiveRoles.isHubOwner ? "__hub__" : (selectedAppKey ?? "")}
        onChange={(e) => {
          const val = e.target.value;
          if (!val) return;
          if (val === "__hub__") {
            selectGlobal();
            navigate("/users");
          } else {
            const app = apps.find((a) => a.key === val);
            selectApp(val, app?.name ?? val, app?.id ?? null);
            navigate("/app-policies");
          }
        }}
        className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      >
        <option value="">Select application…</option>
        {effectiveRoles.isHubOwner && (
          <option value="__hub__">⚙ Hub Management</option>
        )}
        {apps.map((app) => (
          <option key={app.key} value={app.key}>
            {app.name ?? app.key}
          </option>
        ))}
      </select>
      {isAppScope && selectedAppName && (
        <p className="text-[11px] text-primary font-medium px-1 mt-1 truncate">
          Viewing: {selectedAppName}
        </p>
      )}
    </div>
  );
}

export function Sidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  toggleSidebar,
  navGroups,
  isGlobalScope,
  isAppScope,
  selectedAppKey,
  selectedAppName,
  effectiveRoles,
  apps,
  selectGlobal,
  selectApp,
  navigate,
  location,
  user,
}) {
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

  const showAdmin = effectiveRoles.isHubOwner || effectiveRoles.isAppOwner;
  const showGlobal = effectiveRoles.isHubOwner && isGlobalScope;
  const showApp = (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope;
  const showAppSelector = effectiveRoles.isHubOwner || effectiveRoles.isAppOwner;
  const showResources = effectiveRoles.isHubOwner && isGlobalScope;

  return (
    <aside
      className={`
        flex-shrink-0 flex flex-col
        bg-white border-r border-gray-100
        overflow-hidden transition-all duration-200 ease-in-out
        ${sidebarCollapsed ? "w-14" : "w-60"}
      `}
    >
      <nav className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {!sidebarCollapsed && <NavSection label="Personal" />}
        {renderGroup(navGroups.personal)}

        {showAdmin && (
          <>
            {!sidebarCollapsed && <NavSection label="Administration" />}
            {renderGroup(navGroups.admin)}
          </>
        )}

        {showAppSelector && (
          <>
            {!sidebarCollapsed && <NavSection label="Application" />}
            <ScopeSelector
              sidebarCollapsed={sidebarCollapsed}
              setSidebarCollapsed={setSidebarCollapsed}
              isGlobalScope={isGlobalScope}
              isAppScope={isAppScope}
              selectedAppKey={selectedAppKey}
              selectedAppName={selectedAppName}
              effectiveRoles={effectiveRoles}
              apps={apps}
              selectGlobal={selectGlobal}
              selectApp={selectApp}
              navigate={navigate}
            />
          </>
        )}

        {showGlobal && (
          <>
            {!sidebarCollapsed && <NavSection label="Hub Config" />}
            {renderGroup(navGroups.global)}
          </>
        )}

        {showApp && (
          <>
            {!sidebarCollapsed && (
              <NavSection label={`${selectedAppName ?? "App"} Settings`} />
            )}
            {renderGroup(navGroups.app)}
          </>
        )}

        {showResources && (
          <>
            {!sidebarCollapsed && <NavSection label="Resources" />}
            {renderGroup(navGroups.resources)}
          </>
        )}
      </nav>

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
  );
}
