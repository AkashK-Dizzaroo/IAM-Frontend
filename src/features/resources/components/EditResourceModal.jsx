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
import { ApplicationMultiSelect } from "./ApplicationMultiSelect";

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

  const { data: applicationsResponse } = useQuery({
    queryKey: ["applications-edit-modal"],
    queryFn: () => applicationService.getApplications(),
    enabled: open,
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

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      resourceService.updateResource(resource._id ?? resource.id, {
        name: name.trim(),
        description,
        assignedApplications: assignedApps.map((a) => a._id ?? a.id ?? a),
        isActive,
      }),
    onSuccess: () => {
      toast({ title: "Success", description: "Resource updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["all-resources-modal"] });
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this resource (optional)..."
              rows={3}
              disabled={isPending}
            />
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
