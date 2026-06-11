import { Shield, ArrowLeft, LogOut } from "lucide-react";

export function TopHeader({ effectiveRoles, onBackToHub, onLogout }) {
  return (
    <header className="flex-shrink-0 bg-white shadow-sm border-b border-gray-100 z-10">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
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

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
