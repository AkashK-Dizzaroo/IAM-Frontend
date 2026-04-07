import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth";
import { resourceService } from "../api/resourceService";
import { applicationService } from "@/features/applications";
import { abacService } from "@/features/abac/api/abacService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, RefreshCw, Pencil, Trash2, ShieldCheck,
  ChevronDown, ChevronRight, X, FolderOpen,
} from "lucide-react";
import { ResourceRegistrationModal } from "./ResourceRegistrationModal";
import { EditResourceModal } from "./EditResourceModal";

const EMPTY_CLS_FORM = { key: "", displayName: "", description: "", sensitivityLevel: 0 };

function sensitivityColor(level) {
  if (level <= 1) return "bg-green-500";
  if (level <= 3) return "bg-amber-500";
  return "bg-red-500";
}

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

  // Classification management state
  const [clsPanelOpen, setClsPanelOpen] = useState(false);
  const [clsSlideOver, setClsSlideOver] = useState(null); // null | 'create' | classificationObject
  const [clsForm, setClsForm] = useState(EMPTY_CLS_FORM);
  const [clsDeleteConfirmId, setClsDeleteConfirmId] = useState(null);

  const { data: applicationsData } = useQuery({
    queryKey: ["applications-resources"],
    queryFn: async () => {
      const response = await applicationService.getApplications();
      return response?.data ?? response ?? [];
    },
  });

  const applications = applicationsData ?? [];

  const { data: classificationsData } = useQuery({
    queryKey: ["classifications"],
    queryFn: async () => {
      const res = await abacService.listClassifications();
      return res?.data?.data ?? res?.data ?? [];
    },
    staleTime: 60_000,
  });

  const classifications = classificationsData ?? [];

  // Classification CRUD mutations
  const createClsMutation = useMutation({
    mutationFn: (data) => abacService.createClassification(data),
    onSuccess: () => {
      toast({ title: "Classification created" });
      queryClient.invalidateQueries({ queryKey: ["classifications"] });
      setClsSlideOver(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateClsMutation = useMutation({
    mutationFn: ({ id, data }) => abacService.updateClassification(id, data),
    onSuccess: () => {
      toast({ title: "Classification updated" });
      queryClient.invalidateQueries({ queryKey: ["classifications"] });
      setClsSlideOver(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteClsMutation = useMutation({
    mutationFn: (id) => abacService.deleteClassification(id),
    onSuccess: () => {
      toast({ title: "Classification deleted" });
      setClsDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ["classifications"] });
    },
    onError: (err) => {
      setClsDeleteConfirmId(null);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openClsCreate = useCallback(() => {
    setClsForm(EMPTY_CLS_FORM);
    setClsSlideOver("create");
  }, []);

  const openClsEdit = useCallback((item) => {
    setClsForm({
      key: item.key || "",
      displayName: item.displayName || "",
      description: item.description || "",
      sensitivityLevel: item.sensitivityLevel ?? 0,
    });
    setClsSlideOver(item);
  }, []);

  const handleClsSave = () => {
    if (clsSlideOver === "create") {
      createClsMutation.mutate(clsForm);
    } else {
      const { key, ...rest } = clsForm;
      updateClsMutation.mutate({ id: clsSlideOver.id || clsSlideOver._id, data: rest });
    }
  };

  const clsSaving = createClsMutation.isPending || updateClsMutation.isPending;

  const classificationMutation = useMutation({
    mutationFn: ({ resourceId, applicationId, classificationId }) =>
      resourceService.setClassification(resourceId, applicationId, classificationId),
    onSuccess: () => {
      toast({ title: "Success", description: "Classification updated" });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err?.message ?? "Failed to update classification", variant: "destructive" });
    },
  });

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

  // Count resources per classification (across all resource-application mappings)
  const classificationCounts = useMemo(() => {
    const counts = {}; // classificationId -> Set of resourceIds
    for (const r of resources) {
      for (const app of r.assignedApplications ?? []) {
        if (app.classification?.id) {
          if (!counts[app.classification.id]) counts[app.classification.id] = new Set();
          counts[app.classification.id].add(r._id || r.id);
        }
      }
    }
    const result = {};
    for (const [clsId, resourceSet] of Object.entries(counts)) {
      result[clsId] = resourceSet.size;
    }
    return result;
  }, [resources]);

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

  const sortedClassifications = [...classifications].sort(
    (a, b) => a.sensitivityLevel - b.sensitivityLevel
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        {isHubOwner && (
          <Button variant="outline" onClick={() => setClsPanelOpen((v) => !v)}>
            {clsPanelOpen ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
            Classifications ({classifications.length})
          </Button>
        )}
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Resource
        </Button>
      </div>

      {/* ── Classification Management Panel (HubOwner only) ────────── */}
      {isHubOwner && clsPanelOpen && (
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Resource Classifications</h3>
              <p className="text-xs text-gray-500 mt-0.5">Sensitivity taxonomy used in ABAC policy conditions</p>
            </div>
            <Button size="sm" onClick={openClsCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Classification
            </Button>
          </div>

          {sortedClassifications.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No classifications defined yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedClassifications.map((item) => {
                const id = item.id || item._id;
                const isDeleting = clsDeleteConfirmId === id;
                const level = item.sensitivityLevel ?? 0;
                const pct = Math.min(Math.max((level / 4) * 100, 0), 100);
                const count = classificationCounts[id] ?? 0;

                return (
                  <Card key={id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-900">{item.key}</span>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <FolderOpen className="w-2.5 h-2.5" />
                          {count} resource{count !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      {!isDeleting && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openClsEdit(item)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => setClsDeleteConfirmId(id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-700">{item.displayName || "—"}</div>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{item.description || "—"}</p>
                    <div>
                      <div className="text-[11px] text-gray-500 mb-1">Sensitivity Level {level}/4</div>
                      <div className="bg-gray-100 rounded-full h-1.5 w-full">
                        <div
                          className={`${sensitivityColor(level)} rounded-full h-1.5 transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {isDeleting && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <span className="text-xs text-red-600 flex-1">Delete? This cannot be undone.</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setClsDeleteConfirmId(null)}>Cancel</Button>
                        <Button variant="destructive" size="sm" className="h-6 text-xs" onClick={() => deleteClsMutation.mutate(id)} disabled={deleteClsMutation.isPending}>
                          {deleteClsMutation.isPending ? "..." : "Confirm"}
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Classification Slide-over (create/edit) ─────────────────── */}
      {clsSlideOver !== null && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setClsSlideOver(null)} />
          <div className="fixed right-0 top-0 h-full w-[400px] z-50 bg-white border-l border-gray-200 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">
                {clsSlideOver === "create" ? "New Classification" : "Edit Classification"}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setClsSlideOver(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Key</Label>
                <Input
                  value={clsForm.key}
                  onChange={(e) => setClsForm((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/\s/g, "") }))}
                  className="font-mono"
                  disabled={clsSlideOver !== "create"}
                  placeholder="e.g. phi"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  value={clsForm.displayName}
                  onChange={(e) => setClsForm((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. Protected Health Information"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={clsForm.description}
                  onChange={(e) => setClsForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe this classification level..."
                />
              </div>
              <div className="space-y-2">
                <Label>Sensitivity Level (0-4)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={4}
                    value={clsForm.sensitivityLevel}
                    onChange={(e) => setClsForm((p) => ({ ...p, sensitivityLevel: Number(e.target.value) }))}
                    className="flex-1 accent-gray-900"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min={0}
                      max={4}
                      value={clsForm.sensitivityLevel}
                      onChange={(e) => {
                        const v = Math.min(4, Math.max(0, Number(e.target.value) || 0));
                        setClsForm((p) => ({ ...p, sensitivityLevel: v }));
                      }}
                      className="w-14 text-center"
                    />
                    <div className={`h-3 w-3 rounded-full ${sensitivityColor(clsForm.sensitivityLevel)}`} />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setClsSlideOver(null)}>Cancel</Button>
              <Button onClick={handleClsSave} disabled={clsSaving}>
                {clsSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </>
      )}

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
                  Classification
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
                  <td colSpan={showActionsColumn ? 8 : 7} className="px-4 py-6 text-center text-gray-500">
                    Loading resources...
                  </td>
                </tr>
              ) : filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={showActionsColumn ? 8 : 7} className="px-4 py-6 text-center text-gray-500">
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
                        <div className="space-y-1">
                          {(r.assignedApplications ?? []).map((app) => {
                            const appId = app._id || app.id;
                            const cls = app.classification;
                            return (
                              <div key={appId} className="flex items-center gap-2">
                                {isHubOwner ? (
                                  <Select
                                    value={cls?.id ?? "none"}
                                    onValueChange={(val) =>
                                      classificationMutation.mutate({
                                        resourceId: rid,
                                        applicationId: appId,
                                        classificationId: val === "none" ? null : val,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs w-[160px]">
                                      <SelectValue>
                                        {cls ? `${cls.displayName} (L${cls.sensitivityLevel})` : "Unclassified"}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Unclassified</SelectItem>
                                      {classifications
                                        .sort((a, b) => a.sensitivityLevel - b.sensitivityLevel)
                                        .map((c) => (
                                          <SelectItem key={c.id || c._id} value={c.id || c._id}>
                                            <span className="flex items-center gap-2">
                                              <ShieldCheck className="w-3 h-3" />
                                              {c.displayName} (L{c.sensitivityLevel})
                                            </span>
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                ) : cls ? (
                                  <Badge
                                    className={`text-xs ${
                                      cls.sensitivityLevel >= 4
                                        ? "bg-red-100 text-red-800 border-red-200"
                                        : cls.sensitivityLevel >= 2
                                        ? "bg-amber-100 text-amber-800 border-amber-200"
                                        : "bg-green-100 text-green-800 border-green-200"
                                    }`}
                                  >
                                    {cls.displayName} (L{cls.sensitivityLevel})
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                                {(r.assignedApplications ?? []).length > 1 && (
                                  <span className="text-[10px] text-gray-400">{app.appCode}</span>
                                )}
                              </div>
                            );
                          })}
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
