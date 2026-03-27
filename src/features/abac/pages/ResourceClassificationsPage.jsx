import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { abacService } from '@/features/abac/api/abacService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2, X, ShieldCheck } from 'lucide-react';

function sensitivityColor(level) {
  if (level <= 3) return 'bg-green-500';
  if (level <= 6) return 'bg-amber-500';
  return 'bg-red-500';
}

function sensitivityDotColor(level) {
  if (level <= 3) return 'bg-green-500';
  if (level <= 6) return 'bg-amber-500';
  return 'bg-red-500';
}

const EMPTY_FORM = {
  key: '',
  displayName: '',
  description: '',
  sensitivityLevel: 5,
};

export function ResourceClassificationsPage() {
  const { toast } = useToast();
  const [slideOver, setSlideOver] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['abac', 'classifications'],
    queryFn: abacService.listClassifications,
    staleTime: 60_000,
  });
  const classifications = data?.data?.data ?? data?.data ?? [];
  const sorted = [...classifications].sort(
    (a, b) => a.sensitivityLevel - b.sensitivityLevel
  );

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM);
  }, []);

  const openCreate = () => {
    resetForm();
    setSlideOver('create');
  };

  const openEdit = (item) => {
    setFormData({
      key: item.key || '',
      displayName: item.displayName || '',
      description: item.description || '',
      sensitivityLevel: item.sensitivityLevel ?? 5,
    });
    setSlideOver(item);
  };

  const closePanel = () => setSlideOver(null);

  const isEditing = slideOver !== null && slideOver !== 'create';
  const editId = isEditing ? (slideOver.id || slideOver._id) : null;

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (data) => abacService.createClassification(data),
    onSuccess: () => {
      toast({ title: 'Classification created' });
      refetch();
      closePanel();
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => abacService.updateClassification(id, data),
    onSuccess: () => {
      toast({ title: 'Classification updated' });
      refetch();
      closePanel();
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => abacService.deleteClassification(id),
    onSuccess: () => {
      toast({ title: 'Classification deleted' });
      setDeleteConfirmId(null);
      refetch();
    },
    onError: (err) => {
      setDeleteConfirmId(null);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    const payload = { ...formData };
    if (slideOver === 'create') {
      createMutation.mutate(payload);
    } else {
      const { key, ...rest } = payload;
      updateMutation.mutate({ id: editId, data: rest });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Resource Classifications
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Define the sensitivity taxonomy used in policy conditions
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Classification
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <ShieldCheck className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">
            No classifications defined
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Add sensitivity levels to classify resources in your policy
            conditions
          </p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Classification
          </Button>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((item) => {
            const id = item.id || item._id;
            const isDeleting = deleteConfirmId === id;
            const level = item.sensitivityLevel ?? 0;
            const pct = Math.min(Math.max((level / 10) * 100, 0), 100);

            return (
              <Card key={id} className="p-5 flex flex-col gap-3">
                {/* Top row */}
                <div className="flex items-start justify-between">
                  <span className="font-mono text-base font-semibold text-gray-900">
                    {item.key}
                  </span>
                  {!isDeleting && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-red-500"
                        onClick={() => setDeleteConfirmId(id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Display name */}
                <div className="text-sm text-gray-700">
                  {item.displayName || '—'}
                </div>

                {/* Description */}
                <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">
                  {item.description || '—'}
                </p>

                {/* Sensitivity bar */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Sensitivity Level {level}/10
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5 w-full">
                    <div
                      className={`${sensitivityColor(level)} rounded-full h-1.5 transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Inline delete confirmation */}
                {isDeleting && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <span className="text-xs text-red-600 flex-1">
                      Delete this classification? Cannot be undone.
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Confirm'}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Slide-over panel */}
      {slideOver !== null && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={closePanel}
          />
          <div className="fixed right-0 top-0 h-full w-[440px] z-50 bg-white border-l border-gray-200 shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-base">
                {slideOver === 'create'
                  ? 'New Classification'
                  : 'Edit Classification'}
              </h2>
              <Button variant="ghost" size="sm" onClick={closePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Key</Label>
                <Input
                  value={formData.key}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      key: e.target.value
                        .toLowerCase()
                        .replace(/\s/g, ''),
                    }))
                  }
                  className="font-mono"
                  disabled={isEditing}
                  placeholder="e.g. confidential"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      displayName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Confidential"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe this classification level..."
                />
              </div>

              <div className="space-y-2">
                <Label>Sensitivity Level</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={formData.sensitivityLevel}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        sensitivityLevel: Number(e.target.value),
                      }))
                    }
                    className="flex-1 accent-gray-900"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.sensitivityLevel}
                      onChange={(e) => {
                        const v = Math.min(
                          10,
                          Math.max(1, Number(e.target.value) || 1)
                        );
                        setFormData((p) => ({
                          ...p,
                          sensitivityLevel: v,
                        }));
                      }}
                      className="w-16 text-center"
                    />
                    <div
                      className={`h-3 w-3 rounded-full ${sensitivityDotColor(formData.sensitivityLevel)}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={closePanel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
