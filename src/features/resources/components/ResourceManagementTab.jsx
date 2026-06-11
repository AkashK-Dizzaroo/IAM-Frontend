import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth";
import { resourceService } from "../api/resourceService";
import { applicationService } from "@/features/applications";
import { QK } from "@/lib/queryKeys";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Search, RefreshCw, Pencil, Trash2, ShieldCheck,
  ChevronDown, ChevronRight, FolderOpen, AlertTriangle,
} from "lucide-react";
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Single-resource hard-delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLinkedApps, setDeleteLinkedApps] = useState([]);

  const { data: applicationsData } = useQuery({
    queryKey: QK.applicationsModal,
    queryFn: async () => {
      const response = await applicationService.getApplications();
      return response?.data ?? response ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const applications = applicationsData ?? [];

  const {
    data: resourcesResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: QK.resources({ applicationFilter, levelFilter, statusFilter, searchTerm }),
    queryFn: async () => {
      const params = { limit: 1000, page: 1 };
      if (applicationFilter && applicationFilter !== "all") params.applicationId = applicationFilter;
      if (levelFilter && levelFilter !== "all") params.level = levelFilter;
      if (statusFilter && statusFilter !== "all") params.resource_status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      return resourceService.getResources(params);
    },
  });

  const resources = resourcesResponse?.data ?? [];

  let filteredResources = resources.filter((r) => r.isUnassignedNode !== true);

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredResources = filteredResources.filter((r) => {
      const universalId = r.resourceExternalId ?? r.externalId ?? "";
      return (
        (r.name || "").toLowerCase().includes(term) ||
        universalId.toLowerCase().includes(term)
      );
    });
  }

  function getResourceHierarchy(r) {
    const appName = r.assignedApplications?.[0]?.name ?? r.assignedApplications?.[0]?.key ?? "—";
    if (r.level === 2) return `${appName} > ${r.name ?? "—"}`;
    if (r.level === 3) {
      const parent = r.parentResource;
      if (parent && !parent.isUnassignedNode) {
        return `${appName} > ${parent.name ?? "—"} > ${r.name ?? "—"}`;
      }
      return `${appName} > ${r.name ?? "—"}`;
    }
    return `${appName} > ${r.name ?? "—"}`;
  }

  function getMissingAppId(resource) {
    const assignedIds = (resource.assignedApplications ?? []).map(
      (a) => (a._id ?? a.id ?? a).toString()
    );
    return myAppIds.find((id) => !assignedIds.includes(id.toString()));
  }

  const handleDelete = (resource) => {
    setDeleteTarget(resource);
    setDeleteLinkedApps([]);
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget._id ?? deleteTarget.id;
    setDeletingId(id);
    setDeleteError(null);

    try {
      await resourceService.deleteResource(id);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      setDeleteLinkedApps([]);
      toast({ title: "Success", description: `"${deleteTarget.name}" permanently deleted` });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    } catch (err) {
      const details = err?.details ?? err?.data?.details;
      if (details?.type === 'linked_applications' && details?.applications?.length > 0) {
        setDeleteLinkedApps(details.applications);
      } else if (details?.type === 'has_children' && details?.children?.length > 0) {
        const childNames = details.children.map((c) => c.name).join(", ");
        setDeleteError(`Delete these child resources first: ${childNames}`);
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
      queryClient.invalidateQueries({ queryKey: ['resources'] });
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

  // Bulk select helpers (table view only — only leaf/L3 and L2 resources, not app nodes)
  const selectableResources = filteredResources.filter((r) => !r.isUnassignedNode);
  const allSelected = selectableResources.length > 0 && selectableResources.every((r) => selectedIds.has(r._id || r.id));
  const someSelected = selectableResources.some((r) => selectedIds.has(r._id || r.id)) && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableResources.map((r) => r._id || r.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    let failed = 0;
    await Promise.all(
      ids.map((id) =>
        resourceService.deleteResource(id).catch(() => { failed++; })
      )
    );
    setIsBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['resources'] });
    if (failed > 0) {
      toast({ title: `${ids.length - failed} deleted, ${failed} failed`, description: 'Some resources could not be deleted (may have children).', variant: 'destructive' });
    } else {
      toast({ title: `${ids.length} resource${ids.length === 1 ? '' : 's'} deleted` });
    }
  };

  const [viewMode, setViewMode] = useState("tree");
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const treeData = useMemo(() => {
    if (!resources || !applications) return [];

    const appMap = new Map();

    const l2s = resources.filter(r => r.level === 2 && !r.isUnassignedNode);
    const l3s = resources.filter(r => r.level === 3);
    const l2IdSet = new Set(l2s.map(r => (r._id || r.id).toString()));

    l2s.forEach(l2 => {
      const assignedApps = l2.assignedApplications || [];
      assignedApps.forEach(app => {
        const appId = (app._id || app.id || app).toString();

        if (!appMap.has(appId)) {
          const fullApp = applications.find(a => (a._id || a.id).toString() === appId);
          if (fullApp) {
            appMap.set(appId, {
              ...fullApp,
              type: 'application',
              treeId: `app-${appId}`,
              children: new Map()
            });
          }
        }

        const appNode = appMap.get(appId);
        if (appNode) {
          appNode.children.set((l2._id || l2.id).toString(), {
            ...l2,
            type: 'resource',
            treeId: `app-${appId}-l2-${l2._id || l2.id}`,
            children: []
          });
        }
      });
    });

    l3s.forEach(l3 => {
      const parentId = (l3.parentResource?._id || l3.parentResource?.id || l3.parentId)?.toString();

      if (parentId && l2IdSet.has(parentId)) {
        // Normal L3: attach under its L2 parent
        appMap.forEach(appNode => {
          const l2Node = appNode.children.get(parentId);
          if (l2Node) {
            l2Node.children.push({
              ...l3,
              type: 'resource',
              treeId: `${l2Node.treeId}-l3-${l3._id || l3.id}`
            });
          }
        });
      } else {
        // Orphaned L3: parent was an unassigned node — attach directly under each of its apps
        const assignedApps = l3.assignedApplications || [];
        assignedApps.forEach(app => {
          const appId = (app._id || app.id || app).toString();
          if (!appMap.has(appId)) {
            const fullApp = applications.find(a => (a._id || a.id).toString() === appId);
            if (fullApp) {
              appMap.set(appId, {
                ...fullApp,
                type: 'application',
                treeId: `app-${appId}`,
                children: new Map()
              });
            }
          }
          const appNode = appMap.get(appId);
          if (appNode) {
            const treeId = `app-${appId}-l3-${l3._id || l3.id}`;
            appNode.children.set(treeId, {
              ...l3,
              type: 'resource',
              treeId,
              children: []
            });
          }
        });
      }
    });

    return Array.from(appMap.values())
      .map(app => ({
        ...app,
        children: Array.from(app.children.values())
      }))
      .filter(app => app.children.length > 0)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [resources, applications]);

  const renderTreeNode = (node, level = 0) => {
    const isExpanded = expandedIds.has(node.treeId);
    const hasChildren = node.children && node.children.length > 0;
    const isApp = node.type === 'application';
    const isL2 = node.type === 'resource' && node.level === 2;
    const isL3 = node.type === 'resource' && node.level === 3;

    const rid = node._id || node.id;
    const universalId = node.resourceExternalId ?? node.externalId ?? "—";
    const active = (node.resource_status ?? node.metadata?.resource_status ?? 'active') !== 'inactive';
    const missingAppId = isAppOwner ? getMissingAppId(node) : null;
    const classification = node.metadata?.classification ?? null;

    return (
      <>
        <div
          className={`group flex items-center py-2 px-4 hover:bg-gray-50 border-b border-gray-100 transition-colors ${isApp ? 'bg-gray-50/50' : ''}`}
          style={{ paddingLeft: `${level * 24 + 16}px` }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center w-6 justify-center">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(node.treeId)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </button>
              ) : (
                <div className="w-4 h-4" />
              )}
            </div>

            <div className="flex items-center gap-2 min-w-0">
              {isApp && <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />}
              {isL2 && <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />}
              {isL3 && <RefreshCw className="w-4 h-4 text-green-500 shrink-0" />}

              <span className={`truncate text-sm ${isApp ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                {node.name}
                {isApp && <span className="ml-2 text-xs font-normal text-gray-500">({node.key})</span>}
              </span>

              {!isApp && (
                <Badge variant="outline" className="text-[10px] px-1 h-4 bg-white">
                  L{node.level}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-500 w-[500px]">
            <div className="w-[120px] truncate font-mono text-[10px]" title={universalId}>
              {!isApp && universalId}
            </div>

            <div className="w-[150px]">
              {!isApp && (
                classification ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-5 capitalize">
                    {classification}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-gray-400">—</span>
                )
              )}
            </div>

            <div className="w-[80px]">
              {!isApp && (
                active ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] h-5 px-1.5">Active</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] h-5 px-1.5">Inactive</Badge>
                )
              )}
            </div>

            <div className="flex items-center justify-end flex-1 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isApp ? (
                <span className="text-[10px] text-gray-400">Application</span>
              ) : (
                <>
                  {isHubOwner && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setEditingResource(node);
                          setEditModalOpen(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(node)}
                        disabled={deletingId === rid}
                      >
                        {deletingId === rid ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </>
                  )}
                  {isAppOwner && missingAppId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2"
                      onClick={() => handleAddMyApp(rid, missingAppId)}
                      disabled={addingAppToResourceId === rid}
                    >
                      + Add
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="animate-in slide-in-from-top-1 duration-200">
            {node.children.map(child => (
              <Fragment key={child.treeId}>{renderTreeNode(child, level + 1)}</Fragment>
            ))}
          </div>
        )}
      </>
    );
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Resource
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                    {app.name} ({app.key})
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
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                className={`flex-1 text-xs py-1.5 rounded-md transition-all ${viewMode === 'tree' ? 'bg-white shadow-sm font-semibold' : 'text-gray-500'}`}
                onClick={() => setViewMode('tree')}
              >
                Tree
              </button>
              <button
                className={`flex-1 text-xs py-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm font-semibold' : 'text-gray-500'}`}
                onClick={() => setViewMode('table')}
              >
                Table
              </button>
            </div>
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

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isHubOwner && (
                    <th className="pl-4 pr-2 py-3 w-10">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Universal ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Resource Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Assigned Applications</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Classification</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  {(isHubOwner || isAppOwner) && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={(isHubOwner || isAppOwner) ? 8 : 7} className="px-4 py-6 text-center text-gray-500">
                      Loading resources...
                    </td>
                  </tr>
                ) : filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan={(isHubOwner || isAppOwner) ? 8 : 7} className="px-4 py-6 text-center text-gray-500">
                      No resources found
                    </td>
                  </tr>
                ) : (
                  filteredResources.map((r) => {
                    const universalId = r.resourceExternalId ?? r.externalId ?? "—";
                    const boundApps = (r.assignedApplications ?? []).map(
                      (a) => a?.name ?? a?.key ?? null
                    ).filter(Boolean);
                    const active = (r.resource_status ?? r.metadata?.resource_status ?? 'active') !== 'inactive';
                    const rid = r._id || r.id;
                    const missingAppId = isAppOwner ? getMissingAppId(r) : null;
                    const classification = r.metadata?.classification ?? null;

                    return (
                      <tr key={rid} className={`group ${selectedIds.has(rid) ? 'bg-blue-50/40' : ''}`}>
                        {isHubOwner && (
                          <td className="pl-4 pr-2 py-3 w-10">
                            <Checkbox
                              checked={selectedIds.has(rid)}
                              onCheckedChange={() => toggleSelectOne(rid)}
                              aria-label={`Select ${r.name}`}
                              className={selectedIds.size === 0 ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-mono text-gray-700">
                          {universalId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {r.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          L{r.level ?? "—"}
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
                          {classification ? (
                            <Badge variant="outline" className="text-xs capitalize">
                              {classification}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
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
                        {(isHubOwner || isAppOwner) && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {isHubOwner && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    title="Edit resource"
                                    onClick={() => {
                                      setEditingResource(r);
                                      setEditModalOpen(true);
                                    }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    title="Delete resource"
                                    onClick={() => handleDelete(r)}
                                    disabled={deletingId === rid}
                                  >
                                    {deletingId === rid
                                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />}
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
                                  {addingAppToResourceId === rid ? "Adding…" : "+ Add my App"}
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
            {/* Floating bulk action bar — table view */}
            {selectedIds.size > 0 && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{selectedIds.size} selected</span>
                  <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-500 hover:text-gray-700 underline">
                    Deselect all
                  </button>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete {selectedIds.size} {selectedIds.size === 1 ? 'resource' : 'resources'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center py-2.5 px-4 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div className="flex-1">Hierarchy / Name</div>
              <div className="flex items-center gap-6 w-[500px]">
                <div className="w-[120px]">Universal ID</div>
                <div className="w-[150px]">Classification</div>
                <div className="w-[80px]">Status</div>
                <div className="flex-1 text-right">Actions</div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading resources...</div>
              ) : treeData.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No hierarchical resources found</div>
              ) : (
                treeData.map(app => (
                  <Fragment key={app.treeId}>{renderTreeNode(app)}</Fragment>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Single resource hard-delete confirmation */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) { setDeleteTarget(null); setDeleteLinkedApps([]); setDeleteError(null); }
          setDeleteConfirmOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              Permanently delete resource?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.name && (
                <span className="font-medium text-foreground">"{deleteTarget.name}"</span>
              )}{" "}
              will be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteLinkedApps.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Unlink from these applications first:
              </p>
              <ul className="space-y-1">
                {deleteLinkedApps.map((app) => (
                  <li key={app.id} className="text-sm text-amber-700 flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    {app.name}
                    <Badge variant="outline" className="text-[10px] ml-auto">{app.key}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={!!deletingId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!!deletingId || deleteLinkedApps.length > 0}
            >
              {deletingId ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} {selectedIds.size === 1 ? 'resource' : 'resources'}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">These resources will be <strong>permanently deleted</strong>. Resources still linked to applications or with children will fail — unlink them first.</p>
            <ul className="text-sm text-gray-700 space-y-1 max-h-40 overflow-y-auto">
              {filteredResources
                .filter((r) => selectedIds.has(r._id || r.id))
                .slice(0, 5)
                .map((r) => {
                  const rid = r._id || r.id;
                  return (
                    <li key={rid} className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{r.name}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto shrink-0">L{r.level}</Badge>
                    </li>
                  );
                })}
              {selectedIds.size > 5 && (
                <li className="text-gray-400 text-xs">…and {selectedIds.size - 5} more</li>
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isBulkDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          queryClient.invalidateQueries({ queryKey: ['resources'] });
        }}
      />
    </div>
  );
}
