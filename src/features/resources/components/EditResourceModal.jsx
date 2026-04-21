import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth";
import { resourceService } from "../api/resourceService";
import { applicationService } from "@/features/applications";
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
import { Plus, X } from "lucide-react";
import { ApplicationMultiSelect } from "./ApplicationMultiSelect";

const MAX_DESCRIPTION = 500;

export function EditResourceModal({ open, onOpenChange, resource, onSuccess }) {
  const { effectiveRoles } = useAuth();
  const isHubOwner = effectiveRoles?.isHubOwner;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedApps, setAssignedApps] = useState([]);
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState("");
  const [attrValues, setAttrValues] = useState({});
  // App-specific overrides: [{ appId, attributeDefId, value }]
  const [overrides, setOverrides] = useState([]);

  const { data: applicationsResponse } = useQuery({
    queryKey: ["applications-edit-modal"],
    queryFn: () => applicationService.getApplications(),
    enabled: open,
  });

  const { data: attrDefsResponse } = useQuery({
    queryKey: ["resource-attribute-definitions"],
    queryFn: () => resourceService.listAttributeDefinitions(),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const attrDefs = attrDefsResponse?.data ?? [];

  const resourceId = resource?._id ?? resource?.id;
  const { data: existingAttrsResponse } = useQuery({
    queryKey: ["resource-attributes", resourceId],
    queryFn: () => resourceService.getResourceAttributes(resourceId),
    enabled: open && !!resourceId,
  });

  const applications = applicationsResponse?.data ?? applicationsResponse ?? [];

  useEffect(() => {
    if (open && resource) {
      setName(resource.name ?? "");
      const meta = resource.metadata;
      const desc =
        meta instanceof Map
          ? meta.get("description") ?? ""
          : meta?.description ?? "";
      setDescription(desc);
      setAssignedApps(resource.assignedApplications ?? []);
      setIsActive(resource.isActive !== false);
      setNameError("");
    }
  }, [open, resource]);

  useEffect(() => {
    const rows = existingAttrsResponse?.data ?? [];
    const common = {};
    const appOverrides = [];
    for (const row of rows) {
      if (!row.applicationId) {
        common[row.attributeDefId] = row.value;
      } else {
        appOverrides.push({
          appId: row.applicationId,
          attributeDefId: row.attributeDefId,
          value: row.value,
        });
      }
    }
    setAttrValues(common);
    setOverrides(appOverrides);
  }, [existingAttrsResponse]);

  const addOverride = () => {
    const firstAppId = assignedApps[0]?._id ?? assignedApps[0]?.id ?? "";
    const firstDefId = attrDefs[0]?.id ?? "";
    setOverrides((prev) => [...prev, { appId: firstAppId, attributeDefId: firstDefId, value: "" }]);
  };

  const updateOverride = (index, patch) =>
    setOverrides((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  const removeOverride = (index) =>
    setOverrides((prev) => prev.filter((_, i) => i !== index));

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      await resourceService.updateResource(resourceId, {
        name: name.trim(),
        description,
        assignedApplications: assignedApps.map((a) => a._id ?? a.id ?? a),
        isActive,
      });
      const commonEntries = attrDefs
        .filter((def) => attrValues[def.id] !== undefined && attrValues[def.id] !== "")
        .map((def) => ({ attributeDefId: def.id, value: attrValues[def.id] }));
      const overrideEntries = overrides
        .filter((o) => o.attributeDefId && o.value !== "" && o.value !== undefined)
        .map((o) => ({ attributeDefId: o.attributeDefId, value: o.value, applicationId: o.appId }));
      const allEntries = [...commonEntries, ...overrideEntries];
      if (allEntries.length > 0) {
        await resourceService.upsertResourceAttributes(resourceId, allEntries);
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Resource updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["all-resources-modal"] });
      queryClient.invalidateQueries({ queryKey: ["resource-attributes", resourceId] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      if (
        error?.status === 409 ||
        error?.message?.includes("already exists")
      ) {
        setNameError(
          "This name is already used by another resource. Choose a different name."
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Resource</DialogTitle>
          <DialogDescription>
            Update resource details. Name must be globally unique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div>
            <Label htmlFor="edit-desc" className="text-sm font-medium mb-1 block">
              Description
            </Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= MAX_DESCRIPTION) setDescription(e.target.value);
              }}
              placeholder="Describe this resource (optional)..."
              rows={3}
              disabled={isPending}
            />
            <p className={`text-xs mt-1 text-right ${description.length >= MAX_DESCRIPTION ? "text-destructive" : "text-muted-foreground"}`}>
              {description.length}/{MAX_DESCRIPTION}
            </p>
          </div>

          {isHubOwner ? (
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Assigned Applications
              </Label>
              <ApplicationMultiSelect
                applications={applications}
                selectedApps={assignedApps}
                onSelectionChange={setAssignedApps}
                placeholder="Select applications..."
                disabled={isPending}
              />
            </div>
          ) : (
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Assigned Applications
              </Label>
              <div className="flex flex-wrap gap-1 border rounded-md px-3 py-2 bg-muted/50">
                {assignedApps.length > 0 ? (
                  assignedApps.map((app) => (
                    <Badge key={app._id ?? app.id ?? app} variant="secondary" className="text-xs">
                      {app.name ?? app.appCode ?? "—"}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No applications</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch
              id="edit-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isPending}
            />
            <Label htmlFor="edit-active" className="text-sm font-medium">
              Active
            </Label>
            {!isActive && (
              <span className="text-xs text-amber-600">
                Deactivating hides this resource from assignments
              </span>
            )}
          </div>
        </div>

          {attrDefs.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Attributes
              </h3>

              {/* Common attributes (applicationId = null) */}
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
                      {def.isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {def.dataType === "boolean" ? (
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={attrValues[def.id] === undefined ? "" : String(attrValues[def.id])}
                        onChange={(e) =>
                          setAttrValues((p) => ({ ...p, [def.id]: e.target.value === "" ? "" : e.target.value === "true" }))
                        }
                        disabled={isPending}
                      >
                        <option value="">— not set —</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : def.dataType === "enum" && def.constraints?.allowedValues?.length > 0 ? (
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={attrValues[def.id] ?? ""}
                        onChange={(e) =>
                          setAttrValues((p) => ({ ...p, [def.id]: e.target.value }))
                        }
                        disabled={isPending}
                      >
                        <option value="">— not set —</option>
                        {def.constraints.allowedValues.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={def.dataType === "number" ? "number" : "text"}
                        placeholder={def.dataType === "datetime" ? "e.g. 2025-01-01T00:00:00Z" : `Enter ${def.displayName.toLowerCase()}`}
                        value={attrValues[def.id] ?? ""}
                        onChange={(e) =>
                          setAttrValues((p) => ({
                            ...p,
                            [def.id]: def.dataType === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value,
                          }))
                        }
                        disabled={isPending}
                      />
                    )}
                    {def.description && (
                      <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* App-specific overrides — shown when resource has multiple applications */}
              {assignedApps.length > 1 && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs font-medium text-gray-600">
                      Application-Specific Overrides
                      <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Override a common attribute value for a specific application.
                    </p>
                  </div>

                  {overrides.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No overrides configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {overrides.map((override, i) => {
                        const def = attrDefs.find((d) => d.id === override.attributeDefId);
                        return (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-md border border-gray-100 bg-gray-50">
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Application</p>
                                <select
                                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                  value={override.appId}
                                  onChange={(e) => updateOverride(i, { appId: e.target.value })}
                                  disabled={isPending}
                                >
                                  {assignedApps.map((app) => {
                                    const id = app._id ?? app.id;
                                    return (
                                      <option key={id} value={id}>
                                        {app.name ?? app.appCode}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Attribute</p>
                                <select
                                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                  value={override.attributeDefId}
                                  onChange={(e) => updateOverride(i, { attributeDefId: e.target.value, value: "" })}
                                  disabled={isPending}
                                >
                                  {attrDefs.map((d) => (
                                    <option key={d.id} value={d.id}>{d.displayName}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Value</p>
                                {def?.dataType === "boolean" ? (
                                  <select
                                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                    value={override.value === undefined ? "" : String(override.value)}
                                    onChange={(e) => updateOverride(i, { value: e.target.value === "" ? "" : e.target.value === "true" })}
                                    disabled={isPending}
                                  >
                                    <option value="">— not set —</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                  </select>
                                ) : def?.dataType === "enum" && def?.constraints?.allowedValues?.length > 0 ? (
                                  <select
                                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                    value={override.value ?? ""}
                                    onChange={(e) => updateOverride(i, { value: e.target.value })}
                                    disabled={isPending}
                                  >
                                    <option value="">— not set —</option>
                                    {def.constraints.allowedValues.map((v) => (
                                      <option key={v} value={v}>{v}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <Input
                                    className="h-8 text-xs"
                                    type={def?.dataType === "number" ? "number" : "text"}
                                    value={override.value ?? ""}
                                    onChange={(e) =>
                                      updateOverride(i, {
                                        value: def?.dataType === "number"
                                          ? (e.target.value === "" ? "" : Number(e.target.value))
                                          : e.target.value,
                                      })
                                    }
                                    placeholder="Override value..."
                                    disabled={isPending}
                                  />
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeOverride(i)}
                              disabled={isPending}
                              className="mt-5 text-gray-400 hover:text-red-500 shrink-0 disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOverride}
                    disabled={isPending}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Override
                  </Button>
                </div>
              )}
            </div>
          )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => save()}
            disabled={isPending || !name.trim()}
          >
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
