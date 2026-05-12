import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { profileService } from "../api/profileService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Shield, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

export const ApplicationRoleAssignmentsPage = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    application: "all",
    resource: "all",
    role: "all",
  });

  const { data: assignmentsData, isLoading, error } = useQuery({
    queryKey: ["userAssignments"],
    queryFn: async () => {
      const uid = user?.id || user?.user_id;
      const response = await profileService.getUserRolesAndResources(uid);
      return response.data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading assignments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">Failed to load assignments</p>
              <p className="text-sm text-gray-500">
                {error.message ||
                  "An error occurred while fetching your assignments"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignments = assignmentsData || [];

  const filterOptions = useMemo(() => {
    const apps = new Map();
    const resources = new Set();
    const roles = new Set();

    for (const a of assignments) {
      const key = a?.application?.key || a?.application?.id || a?.applicationId || a?.appKey || null;
      const name = a?.application?.name || a?.application?.key || a?.appName || null;
      if (key && !apps.has(String(key))) apps.set(String(key), String(name || key));

      const resourceName =
        a?.resource?.name ||
        a?.resourceName ||
        a?.resource?.resourceExternalId ||
        null;
      if (resourceName) resources.add(String(resourceName));

      const roleName =
        a?.role?.name ||
        a?.roleName ||
        a?.role?.roleCode ||
        a?.roleCode ||
        (typeof a?.role === "string" ? a.role : null);
      if (roleName) roles.add(String(roleName));
    }

    return {
      applications: Array.from(apps.entries()).map(([value, label]) => ({ value, label }))
        .sort((x, y) => x.label.localeCompare(y.label)),
      resources: Array.from(resources).sort((a, b) => a.localeCompare(b)),
      roles: Array.from(roles).sort((a, b) => a.localeCompare(b)),
    };
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const norm = (v) => String(v || "").trim().toLowerCase();
    const appFilter = filters.application;
    const resFilter = filters.resource;
    const roleFilter = filters.role;

    return assignments.filter((a) => {
      if (appFilter !== "all") {
        const k = String(a?.application?.key || a?.application?.id || a?.applicationId || a?.appKey || "");
        if (k !== String(appFilter)) return false;
      }
      if (resFilter !== "all") {
        const rn =
          a?.resource?.name ||
          a?.resourceName ||
          a?.resource?.resourceExternalId ||
          "";
        if (norm(rn) !== norm(resFilter)) return false;
      }
      if (roleFilter !== "all") {
        const ro =
          a?.role?.name ||
          a?.roleName ||
          a?.role?.roleCode ||
          a?.roleCode ||
          (typeof a?.role === "string" ? a.role : "");
        if (norm(ro) !== norm(roleFilter)) return false;
      }
      return true;
    });
  }, [assignments, filters]);

  const formatDate = (date) => {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "—";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Application & Role Assignments
        </h2>
        <p className="text-gray-600 mt-1">
          View all your application access, roles, and resource assignments
        </p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">You don't have any assignments yet.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Assignments
                </CardTitle>
                <CardDescription>
                  Your application access, roles, and resource assignments
                </CardDescription>
              </div>
              <div className="text-xs text-gray-500">
                {filteredAssignments.length}{" "}
                {filteredAssignments.length === 1 ? "assignment" : "assignments"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 py-4 border-b bg-white">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs text-gray-500">Application</Label>
                  <Select
                    value={filters.application}
                    onValueChange={(v) => setFilters((p) => ({ ...p, application: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All applications" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.applications.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-500">Resource</Label>
                  <Select
                    value={filters.resource}
                    onValueChange={(v) => setFilters((p) => ({ ...p, resource: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All resources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.resources.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-500">Role</Label>
                  <Select
                    value={filters.role}
                    onValueChange={(v) => setFilters((p) => ({ ...p, role: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filterOptions.roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Application
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Approved by
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Approved date
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssignments.map((assignment) => {
                    const isExpired =
                      assignment.validUntil &&
                      new Date(assignment.validUntil) < new Date();
                    const isActive =
                      assignment.isActive && !isExpired;

                    return (
                      <tr
                        key={assignment.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {assignment.application?.name ||
                                  "Unknown Application"}
                              </div>
                              {assignment.application?.key && (
                                <div className="text-xs text-gray-500 truncate">
                                  {assignment.application.key}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {assignment.resource && assignment.resource.name ? (
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {assignment.resource.name}
                              </div>
                              {assignment.resource.level != null && (
                                <div className="text-xs text-gray-500 truncate">
                                  Level {assignment.resource.level}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">
                              Global Access
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {assignment.role ? (
                            <Badge variant="outline" className="text-xs">
                              {assignment.role.roleCode || assignment.role.name}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {assignment.assignedBy ? (
                            <div className="min-w-0">
                              <div className="text-gray-900 truncate">
                                {assignment.assignedBy.name ||
                                  assignment.assignedBy.email ||
                                  "—"}
                              </div>
                              {assignment.assignedBy.name &&
                                assignment.assignedBy.email && (
                                  <div className="text-xs text-gray-500 truncate">
                                    {assignment.assignedBy.email}
                                  </div>
                                )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-gray-700">
                          {formatDate(assignment.validFrom)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant={isActive ? "default" : "secondary"}
                            className="flex items-center gap-1 w-fit"
                          >
                            {isActive ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                {isExpired ? "Expired" : "Inactive"}
                              </>
                            )}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
