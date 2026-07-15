import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { resourceService } from "../api/resourceService";
import { QK } from "@/lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Link2,
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
  RefreshCw,
} from "lucide-react";

/**
 * Modal that lists all global resources NOT yet linked to the current app
 * in a collapsible L2 → L3 tree view, and lets the user link one.
 */
export function LinkResourceModal({ open, onOpenChange, applicationId, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Always refetch when the modal opens so we never show a stale empty state.
  const { data: allResponse, isLoading, isFetching: isAllFetching } = useQuery({
    queryKey: QK.resourcesAll,
    queryFn: () => resourceService.getResources({ limit: 10000, page: 1 }),
    enabled: open && !!applicationId,
    staleTime: 0,
  });

  // Fetch resources already linked to this app so we can exclude them.
  const { data: linkedResponse, isFetching: isLinkedFetching } = useQuery({
    queryKey: QK.resourcesByApp(applicationId),
    queryFn: () => resourceService.getResourcesByApplication(applicationId),
    enabled: open && !!applicationId,
    staleTime: 0,
  });

  const allResources = useMemo(() => {
    const raw = allResponse?.data ?? [];
    return raw.filter((r) => r.isUnassignedNode !== true);
  }, [allResponse]);

  const linkedIds = useMemo(() => {
    const raw = linkedResponse?.data ?? [];
    return new Set(raw.map((r) => r._id ?? r.id));
  }, [linkedResponse]);

  // Build tree: L2 nodes with L3 children, filtering out already-linked items.
  // L3s whose parent was the unassigned node (not present in allResources) surface as root-level leaves.
  const treeData = useMemo(() => {
    const term = search.trim().toLowerCase();

    const l2s = allResources.filter((r) => r.level === 2);
    const l3s = allResources.filter((r) => r.level === 3);
    const l2IdSet = new Set(l2s.map((r) => (r._id ?? r.id).toString()));

    const l2Nodes = l2s
      .map((l2) => {
        const l2Id = (l2._id ?? l2.id).toString();
        const isL2Linked = linkedIds.has(l2._id ?? l2.id);

        const children = l3s
          .filter((l3) => {
            const parentId = (l3.parentResource?._id ?? l3.parentResource?.id ?? l3.parentId)?.toString();
            return parentId === l2Id;
          })
          .filter((l3) => {
            if (linkedIds.has(l3._id ?? l3.id)) return false;
            if (!term) return true;
            const uid = l3.resourceExternalId ?? l3.externalId ?? "";
            return l3.name?.toLowerCase().includes(term) || uid.toLowerCase().includes(term);
          });

        const l2MatchesSearch = !term || (l2.name?.toLowerCase().includes(term) || (l2.resourceExternalId ?? l2.externalId ?? "").toLowerCase().includes(term));
        const showL2 = (!isL2Linked && l2MatchesSearch) || children.length > 0;

        if (!showL2) return null;
        return { ...l2, treeId: `l2-${l2Id}`, isLinked: isL2Linked, children };
      })
      .filter(Boolean);

    // L3s whose parent was the unassigned node — no matching L2 in the list.
    const orphanedL3s = l3s
      .filter((l3) => {
        if (linkedIds.has(l3._id ?? l3.id)) return false;
        const parentId = (l3.parentResource?._id ?? l3.parentResource?.id ?? l3.parentId)?.toString();
        if (parentId && l2IdSet.has(parentId)) return false;
        if (!term) return true;
        const uid = l3.resourceExternalId ?? l3.externalId ?? "";
        return l3.name?.toLowerCase().includes(term) || uid.toLowerCase().includes(term);
      })
      .map((l3) => ({ ...l3, treeId: `l3-${l3._id ?? l3.id}`, isLinked: false, children: [] }));

    return [...l2Nodes, ...orphanedL3s].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [allResources, linkedIds, search]);

  const totalUnlinked = useMemo(() => {
    return allResources.filter((r) => !linkedIds.has(r._id ?? r.id)).length;
  }, [allResources, linkedIds]);

  const toggleExpand = (treeId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(treeId) ? next.delete(treeId) : next.add(treeId);
      return next;
    });
  };

  const linkMutation = useMutation({
    mutationFn: async ({ resource }) => {
      // Linking an L2 container cascades to its L3 children on the backend.
      // Linking an L3 resource does NOT touch its L2 parent — only L2→L3 cascades, never L3→L2.
      return resourceService.addApplicationToResource(resource._id ?? resource.id, applicationId);
    },
    onSuccess: (result, { resource }) => {
      const linkedChildrenCount = result?.linkedChildrenCount ?? 0;
      toast({
        title: "Linked",
        description: linkedChildrenCount > 0
          ? `"${resource.name}" and ${linkedChildrenCount} sub-resource${linkedChildrenCount === 1 ? '' : 's'} linked to this application`
          : `"${resource.name}" linked to this application`,
      });
      queryClient.invalidateQueries({ queryKey: QK.resourcesByApp(applicationId) });
      queryClient.invalidateQueries({ queryKey: QK.resourcesAll });
      queryClient.invalidateQueries({ queryKey: ['resources', 'list'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast({ title: "Error", description: err?.message ?? "Failed to link resource", variant: "destructive" });
    },
    onSettled: () => setLinkingId(null),
  });

  const handleLink = (r) => {
    const id = r._id ?? r.id;
    setLinkingId(id);
    linkMutation.mutate({ resource: r });
  };

  const handleClose = () => {
    setSearch("");
    setLinkingId(null);
    setExpandedIds(new Set());
    onOpenChange(false);
  };

  // ── Tree node ────────────────────────────────────────────────────────────

  const TreeRow = ({ node, depth = 0 }) => {
    const id = node._id ?? node.id;
    const uid = node.resourceExternalId ?? node.externalId ?? "—";
    const isExpanded = expandedIds.has(node.treeId);
    const hasChildren = node.children?.length > 0;
    const isLinking = linkingId === id;
    const isL2 = node.level === 2;

    return (
      <>
        <div
          className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
        >
          {/* Expand/collapse toggle for L2 nodes with children */}
          <div className="w-5 flex items-center justify-center shrink-0">
            {isL2 && hasChildren ? (
              <button
                onClick={() => toggleExpand(node.treeId)}
                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              >
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
              </button>
            ) : (
              <div className="w-3.5" />
            )}
          </div>

          {/* Icon */}
          {isL2
            ? <Folder className="w-4 h-4 text-accent-teal shrink-0" />
            : <FileText className="w-4 h-4 text-muted-foreground shrink-0" />}

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-gray-900 truncate">{node.name}</span>
              <Badge variant="outline" className="text-[10px] px-1 h-4 shrink-0">L{node.level}</Badge>
              {(node.resource_status ?? node.metadata?.resource_status) === 'inactive' && (
                <Badge className="bg-destructive-soft text-destructive text-[10px] px-1 h-4 shrink-0">Inactive</Badge>
              )}
            </div>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">{uid}</p>
          </div>

          {/* Link button — only for unlinked nodes */}
          {!node.isLinked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleLink(node)}
              disabled={isLinking}
              className="shrink-0 h-7 text-xs"
            >
              {isLinking
                ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                : <Link2 className="w-3 h-3 mr-1" />}
              {isLinking ? "Linking…" : "Link"}
            </Button>
          )}

          {/* Already linked indicator for L2 shown as parent context */}
          {node.isLinked && (
            <span className="text-[11px] text-gray-400 shrink-0 italic">already linked</span>
          )}
        </div>

        {/* L3 children — shown when expanded */}
        {isL2 && isExpanded && hasChildren && (
          <div>
            {node.children.map((child) => (
              <TreeRow
                key={child._id ?? child.id}
                node={{ ...child, treeId: `${node.treeId}-l3-${child._id ?? child.id}`, isLinked: false }}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Existing Resource</DialogTitle>
          <DialogDescription>
            Browse the resource tree and link resources to this application.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by name or Universal ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
          {isLoading || isAllFetching || isLinkedFetching ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading resources...</div>
          ) : treeData.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              {totalUnlinked === 0
                ? "All global resources are already linked to this application."
                : "No resources match your search."}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {treeData.map((node) => (
                <TreeRow key={node.treeId} node={node} />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
