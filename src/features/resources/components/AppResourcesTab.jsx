import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { resourceService } from "../api/resourceService";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Unlink,
  Link2,
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
} from "lucide-react";
import { EditResourceModal } from "./EditResourceModal";
import { LinkResourceModal } from "./LinkResourceModal";
import { AppResourceRegistrationModal } from "./AppResourceRegistrationModal";

/**
 * Identifies the system-managed Level-1 "application" resource row that the
 * backend auto-creates for every Application (`metadata.type === 'application'`).
 * These rows are undeletable/uneditable/unlinkable via the resource API (backend returns
 * 409 `{ details: { type: 'application_resource' } }`), so the UI must not offer
 * Edit/Unlink actions or bulk-select for them.
 * @param {object} r - a resource row
 * @returns {boolean} true if the row is a system-managed application resource
 */
const isAppResource = (r) => r?.metadata?.type === 'application';

/**
 * Per-application resource management tab.
 * Shows only resources linked to the given application.
 * Actions: Edit (global save), Unlink (removes ResourceApplication), Delete (HUB_OWNER only, deactivates globally).
 */
export function AppResourcesTab({ application }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const applicationId = application?._id ?? application?.id;

  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [expandedIds, setExpandedIds] = useState(new Set());

  const [editingResource, setEditingResource] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [unlinkingId, setUnlinkingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUnlinkOpen, setBulkUnlinkOpen] = useState(false);
  const [isBulkUnlinking, setIsBulkUnlinking] = useState(false);

  const {
    data: resourcesResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: QK.resourcesByApp(applicationId),
    queryFn: async () => {
      const params = {};
      if (levelFilter !== "all") params.level = levelFilter;
      if (statusFilter !== "all") params.resource_status = statusFilter;
      return resourceService.getResourcesByApplication(applicationId, params);
    },
    enabled: !!applicationId,
  });

  const rawResources = resourcesResponse?.data ?? [];

  // Exclude ghost unassigned nodes from display
  const resources = useMemo(() => {
    let list = rawResources.filter((r) => r.isUnassignedNode !== true);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((r) => {
        const uid = r.resourceExternalId ?? r.externalId ?? "";
        return r.name?.toLowerCase().includes(term) || uid.toLowerCase().includes(term);
      });
    }
    return list;
  }, [rawResources, searchTerm]);

  // ── Tree view ────────────────────────────────────────────────────────────

  const treeData = useMemo(() => {
    // Note: L1 (system-managed application) resource rows are intentionally excluded
    // from the tree — only L2/L3 resources are filtered in, so a `level === 1` row can
    // never become a tree node here (it's still visible via the Table view).
    const l2s = resources.filter((r) => r.level === 2);
    const l3s = resources.filter((r) => r.level === 3);
    const l2IdSet = new Set(l2s.map((r) => (r._id ?? r.id).toString()));

    const l2Nodes = l2s.map((l2) => {
      const l2Id = (l2._id ?? l2.id).toString();
      const children = l3s
        .filter((l3) => {
          const parentId = (l3.parentResource?._id ?? l3.parentResource?.id ?? l3.parentId)?.toString();
          return parentId === l2Id;
        })
        .map((l3) => ({ ...l3, treeId: `l2-${l2Id}-l3-${l3._id ?? l3.id}` }));
      return { ...l2, treeId: `l2-${l2Id}`, children };
    });

    // L3s whose parent was the unassigned node (not in l2IdSet) render as root-level leaves.
    const orphanedL3s = l3s
      .filter((l3) => {
        const parentId = (l3.parentResource?._id ?? l3.parentResource?.id ?? l3.parentId)?.toString();
        return !parentId || !l2IdSet.has(parentId);
      })
      .map((l3) => ({ ...l3, treeId: `l3-${l3._id ?? l3.id}`, children: [] }));

    return [...l2Nodes, ...orphanedL3s].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [resources]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Hierarchy label for table view ───────────────────────────────────────

  function getHierarchyLabel(r) {
    const appName = application?.name ?? application?.key ?? "—";
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

  // ── Unlink ───────────────────────────────────────────────────────────────

  const unlinkMutation = useMutation({
    mutationFn: ({ resourceId }) => resourceService.unlinkResourceFromApp(resourceId, applicationId),
    onSuccess: (data, { resourceName }) => {
      const childCount = data?.unlinkedChildrenCount ?? 0;
      toast({
        title: "Unlinked",
        description: childCount > 0
          ? `"${resourceName}" and ${childCount} sub-resource${childCount === 1 ? '' : 's'} removed from this application`
          : `"${resourceName}" removed from this application`,
      });
      queryClient.invalidateQueries({ queryKey: QK.resourcesByApp(applicationId) });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err?.message ?? "Failed to unlink resource", variant: "destructive" });
    },
    onSettled: () => setUnlinkingId(null),
  });

  // Level-3 children of a level-2 resource that are currently linked to this app —
  // these will be cascade-unlinked along with their parent.
  const getLinkedChildren = (r) => {
    if (r.level !== 2) return [];
    const parentId = r._id ?? r.id;
    return resources.filter((x) => {
      if (x.level !== 3) return false;
      const xParentId = (x.parentResource?._id ?? x.parentResource?.id ?? x.parentId)?.toString();
      return xParentId === parentId?.toString();
    });
  };

  const [unlinkTarget, setUnlinkTarget] = useState(null);

  const handleUnlink = (r) => {
    setUnlinkTarget(r);
  };

  const confirmUnlink = () => {
    if (!unlinkTarget) return;
    const id = unlinkTarget._id ?? unlinkTarget.id;
    setUnlinkingId(id);
    unlinkMutation.mutate({ resourceId: id, resourceName: unlinkTarget.name });
    setUnlinkTarget(null);
  };

  const unlinkTargetChildren = unlinkTarget ? getLinkedChildren(unlinkTarget) : [];

  // ── Bulk select helpers (table view) ─────────────────────────────────────
  // Excludes the system-managed L1 application resource — it can never be unlinked
  // (backend returns 409), so it must not be selectable for bulk unlink.
  const selectableResources = useMemo(() => resources.filter((r) => !isAppResource(r)), [resources]);
  const allSelected = selectableResources.length > 0 && selectableResources.every((r) => selectedIds.has(r._id ?? r.id));
  const someSelected = selectableResources.some((r) => selectedIds.has(r._id ?? r.id)) && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableResources.map((r) => r._id ?? r.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkUnlink = async () => {
    setIsBulkUnlinking(true);
    const ids = Array.from(selectedIds);
    let failed = 0;
    let cascadedChildren = 0;
    await Promise.all(
      ids.map((id) =>
        resourceService.unlinkResourceFromApp(id, applicationId)
          .then((data) => { cascadedChildren += data?.unlinkedChildrenCount ?? 0; })
          .catch(() => { failed++; })
      )
    );
    setIsBulkUnlinking(false);
    setBulkUnlinkOpen(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: QK.resourcesByApp(applicationId) });
    queryClient.invalidateQueries({ queryKey: QK.resourcesAll });
    if (failed > 0) {
      toast({ title: `${ids.length - failed} unlinked, ${failed} failed`, variant: 'destructive' });
    } else {
      toast({
        title: cascadedChildren > 0
          ? `${ids.length} resource${ids.length === 1 ? '' : 's'} and ${cascadedChildren} sub-resource${cascadedChildren === 1 ? '' : 's'} unlinked`
          : `${ids.length} resource${ids.length === 1 ? '' : 's'} unlinked`,
      });
    }
  };

  // L3 resources not individually selected but that will be cascade-unlinked
  // because their L2 parent is selected — shown in the bulk confirmation dialog.
  const bulkCascadedChildren = useMemo(() => {
    const selectedL2Ids = new Set(
      resources.filter((r) => r.level === 2 && selectedIds.has(r._id ?? r.id)).map((r) => (r._id ?? r.id).toString())
    );
    if (selectedL2Ids.size === 0) return [];
    return resources.filter((r) => {
      if (r.level !== 3 || selectedIds.has(r._id ?? r.id)) return false;
      const parentId = (r.parentResource?._id ?? r.parentResource?.id ?? r.parentId)?.toString();
      return parentId && selectedL2Ids.has(parentId);
    });
  }, [resources, selectedIds]);

  // ── Row actions renderer ─────────────────────────────────────────────────

  const RowActions = ({ r }) => {
    const id = r._id ?? r.id;

    // The system-managed L1 application resource can't be edited or unlinked —
    // the backend rejects both with a 409, so don't offer them here.
    if (isAppResource(r)) {
      return (
        <div className="flex items-center justify-end gap-1">
          <span className="text-[10px] text-gray-400">System</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-1">
        {/* Edit — available to hub owner and app owner */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
          title="Edit resource (changes saved globally)"
          onClick={() => { setEditingResource(r); setEditModalOpen(true); }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>

        {/* Unlink — removes ResourceApplication link */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-warning hover:text-warning hover:bg-warning-soft"
          title="Unlink from this application"
          onClick={() => handleUnlink(r)}
          disabled={unlinkingId === id}
        >
          {unlinkingId === id
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : <Unlink className="w-3.5 h-3.5" />}
        </Button>

      </div>
    );
  };

  // ── Tree node renderer ───────────────────────────────────────────────────

  const renderTreeNode = (node, depth = 0) => {
    const isExpanded = expandedIds.has(node.treeId);
    const hasChildren = node.children?.length > 0;
    const isL2 = node.level === 2;
    const id = node._id ?? node.id;
    const uid = node.resourceExternalId ?? node.externalId ?? "—";
    const active = (node.resource_status ?? node.metadata?.resource_status ?? 'active') !== 'inactive';
    const classification = node.metadata?.classification ?? null;

    return (
      <>
        <div
          className="group flex items-center py-2 px-4 hover:bg-gray-50 border-b border-gray-100 transition-colors"
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center w-6 justify-center">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(node.treeId)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-500" />
                    : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </button>
              ) : (
                <div className="w-4 h-4" />
              )}
            </div>

            <div className="flex items-center gap-2 min-w-0">
              {isL2
                ? <Folder className="w-4 h-4 text-accent-teal shrink-0" />
                : <FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="truncate text-sm text-gray-700">{node.name}</span>
              <Badge variant="outline" className="text-[10px] px-1 h-4 bg-white shrink-0">
                L{node.level}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-500 w-[480px]">
            <div className="w-[130px] truncate font-mono text-[10px]" title={uid}>{uid}</div>
            <div className="w-[140px]">
              {classification ? (
                <Badge variant="outline" className="text-[10px] px-1.5 h-5 capitalize">{classification}</Badge>
              ) : (
                <span className="text-[10px] text-gray-400">—</span>
              )}
            </div>
            <div className="w-[80px]">
              {active
                ? <Badge className="bg-success-soft text-success border-success/25 text-[10px] h-5 px-1.5">Active</Badge>
                : <Badge className="bg-destructive-soft text-destructive border-destructive/25 text-[10px] h-5 px-1.5">Inactive</Badge>}
            </div>
            <div className="flex-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <RowActions r={node} />
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="animate-in slide-in-from-top-1 duration-200">
            {node.children.map((child) => (
              <Fragment key={child.treeId}>{renderTreeNode(child, depth + 1)}</Fragment>
            ))}
          </div>
        )}
      </>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setShowLinkModal(true)}>
          <Link2 className="w-4 h-4 mr-2" />
          Link Existing Resource
        </Button>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create New Resource
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name or Universal ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue>
                  {levelFilter === "all" ? "All Levels" : `Level ${levelFilter}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="1">Level 1 (Application)</SelectItem>
                <SelectItem value="2">Level 2 (Container)</SelectItem>
                <SelectItem value="3">Level 3 (Leaf)</SelectItem>
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
                className={`flex-1 text-xs py-1.5 rounded-md transition-all ${viewMode === "table" ? "bg-white shadow-sm font-semibold" : "text-gray-500"}`}
                onClick={() => setViewMode("table")}
              >
                Table
              </button>
              <button
                className={`flex-1 text-xs py-1.5 rounded-md transition-all ${viewMode === "tree" ? "bg-white shadow-sm font-semibold" : "text-gray-500"}`}
                onClick={() => setViewMode("tree")}
              >
                Tree
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <span className="text-sm text-gray-600">
              {resources.length} resource{resources.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div className="rounded-md bg-destructive-soft border border-destructive/25 text-destructive px-4 py-3 text-sm">
          {error?.message ?? "Failed to load resources"}
        </div>
      )}
      {deleteError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-sm text-destructive">{deleteError}</p>
          <button className="text-xs underline mt-1 text-destructive" onClick={() => setDeleteError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Table / Tree */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="pl-4 pr-2 py-3 w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Universal ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Resource Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Assigned Applications</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Classification</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                      Loading resources...
                    </td>
                  </tr>
                ) : resources.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No resources linked to this application yet.
                      <br />
                      <span className="text-xs text-gray-400">
                        Use "Link Existing Resource" or "Create New Resource" above.
                      </span>
                    </td>
                  </tr>
                ) : (
                  resources.map((r) => {
                    const id = r._id ?? r.id;
                    const uid = r.resourceExternalId ?? r.externalId ?? "—";
                    const active = (r.resource_status ?? r.metadata?.resource_status ?? 'active') !== 'inactive';
                    const boundApps = (r.assignedApplications ?? [])
                      .map((a) => a?.name ?? a?.key ?? null)
                      .filter(Boolean);
                    const classification = r.metadata?.classification ?? null;
                    return (
                      <tr key={id} className={`group ${selectedIds.has(id) ? 'bg-primary/10/40' : ''}`}>
                        <td className="pl-4 pr-2 py-3 w-10">
                          {!isAppResource(r) && (
                            <Checkbox
                              checked={selectedIds.has(id)}
                              onCheckedChange={() => toggleSelectOne(id)}
                              aria-label={`Select ${r.name}`}
                              className={selectedIds.size === 0 ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-700">{uid}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          <div className="flex items-center gap-2">
                            {r.name ?? "—"}
                            {isAppResource(r) && (
                              <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-normal text-gray-400 border-gray-200">
                                System
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">L{r.level ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {boundApps.length > 0
                              ? boundApps.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)
                              : <span className="text-sm text-gray-400">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {classification
                            ? <Badge variant="outline" className="text-xs capitalize">{classification}</Badge>
                            : <span className="text-sm text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {active
                            ? <Badge className="bg-success-soft text-success border-success/25">Active</Badge>
                            : <Badge className="bg-destructive-soft text-destructive border-destructive/25">Inactive</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RowActions r={r} />
                        </td>
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
                <Button variant="destructive" size="sm" onClick={() => setBulkUnlinkOpen(true)}>
                  <Unlink className="h-4 w-4 mr-1.5" />
                  Unlink {selectedIds.size} {selectedIds.size === 1 ? 'resource' : 'resources'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Tree view */
          <div className="flex flex-col">
            <div className="flex items-center py-2.5 px-4 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div className="flex-1">Hierarchy / Name</div>
              <div className="flex items-center gap-6 w-[480px]">
                <div className="w-[130px]">Universal ID</div>
                <div className="w-[140px]">Classification</div>
                <div className="w-[80px]">Status</div>
                <div className="flex-1 text-right">Actions</div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading resources...</div>
              ) : treeData.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No resources found for this application.
                </div>
              ) : (
                treeData.map((node) => <Fragment key={node.treeId}>{renderTreeNode(node)}</Fragment>)
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk unlink confirmation */}
      <Dialog open={bulkUnlinkOpen} onOpenChange={setBulkUnlinkOpen}>
        <DialogContent className="max-w-sm min-w-0">
          <DialogHeader>
            <DialogTitle>Unlink {selectedIds.size} {selectedIds.size === 1 ? 'resource' : 'resources'}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-gray-600">
              These resources will be removed from <strong>{application?.name ?? application?.key}</strong> but will still exist globally.
            </p>
            <ul className="text-sm text-gray-700 space-y-1 max-h-40 overflow-y-auto min-w-0">
              {resources
                .filter((r) => selectedIds.has(r._id ?? r.id))
                .slice(0, 5)
                .map((r) => {
                  const id = r._id ?? r.id;
                  return (
                    <li key={id} className="flex items-start gap-2">
                      <Unlink className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                      <span className="break-words min-w-0 flex-1">{r.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">L{r.level}</Badge>
                    </li>
                  );
                })}
              {selectedIds.size > 5 && (
                <li className="text-gray-400 text-xs">…and {selectedIds.size - 5} more</li>
              )}
            </ul>
            {bulkCascadedChildren.length > 0 && (
              <div className="rounded-md bg-warning-soft border border-warning/25 p-3 min-w-0">
                <p className="text-xs font-medium text-warning mb-1.5">
                  {bulkCascadedChildren.length} sub-resource{bulkCascadedChildren.length === 1 ? '' : 's'} under the selected container{selectedIds.size === 1 ? '' : 's'} will also be unlinked:
                </p>
                <ul className="text-xs text-warning space-y-0.5 max-h-32 overflow-y-auto min-w-0">
                  {bulkCascadedChildren.slice(0, 10).map((c) => (
                    <li key={c._id ?? c.id} className="break-words">• {c.name}</li>
                  ))}
                  {bulkCascadedChildren.length > 10 && (
                    <li>…and {bulkCascadedChildren.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkUnlinkOpen(false)} disabled={isBulkUnlinking}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkUnlink} disabled={isBulkUnlinking}>
              {isBulkUnlinking ? 'Unlinking…' : 'Unlink'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single unlink confirmation — warns about cascaded L3 children when unlinking an L2 container */}
      <Dialog open={!!unlinkTarget} onOpenChange={(v) => { if (!v) setUnlinkTarget(null); }}>
        <DialogContent className="max-w-sm min-w-0">
          <DialogHeader>
            <DialogTitle className="break-words">Unlink "{unlinkTarget?.name}"?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-gray-600">
              This resource will be removed from <strong>{application?.name ?? application?.key}</strong> but will still exist globally.
            </p>
            {unlinkTargetChildren.length > 0 && (
              <div className="rounded-md bg-warning-soft border border-warning/25 p-3 min-w-0">
                <p className="text-xs font-medium text-warning mb-1.5">
                  All {unlinkTargetChildren.length} sub-resource{unlinkTargetChildren.length === 1 ? '' : 's'} under this container will also be unlinked:
                </p>
                <ul className="text-xs text-warning space-y-0.5 max-h-32 overflow-y-auto min-w-0">
                  {unlinkTargetChildren.slice(0, 10).map((c) => (
                    <li key={c._id ?? c.id} className="break-words">• {c.name}</li>
                  ))}
                  {unlinkTargetChildren.length > 10 && (
                    <li>…and {unlinkTargetChildren.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinkTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmUnlink}>Unlink</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <LinkResourceModal
        open={showLinkModal}
        onOpenChange={setShowLinkModal}
        applicationId={applicationId}
        onSuccess={() => setShowLinkModal(false)}
      />

      <AppResourceRegistrationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        application={application}
        onSuccess={() => setShowCreateModal(false)}
      />

      <EditResourceModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        resource={editingResource}
        onSuccess={() => {
          setEditingResource(null);
          queryClient.invalidateQueries({ queryKey: QK.resourcesByApp(applicationId) });
          queryClient.invalidateQueries({ queryKey: QK.resourcesAll });
        }}
      />
    </div>
  );
}
