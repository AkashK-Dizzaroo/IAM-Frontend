import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { userService } from '../api/userService';
import { resourceService } from '@/features/resources';

export function AssignManagerModal({
  open,
  onOpenChange,
  user,
  applicationId,
  existingManagerResourceIds = [],
  onSuccess,
}) {
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ['resources', 'application', applicationId],
    queryFn: async () => {
      const response = await resourceService.getResourcesByApplication(applicationId);
      const data = response?.data ?? response;
      return Array.isArray(data) ? data : (data?.resources ?? []);
    },
    enabled: open && !!applicationId,
    staleTime: 5 * 60 * 1000,
  });

  const availableResources = resources.filter(
    (r) => !existingManagerResourceIds.includes(r._id ?? r.id)
  );

  const { mutate: assign, isPending } = useMutation({
    mutationFn: () =>
      userService.assignAppManager(user._id, applicationId, selectedResourceId),
    onSuccess: () => {
      toast({ title: 'App Manager assigned successfully' });
      queryClient.invalidateQueries({ queryKey: ['appTeam', applicationId] });
      onSuccess?.();
      onOpenChange(false);
      setSelectedResourceId('');
    },
    onError: (error) => {
      toast({
        title: 'Failed to assign manager',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign App Manager</DialogTitle>
          <DialogDescription>
            Assigning {user?.firstName} {user?.lastName} as App Manager.
            Select the resource they will manage. Assignment is valid for 1 year.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Resource *
            </label>
            {resourcesLoading ? (
              <p className="text-sm text-gray-400">Loading resources...</p>
            ) : availableResources.length === 0 ? (
              <p className="text-sm text-gray-500">
                No available resources. This user may already manage all resources.
              </p>
            ) : (
              <select
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select a resource...</option>
                {availableResources.map((r) => (
                  <option key={r._id ?? r.id} value={r._id ?? r.id}>
                    {r.name || r.resourceExternalId}
                    {r.level ? ` (L${r.level})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
            This user will be able to process access requests for the selected
            resource. Assignment expires in 1 year.
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
            onClick={() => assign()}
            disabled={isPending || !selectedResourceId}
          >
            {isPending ? 'Assigning...' : 'Assign Manager'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
