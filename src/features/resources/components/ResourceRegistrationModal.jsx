import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth";
import { resourceService } from "../api/resourceService";
import { applicationService } from "@/features/applications";
import { useResourceForm } from "../hooks/useResourceForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Plus, X } from "lucide-react";
import { ApplicationMultiSelect } from "./ApplicationMultiSelect";
import { L2ContainerSelect } from "./L2ContainerSelect";

const MAX_DESCRIPTION = 500;

function AppOwnerApplicationSelect({ ownedAppIds, allApplications, value, onChange }) {
  const ownedApps = useMemo(
    () =>
      allApplications.filter((app) =>
        ownedAppIds.includes((app._id ?? app.id)?.toString())
      ),
    [allApplications, ownedAppIds]
  );

  useEffect(() => {
    if (ownedApps.length === 1 && !value) {
      onChange(ownedApps[0]);
    }
  }, [ownedApps.length, value, onChange]);

  if (ownedApps.length <= 1) {
    const app = ownedApps[0];
    return (
      <div className="flex items-center h-9 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm">
        {app?.name ?? "No application available"}
        {app && (
          <span className="text-xs text-muted-foreground ml-2">(auto-selected)</span>
        )}
      </div>
    );
  }

  return (
    <select
      value={(value?._id ?? value?.id) ?? ""}
      onChange={(e) => {
        const selected = ownedApps.find(
          (a) => (a._id ?? a.id)?.toString() === e.target.value
        );
        onChange(selected ?? null);
      }}
      className="w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">Select your application...</option>
      {ownedApps.map((app) => (
        <option key={app._id ?? app.id} value={(app._id ?? app.id)?.toString()}>
          {app.name} ({app.appCode})
        </option>
      ))}
    </select>
  );
}

