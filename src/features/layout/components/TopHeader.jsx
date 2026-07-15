import { ArrowLeft, LogOut, Menu } from "lucide-react";
import { getDisplayRole } from "@/lib/roles";

// Addendum §5.1 app-shell top bar: Dizzaroo mark far left (symbol-alone logo
// variant, sanctioned by the Brand Manual for apps) with the product name
// beside it; user identity and the Logout trigger on the far right.
export function TopHeader({ user, effectiveRoles, onBackToHub, onLogout, onToggleMobileNav }) {
  const initials = `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}` || "?";
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  return (
    <header className="z-10 flex-shrink-0 border-b border-border bg-background shadow-sm">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onToggleMobileNav}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onBackToHub}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              title="Back to Hub"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              {/* Brand mark — keep clearspace; swap src for the horizontal
                  wordmark asset if/when it lands in public/. */}
              <img
                src="/favicon.png"
                alt="Dizzaroo"
                className="h-8 w-8 shrink-0 object-contain"
              />
              <div className="h-8 w-px bg-border" aria-hidden="true" />
              <div>
                <h1 className="text-sm font-bold leading-tight text-foreground">
                  Identity &amp; Access Management
                </h1>
                <p className="text-xs leading-tight text-muted-foreground">
                  {effectiveRoles.canAccessAdmin
                    ? "Manage users and application access"
                    : "View your profile and access information"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </div>
                <div className="min-w-0 text-right sm:text-left">
                  <p className="max-w-[160px] truncate text-xs font-medium leading-tight text-foreground">
                    {fullName || user?.email}
                  </p>
                  <p className="text-[11px] leading-tight text-muted-foreground">
                    {getDisplayRole(effectiveRoles)}
                  </p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
