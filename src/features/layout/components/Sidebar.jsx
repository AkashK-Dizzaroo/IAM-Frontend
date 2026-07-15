import { memo } from "react";
import { Globe2, AppWindow, ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDisplayRole } from "@/lib/roles";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";

const NavSection = ({ label }) => (
  <p className="select-none px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 first:pt-2">
    {label}
  </p>
);

const NavItem = memo(({ tab, isActive, onClick, collapsed }) => {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? tab.label : undefined}
      className={cn(
        "relative flex items-center text-left text-sm font-medium transition-colors",
        "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed
          ? "mx-auto mb-0.5 h-10 w-10 justify-center"
          : "mb-0.5 w-full gap-2.5 px-3 py-2",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-gray-600 hover:bg-muted hover:text-foreground"
      )}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" aria-hidden="true" />
      )}
      {Icon && (
        <Icon
          size={16}
          className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
        />
      )}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{tab.label}</span>
          {tab.badge && (
            <span className="ml-auto shrink-0 rounded-md bg-warning-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
              {tab.badge}
            </span>
          )}
        </>
      )}
    </button>
  );
});
NavItem.displayName = "NavItem";

function ScopeSelector({
  collapsed,
  setSidebarCollapsed,
  isGlobalScope,
  selectedAppKey,
  selectedAppName,
  effectiveRoles,
  apps,
  selectGlobal,
  selectApp,
  navigate,
}) {
  if (collapsed) {
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
        className="mx-auto mb-0.5 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isGlobalScope ? <Globe2 size={16} /> : <AppWindow size={16} />}
      </button>
    );
  }

  const value =
    isGlobalScope && effectiveRoles.isHubOwner
      ? "__hub__"
      : selectedAppKey || undefined;

  return (
    <div className="mb-1 px-1">
      <Select
        value={value}
        onValueChange={(val) => {
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
      >
        <SelectTrigger className="h-10 w-full bg-muted/50 text-sm font-medium">
          <SelectValue placeholder="Select application…" />
        </SelectTrigger>
        <SelectContent>
          {effectiveRoles.isHubOwner && (
            <>
              <SelectItem value="__hub__">
                <span className="flex items-center gap-2">
                  <Globe2 size={14} className="shrink-0 text-primary" />
                  Hub Management
                </span>
              </SelectItem>
              <SelectSeparator />
            </>
          )}
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Applications
            </SelectLabel>
            {apps.map((app) => (
              <SelectItem key={app.key} value={app.key}>
                <span className="flex items-center gap-2">
                  <AppWindow size={14} className="shrink-0 text-accent-teal" />
                  {app.name ?? app.key}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
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
  mobileOpen = false,
  onMobileClose = () => {},
}) {
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // The mobile drawer is always full-width, so ignore desktop collapse there.
  const collapsed = sidebarCollapsed && !mobileOpen;

  const handleNavigate = (path) => {
    navigate(path);
    onMobileClose();
  };

  const renderGroup = (items) =>
    items
      .filter((t) => t.show)
      .map((tab) => (
        <NavItem
          key={tab.id}
          tab={tab}
          isActive={isActive(tab.path)}
          onClick={() => handleNavigate(tab.path)}
          collapsed={collapsed}
        />
      ));

  const showAdmin = effectiveRoles.isHubOwner || effectiveRoles.isAppOwner;
  const showGlobal = effectiveRoles.isHubOwner && isGlobalScope;
  const showApp = (effectiveRoles.isHubOwner || effectiveRoles.isAppOwner) && isAppScope;
  const showAppSelector = effectiveRoles.isHubOwner || effectiveRoles.isAppOwner;
  const showResources = effectiveRoles.isHubOwner && isGlobalScope;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex flex-col overflow-hidden border-r border-border bg-white transition-all duration-200 ease-in-out",
          // Mobile: off-canvas drawer
          "fixed inset-y-0 left-0 z-40 w-64 -translate-x-full transform",
          mobileOpen && "translate-x-0",
          // Desktop: static column, collapsible
          "lg:static lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        {/* Mobile drawer header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <span className="text-sm font-bold text-foreground">Menu</span>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {!collapsed && <NavSection label="Personal" />}
          {renderGroup(navGroups.personal)}

          {showAdmin && (
            <>
              {!collapsed && <NavSection label="Administration" />}
              {renderGroup(navGroups.admin)}
            </>
          )}

          {showAppSelector && (
            <>
              {!collapsed && <NavSection label="Application" />}
              <ScopeSelector
                collapsed={collapsed}
                setSidebarCollapsed={setSidebarCollapsed}
                isGlobalScope={isGlobalScope}
                selectedAppKey={selectedAppKey}
                selectedAppName={selectedAppName}
                effectiveRoles={effectiveRoles}
                apps={apps}
                selectGlobal={selectGlobal}
                selectApp={selectApp}
                navigate={handleNavigate}
              />
              {isAppScope && selectedAppName && !collapsed && (
                <p className="mt-1 truncate px-2 text-[11px] font-medium text-primary">
                  Viewing: {selectedAppName}
                </p>
              )}
            </>
          )}

          {showGlobal && (
            <>
              {!collapsed && <NavSection label="Hub Config" />}
              {renderGroup(navGroups.global)}
            </>
          )}

          {showApp && (
            <>
              {!collapsed && (
                <NavSection label={`${selectedAppName ?? "App"} Settings`} />
              )}
              {renderGroup(navGroups.app)}
            </>
          )}

          {showResources && (
            <>
              {!collapsed && <NavSection label="Resources" />}
              {renderGroup(navGroups.resources)}
            </>
          )}
        </nav>

        {/* Desktop collapse toggle */}
        <div className="hidden flex-shrink-0 px-2 pb-2 lg:block">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-transparent py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              size={14}
              className={cn("transition-transform duration-200", collapsed && "rotate-180")}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        <div className="flex-shrink-0 border-t border-border px-3 py-3">
          {collapsed ? (
            <div className="flex justify-center">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                title={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
              >
                {user?.firstName?.charAt(0)}
                {user?.lastName?.charAt(0)}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {user?.firstName?.charAt(0)}
                {user?.lastName?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {getDisplayRole(effectiveRoles)}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