export function ResourceRegistrationModal({
  open,
  onOpenChange,
  onClose,
  onSuccess,
}) {
  const { effectiveRoles } = useAuth();
  const isHubOwner = effectiveRoles?.isHubOwner;
  const isAppOwner = effectiveRoles?.isAppOwner && !isHubOwner;
  const ownedAppIds = effectiveRoles?.appOwnerOf ?? [];

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nameError, setNameError] = useState("");
  const [nameAvailable, setNameAvailable] = useState(null); // null=unchecked, true=available, false=taken
  const [attributeRows, setAttributeRows] = useState([]);
  // App-specific overrides: [{ appId, attributeDefId, value }]
  const [overrides, setOverrides] = useState([]);

  const {
    creationLevel,
    setCreationLevel,
    selectedL1Apps,
    setSelectedL1Apps,
    selectedL2,
    setSelectedL2,
    resourceName,
    setResourceName,
    description,
    setDescription,
    isL2Locked,
    isValid,
    reset,
    buildPayload,
  } = useResourceForm();

  const { data: applicationsResponse } = useQuery({
    queryKey: ["applications-modal"],
    queryFn: () => applicationService.getApplications(),
    enabled: open,
  });

  const applications = applicationsResponse?.data ?? applicationsResponse ?? [];

  const { data: attrDefsResponse } = useQuery({
    queryKey: ["resource-attribute-definitions"],
    queryFn: () => resourceService.listAttributeDefinitions(),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const attrDefs = attrDefsResponse?.data ?? [];

  const { data: allResourcesResponse } = useQuery({
    queryKey: ["all-resources-modal"],
    queryFn: async () => {
      const res = await resourceService.getResources({
        limit: 10000,
        page: 1,
      });
      return res?.data ?? [];
    },
    enabled: open,
  });

  const allResources = allResourcesResponse?.data ?? allResourcesResponse ?? [];
  const l2Resources = Array.isArray(allResources)
    ? allResources.filter((r) => r.level === 2)
    : [];

  useEffect(() => {
    const trimmed = String(resourceName ?? "").trim();
    if (!trimmed) { setNameAvailable(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await resourceService.checkName(trimmed);
        setNameAvailable(res?.available ?? null);
      } catch {
        setNameAvailable(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [resourceName]);

  const handleClose = () => {
    reset();
    setNameError("");
    setNameAvailable(null);
    setAttributeRows([]);
    setOverrides([]);
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  // Drop overrides for apps that get deselected
  useEffect(() => {
    const selectedIds = new Set(selectedL1Apps.map((a) => a._id ?? a.id));
    setOverrides((prev) => prev.filter((o) => selectedIds.has(o.appId)));
  }, [selectedL1Apps]);

  const addOverride = () => {
    const firstAppId = selectedL1Apps[0]?._id ?? selectedL1Apps[0]?.id ?? "";
    const firstDefId = attrDefs[0]?.id ?? "";
    setOverrides((prev) => [...prev, { appId: firstAppId, attributeDefId: firstDefId, value: "" }]);
  };

  const updateOverride = (index, patch) =>
    setOverrides((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  const removeOverride = (index) =>
    setOverrides((prev) => prev.filter((_, i) => i !== index));

  const addAttributeRow = () => {
    const firstDefId = attrDefs[0]?.id ?? "";
    if (!firstDefId) return;
    setAttributeRows((prev) => [...prev, { attributeDefId: firstDefId, value: "" }]);
  };

  const updateAttributeRow = (index, patch) =>
    setAttributeRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeAttributeRow = (index) =>
    setAttributeRows((prev) => prev.filter((_, i) => i !== index));

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const result = await resourceService.createResource(payload);
      if (result?.success === false && result?.error) {
        throw new Error(result.error);
      }
      const resourceId = result?.data?.id ?? result?.data?._id;
      const commonEntries = attributeRows
        .filter((row) => row.attributeDefId && row.value !== "" && row.value !== undefined)
        .map((row) => ({ attributeDefId: row.attributeDefId, value: row.value }));
      const overrideEntries = overrides
        .filter((o) => o.attributeDefId && o.value !== "" && o.value !== undefined)
        .map((o) => ({ attributeDefId: o.attributeDefId, value: o.value, applicationId: o.appId }));
      const allEntries = [...commonEntries, ...overrideEntries];
      if (resourceId && allEntries.length > 0) {
        await resourceService.upsertResourceAttributes(resourceId, allEntries);
      }
      return result;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Resource created successfully" });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["all-resources-modal"] });
      onSuccess?.();
      handleClose();
    },
    onError: (err) => {
      if (err?.status === 409 || err?.message?.includes("already exists")) {
        setNameError("This name already exists. Resource names must be globally unique.");
      } else {
        toast({
          title: "Error",
          description: err?.message ?? "Failed to create resource",
          variant: "destructive",
        });
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    setNameError("");
    createMutation.mutate(buildPayload());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Resource</DialogTitle>
          <DialogDescription>
            Resources are shared across applications. Names must be globally unique.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                1. Resource Structure
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose whether this is a container (Level 2) or a study/leaf resource
                (Level 3) that belongs inside a container.
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1 block">
                Resource Level *
              </Label>
              <div
                role="radiogroup"
                aria-label="Resource level"
                className="inline-flex rounded-md border border-input p-0.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={creationLevel === 2}
                  onClick={() => setCreationLevel(2)}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    creationLevel === 2
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-transparent hover:bg-muted"
                  }`}
                >
                  Container (L2)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={creationLevel === 3}
                  onClick={() => setCreationLevel(3)}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    creationLevel === 3
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-transparent hover:bg-muted"
                  }`}
                >
                  Leaf Resource (L3)
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {creationLevel === 2
                  ? "Containers group leaf resources (e.g. a Project or Site)."
                  : "Leaf resources represent the lowest-level entity (e.g. a Study)."}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1 block">
                Applications *
              </Label>
              {isHubOwner ? (
                <ApplicationMultiSelect
                  applications={applications}
                  selectedApps={selectedL1Apps}
                  onSelectionChange={setSelectedL1Apps}
                  placeholder="Select applications..."
                />
              ) : (
                <AppOwnerApplicationSelect
                  ownedAppIds={ownedAppIds}
                  allApplications={applications}
                  value={selectedL1Apps[0] ?? null}
                  onChange={(app) => setSelectedL1Apps(app ? [app] : [])}
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Resources can be shared across multiple applications.
              </p>
            </div>

            {creationLevel === 3 && (
              <div>
                <Label className="text-sm font-medium mb-1 block">
                  Parent Container (Level 2) *
                </Label>
                {isL2Locked ? (
                  <div className="flex items-center gap-2 h-9 px-3 py-2 rounded-md border border-input bg-muted/50 text-muted-foreground cursor-not-allowed">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>Unassigned (Enforced by Application Logic)</span>
                  </div>
                ) : (
                  <L2ContainerSelect
                    l2Resources={l2Resources}
                    selectedL2={selectedL2}
                    onSelect={setSelectedL2}
                    selectedL1Apps={selectedL1Apps}
                    placeholder="Select a container..."
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Only containers linked to the selected applications are shown.
                </p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-1 block">
                Resource Name *
              </Label>
              <Input
                value={resourceName}
                onChange={(e) => {
                  setResourceName(e.target.value);
                  setNameError("");
                  setNameAvailable(null);
                }}
                placeholder={
                  creationLevel === 2
                    ? "Enter container name (e.g. Oncology Project)"
                    : "Enter leaf resource name (e.g. Phase III Study)"
                }
              />
              {nameError ? (
                <p className="text-sm text-destructive mt-1">{nameError}</p>
              ) : nameAvailable === true ? (
                <p className="text-xs text-green-600 mt-1">✓ Name is available</p>
              ) : nameAvailable === false ? (
                <p className="text-xs text-destructive mt-1">✗ Name already taken</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Must be unique across the entire platform.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              2. Details
            </h3>

            <div>
              <Label className="text-sm font-medium mb-1 block">
                Description
              </Label>
              <Textarea
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_DESCRIPTION) setDescription(e.target.value);
                }}
                placeholder="Describe this resource (optional)..."
                rows={2}
              />
              <p className={`text-xs mt-1 text-right ${description.length >= MAX_DESCRIPTION ? "text-destructive" : "text-muted-foreground"}`}>
                {description.length}/{MAX_DESCRIPTION}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1 block">
                Resource External ID
              </Label>
              <Input
                disabled
                placeholder="Auto-generated on save (e.g. HUB-L3-a1b2c3d4)"
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used for API references. Auto-generated by the system on creation.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              3. Attributes
            </h3>

            {attrDefs.length > 0 && (
              <>
              {/* 3a: Resource attributes (applicationId = null) */}
              <div className="space-y-3">
                {attributeRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No attributes added.</p>
                ) : (
                  <div className="space-y-2">
                    {attributeRows.map((row, i) => {
                      const def = attrDefs.find((d) => d.id === row.attributeDefId);
                      return (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-md border border-gray-100 bg-gray-50">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Attribute Key</p>
                              <select
                                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                value={row.attributeDefId}
                                onChange={(e) => updateAttributeRow(i, { attributeDefId: e.target.value, value: "" })}
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
                                  value={row.value === undefined ? "" : String(row.value)}
                                  onChange={(e) => updateAttributeRow(i, { value: e.target.value === "" ? "" : e.target.value === "true" })}
                                >
                                  <option value="">— not set —</option>
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : def?.dataType === "enum" && def?.constraints?.allowedValues?.length > 0 ? (
                                <select
                                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                                  value={row.value ?? ""}
                                  onChange={(e) => updateAttributeRow(i, { value: e.target.value })}
                                >
                                  <option value="">— not set —</option>
                                  {def.constraints.allowedValues.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                              ) : def?.dataType === "datetime" ? (
                                <Input
                                  className="h-8 text-xs"
                                  type="datetime-local"
                                  value={row.value ?? ""}
                                  onChange={(e) => updateAttributeRow(i, { value: e.target.value })}
                                />
                              ) : def?.dataType === "list" ? (
                                <Input
                                  className="h-8 text-xs"
                                  type="text"
                                  placeholder="a, b, c"
                                  value={Array.isArray(row.value) ? row.value.join(", ") : (row.value ?? "")}
                                  onChange={(e) =>
                                    updateAttributeRow(i, {
                                      value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                    })
                                  }
                                />
                              ) : (
                                <Input
                                  className="h-8 text-xs"
                                  type={def?.dataType === "number" ? "number" : "text"}
                                  value={row.value ?? ""}
                                  onChange={(e) =>
                                    updateAttributeRow(i, {
                                      value: def?.dataType === "number"
                                        ? (e.target.value === "" ? "" : Number(e.target.value))
                                        : e.target.value,
                                    })
                                  }
                                  placeholder="Enter value..."
                                />
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttributeRow(i)}
                            className="mt-5 text-gray-400 hover:text-red-500 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addAttributeRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Attribute
                </Button>
              </div>

              {/* 3b: App-specific overrides — only shown when multiple apps are selected */}
              {selectedL1Apps.length > 1 && (
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
                                >
                                  {selectedL1Apps.map((app) => {
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
                                  >
                                    <option value="">— not set —</option>
                                    {def.constraints.allowedValues.map((v) => (
                                      <option key={v} value={v}>{v}</option>
                                    ))}
                                  </select>
                                ) : def?.dataType === "datetime" ? (
                                  <Input
                                    className="h-8 text-xs"
                                    type="datetime-local"
                                    value={override.value ?? ""}
                                    onChange={(e) => updateOverride(i, { value: e.target.value })}
                                  />
                                ) : def?.dataType === "list" ? (
                                  <Input
                                    className="h-8 text-xs"
                                    type="text"
                                    placeholder="a, b, c"
                                    value={Array.isArray(override.value) ? override.value.join(", ") : (override.value ?? "")}
                                    onChange={(e) =>
                                      updateOverride(i, {
                                        value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                      })
                                    }
                                  />
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
                                  />
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeOverride(i)}
                              className="mt-5 text-gray-400 hover:text-red-500 shrink-0"
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
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Override
                  </Button>
                </div>
              )}
            </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Resource"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
