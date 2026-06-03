import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { resourceService } from "../api/resourceService";
import { abacService } from "@/features/abac/api/abacService";
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

  // App resource attribute definitions — one query per linked app
  const appAttrDefQueries = useQueries({
    queries: linkedApps.map((app) => {
      const appKey = app.key;
      return {
        queryKey: [...QK.appAttributes(appKey), 'resourceDefs'],
        queryFn: () =>
          abacService.listAppAttrDefs(appKey).then((r) => ({
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
      const activeVal = resource.isActive !== false;
      setName(nameVal);
      setDescription(descVal);
      setIsActive(activeVal);
      setNameError("");
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
    JSON.stringify(appAttrValues) !== JSON.stringify(originalRef.current.appAttrValues);

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      await resourceService.updateResource(resourceId, {
        name: name.trim(),
        description,
        isActive,
      });

      // Hub entries — always send all defs; null = delete from DB
      const hubEntries = attrDefs.map((def) => ({
        attributeDefId: def.id,
        value:
          attrValues[def.id] !== undefined && attrValues[def.id] !== ""
            ? attrValues[def.id]
            : null,
      }));

      // App entries — all defs for each app; null = delete from DB
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

      const allEntries = [...hubEntries, ...appEntries];
      if (allEntries.length > 0) {
        await resourceService.upsertResourceAttributes(resourceId, allEntries);
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

  const renderAttrInput = (def, value, onChange, sizeClass = "") => {
    if (def.dataType === "boolean") {
      return (
        <select
          className={`w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ${sizeClass}`}
          value={value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : e.target.value === "true")
          }
          disabled={isPending}
        >
          <option value="">— not set —</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    if (def.dataType === "enum" && def.constraints?.allowedValues?.length > 0) {
      return (
        <select
          className={`w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ${sizeClass}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          disabled={isPending}
        >
          <option value="">— not set —</option>
          {def.constraints.allowedValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      );
    }
    return (
      <Input
        className={sizeClass}
        type={def.dataType === "number" ? "number" : "text"}
        placeholder={
          def.dataType === "datetime"
            ? "e.g. 2025-01-01T00:00:00Z"
            : `Enter ${def.displayName.toLowerCase()}`
        }
        value={value ?? ""}
        onChange={(e) =>
          onChange(
            def.dataType === "number"
              ? e.target.value === ""
                ? undefined
                : Number(e.target.value)
              : e.target.value || undefined,
          )
        }
        disabled={isPending}
      />
    );
  };

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

            {/* Common Attributes (hub resource defs) */}
            {attrDefs.length > 0 && (
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Attributes
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Common Attributes</p>
                    <p className="text-xs text-muted-foreground">
                      These values apply across all assigned applications.
                    </p>
                  </div>
                  {attrDefs.map((def) => (
                    <div key={def.id}>
                      <Label className="text-sm font-medium mb-1 block">
                        {def.displayName}
                        {def.isRequired && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      {renderAttrInput(def, attrValues[def.id], (val) =>
                        setAttrValues((p) => ({ ...p, [def.id]: val })),
                      )}
                      {def.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {def.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* App-specific Attributes (per linked app, AppAttributeDefinition namespace=resource) */}
            {linkedApps.some(
              (app) => (appAttrDefs[String(app._id ?? app.id)] ?? []).length > 0,
            ) && (
              <div className="space-y-4 pt-2">
                {attrDefs.length === 0 && (
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Attributes
                  </h3>
                )}
                {linkedApps.map((app) => {
                  const appId = String(app._id ?? app.id);
                  const defs = appAttrDefs[appId] ?? [];
                  if (defs.length === 0) return null;
                  return (
                    <div key={appId} className="space-y-3 pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          {app.name ?? app.key} Attributes
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Attributes specific to {app.name ?? app.key}.
                        </p>
                      </div>
                      {defs.map((def) => {
                        const val = appAttrValues[appId]?.[def.id];
                        return (
                          <div key={def.id}>
                            <Label className="text-sm font-medium mb-1 block">
                              {def.displayName}
                              {def.isRequired && (
                                <span className="text-destructive ml-1">*</span>
                              )}
                            </Label>
                            {renderAttrInput(def, val, (newVal) =>
                              setAppAttrValues((p) => ({
                                ...p,
                                [appId]: { ...(p[appId] ?? {}), [def.id]: newVal },
                              })),
                            )}
                            {def.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {def.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
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
