import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { resourceService } from "../api/resourceService";
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
import { L2ContainerSelect } from "./L2ContainerSelect";

const MAX_DESCRIPTION = 500;

/**
 * Create-resource modal scoped to a single application.
 * The application is pre-filled and locked — user cannot change it.
 */
export function AppResourceRegistrationModal({ open, onOpenChange, application, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nameError, setNameError] = useState("");
  const [nameAvailable, setNameAvailable] = useState(null);
  const [attributeRows, setAttributeRows] = useState([]);

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
    initForApp,
  } = useResourceForm();

  const appId = application?._id ?? application?.id;

  useEffect(() => {
    if (open && application) initForApp(application);
  }, [open, appId]);

  const { data: attrDefsResponse } = useQuery({
    queryKey: ["resource-attribute-definitions"],
    queryFn: () => resourceService.listAttributeDefinitions(),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const attrDefs = attrDefsResponse?.data ?? [];

  const { data: appResourcesResponse } = useQuery({
    queryKey: ["resources-by-app-modal", appId],
    queryFn: () => resourceService.getResourcesByApplication(appId),
    enabled: open && !!appId,
    staleTime: 0,
  });
  const l2Resources = (appResourcesResponse?.data ?? []).filter((r) => r.level === 2 && r.isUnassignedNode !== true);

  // Debounced name availability check
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
    if (onOpenChange) onOpenChange(false);
  };

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
      if (result?.success === false && result?.error) throw new Error(result.error);
      const resourceId = result?.data?.id ?? result?.data?._id;

      const entries = attributeRows
        .filter((row) => row.attributeDefId && row.value !== "" && row.value !== undefined)
        .map((row) => ({ attributeDefId: row.attributeDefId, value: row.value }));
      if (resourceId && entries.length > 0) {
        await resourceService.upsertResourceAttributes(resourceId, entries);
      }
      return result;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Resource created successfully" });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["resources-by-app", application?._id ?? application?.id] });
      queryClient.invalidateQueries({ queryKey: ["all-resources-modal"] });
      onSuccess?.();
      handleClose();
    },
    onError: (err) => {
      if (err?.status === 409 || err?.message?.includes("already exists")) {
        setNameError("This name already exists. Resource names must be globally unique.");
      } else {
        toast({ title: "Error", description: err?.message ?? "Failed to create resource", variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    setNameError("");
    createMutation.mutate(buildPayload());
  };

  const appName = application?.name ?? application?.appCode ?? "this application";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Resource</DialogTitle>
          <DialogDescription>
            Creating a resource for <strong>{appName}</strong>. Names must be globally unique.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Structure */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                1. Resource Structure
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose whether this is a container (Level 2) or a leaf resource (Level 3).
              </p>
            </div>

            {!isL2Locked && (
              <div>
                <Label className="text-sm font-medium mb-1 block">Resource Level *</Label>
                <div role="radiogroup" aria-label="Resource level" className="inline-flex rounded-md border border-input p-0.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={creationLevel === 2}
                    onClick={() => setCreationLevel(2)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${creationLevel === 2 ? "bg-primary text-primary-foreground shadow-sm" : "bg-transparent hover:bg-muted"}`}
                  >
                    Container (L2)
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={creationLevel === 3}
                    onClick={() => setCreationLevel(3)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${creationLevel === 3 ? "bg-primary text-primary-foreground shadow-sm" : "bg-transparent hover:bg-muted"}`}
                  >
                    Leaf Resource (L3)
                  </button>
                </div>
              </div>
            )}

            {/* Application — locked, read-only display */}
            <div>
              <Label className="text-sm font-medium mb-1 block">Application</Label>
              <div className="flex items-center h-9 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{appName}</span>
                {application?.appCode && (
                  <span className="text-xs text-muted-foreground">({application.appCode})</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Resource will be created and linked to this application.
              </p>
            </div>

            {creationLevel === 3 && (
              <div>
                <Label className="text-sm font-medium mb-1 block">Parent Container (Level 2) *</Label>
                {isL2Locked ? (
                  <div className="flex items-center gap-2 h-9 px-3 py-2 rounded-md border border-input bg-muted/50 text-muted-foreground cursor-not-allowed">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>Unassigned (Auto-assigned by Application Logic)</span>
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
                  Only containers linked to this application are shown.
                </p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-1 block">Resource Name *</Label>
              <Input
                value={resourceName}
                onChange={(e) => {
                  setResourceName(e.target.value);
                  setNameError("");
                  setNameAvailable(null);
                }}
                placeholder={creationLevel === 2 ? "Enter container name (e.g. Oncology Project)" : "Enter leaf resource name (e.g. Phase III Study)"}
              />
              {nameError ? (
                <p className="text-sm text-destructive mt-1">{nameError}</p>
              ) : nameAvailable === true ? (
                <p className="text-xs text-green-600 mt-1">✓ Name is available</p>
              ) : nameAvailable === false ? (
                <p className="text-xs text-destructive mt-1">✗ Name already taken</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Must be unique across the entire platform.</p>
              )}
            </div>
          </div>

          {/* Section 2: Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">2. Details</h3>
            <div>
              <Label className="text-sm font-medium mb-1 block">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => { if (e.target.value.length <= MAX_DESCRIPTION) setDescription(e.target.value); }}
                placeholder="Describe this resource (optional)..."
                rows={2}
              />
              <p className={`text-xs mt-1 text-right ${description.length >= MAX_DESCRIPTION ? "text-destructive" : "text-muted-foreground"}`}>
                {description.length}/{MAX_DESCRIPTION}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Resource External ID</Label>
              <Input disabled placeholder="Auto-generated on save (e.g. HUB-L3-a1b2c3d4)" className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">Auto-generated by the system on creation.</p>
            </div>
          </div>

          {/* Section 3: Attributes */}
          {attrDefs.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">3. Attributes</h3>
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
                                {attrDefs.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
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
                                  {def.constraints.allowedValues.map((v) => <option key={v} value={v}>{v}</option>)}
                                </select>
                              ) : def?.dataType === "datetime" ? (
                                <Input className="h-8 text-xs" type="datetime-local" value={row.value ?? ""} onChange={(e) => updateAttributeRow(i, { value: e.target.value })} />
                              ) : def?.dataType === "list" ? (
                                <Input
                                  className="h-8 text-xs" type="text" placeholder="a, b, c"
                                  value={Array.isArray(row.value) ? row.value.join(", ") : (row.value ?? "")}
                                  onChange={(e) => updateAttributeRow(i, { value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                                />
                              ) : (
                                <Input
                                  className="h-8 text-xs"
                                  type={def?.dataType === "number" ? "number" : "text"}
                                  value={row.value ?? ""}
                                  onChange={(e) => updateAttributeRow(i, { value: def?.dataType === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value })}
                                  placeholder="Enter value..."
                                />
                              )}
                            </div>
                          </div>
                          <button type="button" onClick={() => removeAttributeRow(i)} className="mt-5 text-gray-400 hover:text-red-500 shrink-0">
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
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={!isValid || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Resource"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
