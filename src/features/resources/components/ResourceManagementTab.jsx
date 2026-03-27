import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth";
import { resourceService } from "../api/resourceService";
import { applicationService } from "@/features/applications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { ResourceRegistrationModal } from "./ResourceRegistrationModal";
import { EditResourceModal } from "./EditResourceModal";

export function ResourceManagementTab() {
  const { effectiveRoles } = useAuth();
  const isHubOwner = effectiveRoles?.isHubOwner;
  const isAppOwner = effectiveRoles?.isAppOwner && !isHubOwner;
  const myAppIds = effectiveRoles?.appOwnerOf ?? [];

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [editingResource, setEditingResource] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [addingAppToResourceId, setAddingAppToResourceId] = useState(null);

  const { data: applicationsData } = useQuery({
    queryKey: ["applications-resources"],
    queryFn: async () => {
      const response = await applicationService.getApplications();
      return response?.data ?? response ?? [];
    },
  });

  const applications = applicationsData ?? [];

  const {
    data: resourcesResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["resources", applicationFilter, levelFilter, statusFilter, searchTerm],
    queryFn: async () => {
      const params = { limit: 1000, page: 1 };
      if (applicationFilter && applicationFilter !== "all") params.applicationId = applicationFilter;
      if (levelFilter && levelFilter !== "all") params.level = levelFilter;
      if (statusFilter && statusFilter !== "all") params.isActive = statusFilter === "active";
      if (searchTerm) params.search = searchTerm;
      return resourceService.getResources(params);
    },
  });

  const resources = resourcesResponse?.data ?? [];

  let filteredResources = resources.filter((r) => r.isUnassignedNode !== true);

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredResources = filteredResources.filter((r) => {
      const universalId = r.resourceExternalId ?? "";
      return (
        (r.name || "").toLowerCase().includes(term) ||
        universalId.toLowerCase().includes(term)
      );
    });
  }

  function getResourceHierarchy(r) {
    const appName = r.assignedApplications?.[0]?.name ?? r.assignedApplications?.[0]?.appCode ?? "—";
    if (r.level === 2) {
      return `${appName} > ${r.name ?? "—"}`;
    }
    if (r.level === 3 && r.parentResource) {
      const parentName = r.parentResource?.name ?? "—";
      return `${appName} > ${parentName} > ${r.name ?? "—"}`;
    }
    return `${appName} > ${r.name ?? "—"}`;
  }

  function getMissingAppId(resource) {
    const assignedIds = (resource.assignedApplications ?? []).map(
      (a) => (a._id ?? a.id ?? a).toString()
    );
    return myAppIds.find((id) => !assignedIds.includes(id.toString()));
  }

  const handleDelete = async (resource) => {
    const confirmed = window.confirm(
      `Delete "${resource.name}"? This will deactivate the resource.`
    );
    if (!confirmed) return;

    setDeletingId(resource._id ?? resource.id);
    setDeleteError(null);

    try {
      const result = await resourceService.deleteResource(resource._id ?? resource.id);

      if (result?.success === false) {
        if (result.details?.children) {
          const childNames = result.details.children.map((c) => c.name).join(", ");
          setDeleteError(
            `Cannot delete "${resource.name}". Delete these L3 resources first: ${childNames}`
          );
        } else {
          setDeleteError(result.error ?? "Failed to delete resource");
        }
        return;
      }

      toast({ title: "Success", description: `"${resource.name}" deleted successfully` });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    } catch (err) {
      const details = err?.details ?? err?.data?.details;
      if (details?.children) {
        const childNames = details.children.map((c) => c.name).join(", ");
        setDeleteError(
          `Cannot delete "${resource.name}". Delete these L3 resources first: ${childNames}`
        );
      } else {
        setDeleteError(err?.message ?? "Failed to delete resource");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddMyApp = async (resourceId, appId) => {
    setAddingAppToResourceId(resourceId);
    try {
      await resourceService.addApplicationToResource(resourceId, appId);
      toast({ title: "Success", description: "Your application added to this resource" });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    } catch (err) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to add application",
        variant: "destructive",
      });
    } finally {
      setAddingAppToResourceId(null);
    }
  };

  const showActionsColumn = isHubOwner || isAppOwner;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Resource
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name or Universal ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={applicationFilter} onValueChange={setApplicationFilter}>
              <SelectTrigger>
                <SelectValue>
                  {applicationFilter === "all"
                    ? "All Applications"
                    : applications.find((a) => (a._id || a.id) === applicationFilter)?.name ??
                      "All Applications"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Applications</SelectItem>
                {applications.map((app) => (
                  <SelectItem key={app._id || app.id} value={app._id || app.id}>
                    {app.name} ({app.appCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue>
                  {levelFilter === "all" ? "All Levels" : `Level ${levelFilter}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="2">Level 2 (Project/Site)</SelectItem>
                <SelectItem value="3">Level 3 (Study)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue>
                  {statusFilter === "all" ? "All Statuses" : statusFilter === "active" ? "Active" : "Inactive"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <div className="text-sm text-gray-600">
              {filteredResources.length} resource{filteredResources.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3">
          {error?.message ?? "Failed to load resources"}
        </div>
      )}

      {deleteError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-sm text-destructive">{deleteError}</p>
          <button
            className="text-xs underline mt-1 text-destructive"
            onClick={() => setDeleteError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Resource Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Resource Hierarchy
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Universal ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Assigned Applications
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Status
                </th>
                {showActionsColumn && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={showActionsColumn ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                    Loading resources...
                  </td>
                </tr>
              ) : filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={showActionsColumn ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                    No resources found
                  </td>
                </tr>
              ) : (
                filteredResources.map((r) => {
                  const universalId = r.resourceExternalId ?? "—";
                  const boundApps = (r.assignedApplications ?? []).map(
                    (a) => a?.name ?? a?.appCode ?? null
                  ).filter(Boolean);
                  const active = r.isActive !== false;
                  const rid = r._id || r.id;
                  const missingAppId = isAppOwner ? getMissingAppId(r) : null;

                  return (
                    <tr key={rid}>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {r.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        L{r.level ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getResourceHierarchy(r)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-xs text-gray-700">
                        {universalId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {boundApps.length > 0 ? (
                            boundApps.map((appName) => (
                              <Badge
                                key={appName}
                                variant="secondary"
                                className="text-xs"
                              >
                                {appName}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {active ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      {showActionsColumn && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {isHubOwner && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingResource(r);
                                    setEditModalOpen(true);
                                  }}
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(r)}
                                  disabled={deletingId === rid}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  {deletingId === rid ? "Deleting..." : "Delete"}
                                </Button>
                              </>
                            )}
                            {isAppOwner && missingAppId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddMyApp(rid, missingAppId)}
                                disabled={addingAppToResourceId === rid}
                              >
                                {addingAppToResourceId === rid
                                  ? "Adding..."
                                  : "+ Add my App"}
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ResourceRegistrationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          refetch();
          setShowCreateModal(false);
        }}
      />

      <EditResourceModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        resource={editingResource}
        onSuccess={() => {
          setEditingResource(null);
          queryClient.invalidateQueries({ queryKey: ["resources"] });
        }}
      />
    </div>
  );
}
