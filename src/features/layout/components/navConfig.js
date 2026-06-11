import {
  User,
  Users,
  FolderOpen,
  Layers,
  FileText,
  FlaskConical,
  AlertTriangle,
  Globe2,
  AppWindow,
  BarChart2,
  Tag,
  UserCog,
  ClipboardList,
  Building2,
  Boxes,
  ShieldCheck,
} from "lucide-react";

export function buildNavGroups({ effectiveRoles, isGlobalScope, isAppScope, selectedAppId }) {
  const personal = [
    { id: "my-profile", label: "My Profile", icon: User, path: "/my-profile", show: true },
  ];

  const admin = [
    { id: "account-approvals", label: "Account Approvals", icon: ShieldCheck, path: "/account-approvals", show: effectiveRoles.isHubOwner },
    { id: "access-approvals", label: "Access Approvals", icon: ClipboardList, path: "/access-approvals", show: effectiveRoles.isHubOwner || effectiveRoles.isAppOwner },
  ];

  const global = [
    { id: "users", label: "Users", icon: Users, path: "/users", show: effectiveRoles.isHubOwner },
    { id: "hub-attributes", label: "Hub Attributes", icon: Tag, path: "/hub-attributes", show: effectiveRoles.isHubOwner },
    { id: "global-policies", label: "Global Policies", icon: Globe2, path: "/global-policies", show: effectiveRoles.isHubOwner },
    { id: "applications", label: "Applications", icon: AppWindow, path: "/applications", show: effectiveRoles.isHubOwner },
    { id: "facilities", label: "Facilities", icon: Building2, path: "/facilities", show: effectiveRoles.isHubOwner },
    { id: "audit", label: "Audit Trail", icon: BarChart2, path: "/audit", show: effectiveRoles.isHubOwner },
  ];

  const canSeeApp = effectiveRoles.isHubOwner || (effectiveRoles.isAppOwner && effectiveRoles.appOwnerOf.includes(selectedAppId));
  const showApp = canSeeApp && isAppScope;
  const app = [
    { id: "app-attributes", label: "App Attributes", icon: Layers, path: "/app-attributes", show: showApp },
    { id: "app-user-attributes", label: "App Users", icon: UserCog, path: "/app-user-attributes", show: showApp },
    { id: "app-policies", label: "App Policies", icon: FileText, path: "/app-policies", show: showApp },
    { id: "policy-tester", label: "Policy Tester", icon: FlaskConical, path: "/policy-tester", show: showApp },
    { id: "coverage-gaps", label: "Coverage Gaps", icon: AlertTriangle, path: "/coverage-gaps", show: showApp },
    { id: "app-resources", label: "App Resources", icon: Boxes, path: "/app-resources", show: showApp },
  ];

  const resources = [
    { id: "resources", label: "Resources", icon: FolderOpen, path: "/resources", show: effectiveRoles.isHubOwner || effectiveRoles.isAppOwner },
  ];

  return { personal, admin, global, app, resources };
}
