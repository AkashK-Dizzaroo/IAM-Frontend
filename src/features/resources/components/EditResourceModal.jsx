import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { resourceService } from "../api/resourceService";
import { appAttributeService } from "@/features/app-attributes/api/appAttributeService";
import { applicationService } from "@/features/applications";
import { QK } from "@/lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Unlink, X } from "lucide-react";
import { AttributeGroupEditor } from "@/components/attributes/AttributeGroupEditor";

const MAX_DESCRIPTION = 500;
const RESERVED_ATTR_KEYS = new Set(['isactive', 'is_active', 'status', 'resource_status']);

export function EditResourceModal({ open, onOpenChange, resource, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState("");
  const [attrValues, setAttrValues] = useState({});       // { [hubDefId]: value }
  const [appAttrValues, setAppAttrValues] = useState({}); // { [appId]: { [appDefId]: value } }
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [appsToAdd, setAppsToAdd] = useState([]);           // app objects staged to link on save
  const [appsToRemove, setAppsToRemove] = useState(new Set()); // app IDs staged to unlink on save
  const [removeAppTarget, setRemoveAppTarget] = useState(null); // app object pending unlink confirmation

  const originalRef = useRef({
    name: "", description: "", isActive: true, attrValues: {}, appAttrValues: {},
  });

  const resourceId = resource?._id ?? resource?.id;
  const linkedApps = resource?.assignedApplications ?? [];

  // Hub resource attribute definitions
  const { data: attrDefsResponse } = useQuery({
    queryKey: QK.resourceAttrDefs,
    queryFn: () => resourceService.listAttributeDefinitions(),
    enabled: open,
    staleTime: 10 * 60_000,
  });
  const allAttrDefs = attrDefsResponse?.data ?? [];
  const attrDefs = allAttrDefs.filter(
    (d) => !RESERVED_ATTR_KEYS.has(d.key?.toLowerCase?.() ?? ""),
  );

  // All applications (for the link-app selector)
  const { data: allAppsResponse } = useQuery({
    queryKey: QK.applicationsModal,
    queryFn: async () => {
      const response = await applicationService.getApplications();
      return response?.data ?? response ?? [];
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const allApplications = Array.isArray(allAppsResponse) ? allAppsResponse : [];

  // App resource attribute definitions — one query per linked app
  const appAttrDefQueries = useQueries({
    queries: linkedApps.map((app) => {
      const appKey = app.key;
      return {
        queryKey: [...QK.appAttributes(appKey), 'resourceDefs'],
        queryFn: () =>
          appAttributeService.list(appKey).then((r) => ({
            appId: String(app._id ?? app.id),
            defs: (r?.data?.data ?? r?.data ?? []).filter((d) => d.namespace === "resource"),
          })),
        enabled: open && !!appKey,
        staleTime: 5 * 60_000,
      };
    }),
  });

  // Build { [appId]: [def, ...] } from query results
  const appAttrDefs = useMemo(() => {
    const map = {};
    for (const q of appAttrDefQueries) {
      if (q.data) map[q.data.appId] = q.data.defs;
    }
    return map;
  }, [appAttrDefQueries]);

  // Apps available to add: exclude already-linked and staged-to-add
  const linkedAppIdSet = useMemo(() => new Set([
    ...linkedApps.map((a) => String(a._id ?? a.id)),
    ...appsToAdd.map((a) => String(a._id ?? a.id)),
  ]), [linkedApps, appsToAdd]);
  const availableApps = useMemo(
    () => allApplications.filter((a) => !linkedAppIdSet.has(String(a._id ?? a.id))),
    [allApplications, linkedAppIdSet],
  );

  // L3 children of this resource (only relevant for level-2 resources) currently
  // linked to the app pending unlink confirmation — these get cascade-unlinked
  // along with the parent by the backend, so we warn about them up front.
  const removeAppTargetId = removeAppTarget ? String(removeAppTarget._id ?? removeAppTarget.id) : null;
  const { data: removeAppChildrenResponse } = useQuery({
    queryKey: ['resource-children-for-app', resourceId, removeAppTargetId],
    queryFn: () => resourceService.getResources({ applicationId: removeAppTargetId, level: 3, limit: 2000 }),
    enabled: open && resource?.level === 2 && !!removeAppTargetId,
  });
  const removeAppChildren = useMemo(() => {
    if (!removeAppTargetId) return [];
    return (removeAppChildrenResponse?.data ?? []).filter((c) => {
      const parentId = (c.parentResource?._id ?? c.parentResource?.id ?? c.parentId)?.toString();
      return parentId === String(resourceId);
    });
  }, [removeAppChildrenResponse, removeAppTargetId, resourceId]);

  // Existing attribute values for this resource
  const { data: existingAttrsResponse } = useQuery({
    queryKey: QK.resourceAttrs(resourceId),
    queryFn: () => resourceService.getResourceAttributes(resourceId),
    enabled: open && !!resourceId,
    staleTime: 30_000,
  });

  // Initialize basic fields from resource prop
  useEffect(() => {
    if (open && resource) {
      const nameVal = resource.name ?? "";
      const meta = resource.metadata;
      const descVal =
        meta instanceof Map ? meta.get("description") ?? "" : meta?.description ?? "";
      const activeVal = (resource.resource_status ?? resource.metadata?.resource_status ?? 'active') !== 'inactive';
      setName(nameVal);
      setDescription(descVal);
      setIsActive(activeVal);
      setNameError("");
      setAppsToAdd([]);
      setAppsToRemove(new Set());
      originalRef.current = {
        ...originalRef.current,
        name: nameVal,
        description: descVal,
        isActive: activeVal,
      };
    }
  }, [open, resource]);

  // Initialize attribute values from server response
  useEffect(() => {
    if (!open || !resource) return;
    const rows = existingAttrsResponse?.data ?? [];
    const common = {};
    const appValues = {};

    for (const row of rows) {
      if (!row.applicationId) {
        common[row.attributeDefId] = row.value;
      } else {
        const appId = String(row.applicationId);
        if (!appValues[appId]) appValues[appId] = {};
        appValues[appId][row.attributeDefId] = row.value;
      }
    }

    setAttrValues(common);
    setAppAttrValues(appValues);
    originalRef.current = {
      ...originalRef.current,
      attrValues: common,
      appAttrValues: appValues,
    };
  }, [open, existingAttrsResponse, resource]);

  const isDirty =
    name !== originalRef.current.name ||
    description !== originalRef.current.description ||
    isActive !== originalRef.current.isActive ||
    JSON.stringify(attrValues) !== JSON.stringify(originalRef.current.attrValues) ||
    JSON.stringify(appAttrValues) !== JSON.stringify(originalRef.current.appAttrValues) ||
    appsToAdd.length > 0 ||
    appsToRemove.size > 0;

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const hasBaseChanges =
        name.trim() !== originalRef.current.name ||
        description !== originalRef.current.description ||
        isActive !== originalRef.current.isActive ||
        JSON.stringify(attrValues) !== JSON.stringify(originalRef.current.attrValues) ||
        JSON.stringify(appAttrValues) !== JSON.stringify(originalRef.current.appAttrValues);

      if (hasBaseChanges) {
        const statusEntry = { attributeKey: 'resource_status', value: isActive ? 'active' : 'inactive' };

        const hubEntries = attrDefs.map((def) => ({
          attributeDefId: def.id,
          value: attrValues[def.id] !== undefined && attrValues[def.id] !== "" ? attrValues[def.id] : null,
        }));

        const appEntries = [];
        for (const app of linkedApps) {
          const appId = String(app._id ?? app.id);
          const defs = appAttrDefs[appId] ?? [];
          for (const def of defs) {
            const val = appAttrValues[appId]?.[def.id];
            appEntries.push({
              attributeDefId: def.id,
              value: val !== undefined && val !== "" ? val : null,
              applicationId: appId,
            });
          }
        }

        await resourceService.updateResource(resourceId, {
          name: name.trim(),
          description,
          attributeEntries: [statusEntry, ...hubEntries, ...appEntries],
        });
      }

      // Link new apps
      for (const app of appsToAdd) {
        await resourceService.addApplicationToResource(resourceId, String(app._id ?? app.id));
      }
      // Unlink removed apps
      for (const appId of appsToRemove) {
        await resourceService.unlinkResourceFromApp(resourceId, appId);
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Resource updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["resources", "list"] });
      queryClient.invalidateQueries({ queryKey: QK.resourcesAll });
      queryClient.invalidateQueries({ queryKey: QK.resourceAttrs(resourceId) });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      if (error?.status === 409 || error?.message?.includes("already exists")) {
        setNameError(
          "This name is already used by another resource. Choose a different name.",
        );
      } else {
        toast({
          title: "Error",
          description: error?.message ?? "Failed to update resource",
          variant: "destructive",
        });
      }
    },
  });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && !showDiscardDialog) handleCancel();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
            <DialogDescription>
              Update resource details. Name must be globally unique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <Label htmlFor="edit-name" className="text-sm font-medium mb-1 block">
                Resource Name *
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError("");
                }}
                placeholder="Enter resource name"
                disabled={isPending}
              />
              {nameError && (
                <p className="text-sm text-destructive mt-1">{nameError}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="edit-desc" className="text-sm font-medium mb-1 block">
                Description
              </Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_DESCRIPTION)
                    setDescription(e.target.value);
                }}
                placeholder="Describe this resource (optional)..."
                rows={3}
                disabled={isPending}
              />
              <p
                className={`text-xs mt-1 text-right ${
                  description.length >= MAX_DESCRIPTION
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {description.length}/{MAX_DESCRIPTION}
              </p>
            </div>

            {/* Resource Status */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div>
                <Label className="text-sm font-medium">Resource Status</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inactive resources are hidden from all applications.
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isPending}
              />
            </div>

            {/* Linked Applications */}
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide block mb-0.5">
                  Linked Applications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Applications that can access this resource. Changes take effect on save.
                </p>
              </div>

              {/* Current linked apps (minus staged removals) + staged additions */}
              <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {linkedApps.filter((app) => !appsToRemove.has(String(app._id ?? app.id))).length === 0 &&
                  appsToAdd.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No applications linked yet.</p>
                  )}
                {linkedApps
                  .filter((app) => !appsToRemove.has(String(app._id ?? app.id)))
                  .map((app) => {
                    const appId = String(app._id ?? app.id);
                    return (
                      <Badge
                        key={appId}
                        variant="secondary"
                        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 text-xs font-medium"
                      >
                        {app.name ?? app.key}
                        <button
                          type="button"
                          onClick={() => {
                            if (resource?.level === 2) {
                              setRemoveAppTarget(app);
                            } else {
                              setAppsToRemove((prev) => {
                                const next = new Set(prev);
                                next.add(appId);
                                return next;
                              });
                            }
                          }}
                          disabled={isPending}
                          className="rounded-sm p-0.5 text-muted-foreground hover:text-warning hover:bg-warning-soft transition-colors disabled:opacity-50"
                          aria-label={`Unlink ${app.name ?? app.key}`}
                          title="Unlink from this resource"
                        >
                          <Unlink className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                {appsToAdd.map((app) => {
                  const appId = String(app._id ?? app.id);
                  return (
                    <Badge
                      key={appId}
                      variant="outline"
                      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 text-xs font-medium bg-success-soft text-success border-success/25"
                    >
                      {app.name ?? app.key}
                      <span className="text-[10px] font-normal text-success">new</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAppsToAdd((prev) =>
                            prev.filter((a) => String(a._id ?? a.id) !== appId),
                          )
                        }
                        disabled={isPending}
                        className="rounded-sm p-0.5 text-success hover:text-destructive hover:bg-destructive-soft transition-colors disabled:opacity-50"
                        aria-label={`Remove ${app.name ?? app.key}`}
                        title="Undo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>

              {/* Add app selector */}
              {availableApps.length > 0 && (
                <Select
                  value=""
                  onValueChange={(val) => {
                    const selected = allApplications.find((a) => String(a._id ?? a.id) === val);
                    if (selected) setAppsToAdd((prev) => [...prev, selected]);
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Link2 className="h-3.5 w-3.5" /> Link an application…
                      </span>
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableApps.map((app) => (
                      <SelectItem key={String(app._id ?? app.id)} value={String(app._id ?? app.id)}>
                        {app.name ?? app.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Attributes: common (hub resource defs) + per-app (AppAttributeDefinition namespace=resource) */}
            {(attrDefs.length > 0 ||
              linkedApps.some((app) => (appAttrDefs[String(app._id ?? app.id)] ?? []).length > 0)) && (
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Attributes
                </h3>

                {attrDefs.length > 0 && (
                  <AttributeGroupEditor
                    defs={attrDefs}
                    values={attrValues}
                    originalValues={originalRef.current.attrValues}
                    onChange={(defId, val) => setAttrValues((p) => ({ ...p, [defId]: val }))}
                    disabled={isPending}
                    title="Common Attributes"
                    description="These values apply across all assigned applications."
                  />
                )}

                {linkedApps.map((app) => {
                  const appId = String(app._id ?? app.id);
                  const defs = appAttrDefs[appId] ?? [];
                  if (defs.length === 0) return null;
                  return (
                    <div key={appId} className="pt-3 border-t border-gray-100">
                      <AttributeGroupEditor
                        defs={defs}
                        values={appAttrValues[appId] ?? {}}
                        originalValues={originalRef.current.appAttrValues[appId] ?? {}}
                        onChange={(defId, val) =>
                          setAppAttrValues((p) => ({
                            ...p,
                            [appId]: { ...(p[appId] ?? {}), [defId]: val },
                          }))
                        }
                        disabled={isPending}
                        title={`${app.name ?? app.key} Resource Attributes`}
                        description={`Attributes specific to ${app.name ?? app.key}.`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={() => save()} disabled={isPending || !name.trim()}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink-application confirmation — warns about cascaded L3 children (level-2 resources only) */}
      <Dialog open={!!removeAppTarget} onOpenChange={(v) => { if (!v) setRemoveAppTarget(null); }}>
        <DialogContent className="max-w-sm min-w-0">
          <DialogHeader>
            <DialogTitle className="break-words">Unlink "{removeAppTarget?.name ?? removeAppTarget?.key}"?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-gray-600">
              This application will be removed from <strong>{resource?.name}</strong> on save.
            </p>
            {removeAppChildren.length > 0 && (
              <div className="rounded-md bg-warning-soft border border-warning/25 p-3 min-w-0">
                <p className="text-xs font-medium text-warning mb-1.5">
                  All {removeAppChildren.length} sub-resource{removeAppChildren.length === 1 ? '' : 's'} under this container will also be unlinked:
                </p>
                <ul className="text-xs text-warning space-y-0.5 max-h-32 overflow-y-auto min-w-0">
                  {removeAppChildren.slice(0, 10).map((c) => (
                    <li key={c._id ?? c.id} className="break-words">• {c.name}</li>
                  ))}
                  {removeAppChildren.length > 10 && (
                    <li>…and {removeAppChildren.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveAppTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setAppsToRemove((prev) => {
                  const next = new Set(prev);
                  next.add(removeAppTargetId);
                  return next;
                });
                setRemoveAppTarget(null);
              }}
            >
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. They will be lost if you close without saving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDiscardDialog(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDiscardDialog(false);
                onOpenChange(false);
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
