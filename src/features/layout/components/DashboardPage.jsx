import { Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { getValidHubUrl } from "@/config/env";
import {
  Shield,
  ArrowLeft,
  LogOut,
  User,
  Layers,
  Clock,
  UserCheck,
  Users,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const globalRole = user?.globalRole || user?.role || "USER";
  const isUserRole = globalRole === "USER";
  const adminTabs = [
    {
      id: "user-profile-management",
      name: "User Profile Management",
      icon: Users,
      path: "/user-profile-management",
    },
    {
      id: "account-requests",
      name: "Account Requests",
      icon: UserCheck,
      path: "/account-requests",
    },
    {
      id: "access-requests",
      name: "Access Requests",
      icon: Clock,
      path: "/access-requests",
    },
  ];
  const userTabs = [
    { id: "profile", name: "User Profile", icon: User, path: "/profile" },
    {
      id: "application-role-assignments",
      name: "Application & Role Assignments",
      icon: Layers,
      path: "/application-role-assignments",
    },
  ];
  const tabs = isUserRole ? userTabs : adminTabs;

  const handleBackToHub = () => {
    window.location.href = getValidHubUrl() + "/hub";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToHub}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Hub"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Identity & Access Management
                  </h1>
                  <p className="text-sm text-gray-600">
                    {isUserRole
                      ? "View your profile and access information"
                      : "Manage users and application access"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.name || user?.email}
                  </p>
                  <p className="text-xs text-gray-500">{globalRole}</p>
                </div>
              </div>

              <button
                onClick={() => logout()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 -mb-px">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                    isActive
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};
