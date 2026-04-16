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
import { Lock } from "lucide-react";
import { ApplicationMultiSelect } from "./ApplicationMultiSelect";
import { L2ContainerSelect } from "./L2ContainerSelect";

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
  const [attrValues, setAttrValues] = useState({});

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

  const handleClose = () => {
    reset();
    setNameError("");
    setAttrValues({});
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const result = await resourceService.createResource(payload);
      if (result?.success === false && result?.error) {
        throw new Error(result.error);
      }
      // Chain: save attribute values if any were filled in
      const resourceId = result?.data?.id ?? result?.data?._id;
      const entries = attrDefs
        .filter((def) => attrValues[def.id] !== undefined && attrValues[def.id] !== "")
        .map((def) => ({ attributeDefId: def.id, value: attrValues[def.id] }));
      if (resourceId && entries.length > 0) {
        await resourceService.upsertResourceAttributes(resourceId, entries);
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
                Resource Type
              </Label>
              <div
                role="radiogroup"
                aria-label="Resource type"
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
                  Level 2
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
                  Level 3
                </button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1 block">
                Application *
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
                The application this resource belongs to.
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
                    placeholder="Select Level 2..."
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Select the Level 2 container this study belongs under.
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
                }}
                placeholder={
                  creationLevel === 2
                    ? "Enter Level 2 resource name"
                    : "Enter Level 3 resource name"
                }
              />
              {nameError && (
                <p className="text-sm text-destructive mt-1">{nameError}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Must be unique across the entire platform.
              </p>
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
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this resource (optional)..."
                rows={2}
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1 block">
                Resource External ID
              </Label>
              <Input
                disabled
                placeholder="Auto-generated on save"
                className="bg-muted"
              />
            </div>
          </div>

          {attrDefs.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  3. Attributes
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Optional custom attributes for this resource.
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
                      value={attrValues[def.id] ?? ""}
                      onChange={(e) =>
                        setAttrValues((p) => ({ ...p, [def.id]: e.target.value === "" ? "" : e.target.value === "true" }))
                      }
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
                    />
                  )}
                  {def.description && (
                    <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

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
