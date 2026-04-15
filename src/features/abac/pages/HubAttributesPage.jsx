import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { abacService } from '@/features/abac/api/abacService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

const DATA_TYPES = ['string', 'number', 'boolean', 'enum', 'list', 'datetime'];

const DATA_TYPE_COLORS = {
  string: 'bg-blue-100 text-blue-700 border-blue-200',
  number: 'bg-purple-100 text-purple-700 border-purple-200',
  boolean: 'bg-green-100 text-green-700 border-green-200',
  enum: 'bg-amber-100 text-amber-700 border-amber-200',
  list: 'bg-orange-100 text-orange-700 border-orange-200',
  datetime: 'bg-pink-100 text-pink-700 border-pink-200',
};

const EMPTY_FORM = {
  key: '',
  displayName: '',
  namespace: 'subject',
  dataType: 'string',
  constraints: {},
  isRequired: false,
};

export function HubAttributesPage() {
  const { toast } = useToast();
  const [slideOver, setSlideOver] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [enumInput, setEnumInput] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['abac', 'hubAttrDefs'],
    queryFn: abacService.listHubAttrDefs,
    staleTime: 60_000,
  });
  const defs = data?.data?.data ?? data?.data ?? [];

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM);
    setEnumInput('');
  }, []);

  const openCreate = () => {
    resetForm();
    setSlideOver('create');
  };

  const openEdit = (def) => {
    setFormData({
      key: def.key || '',
      displayName: def.displayName || '',
      namespace: def.namespace || 'subject',
      dataType: def.dataType || 'string',
      constraints: def.constraints || {},
      isRequired: def.isRequired || false,
    });
    setEnumInput('');
    setSlideOver(def);
  };

  const closePanel = () => setSlideOver(null);

  const isEditing = slideOver !== null && slideOver !== 'create';
  const editId = isEditing ? (slideOver.id || slideOver._id) : null;

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (data) => abacService.createHubAttrDef(data),
    onSuccess: () => {
      toast({ title: 'Attribute created' });
      refetch();
      closePanel();
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => abacService.updateHubAttrDef(id, data),
    onSuccess: () => {
      toast({ title: 'Attribute updated' });
      refetch();
      closePanel();
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => abacService.deleteHubAttrDef(id),
    onSuccess: () => {
      toast({ title: 'Attribute deleted' });
      setDeleteConfirmId(null);
      refetch();
    },
    onError: (err) => {
      setDeleteConfirmId(null);
      const msg =
        err?.response?.status === 409
          ? 'Cannot delete — users have values for this attribute. Remove all values first.'
          : err.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
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

  // --- Constraints helpers ---
  const updateConstraint = (key, value) => {
    setFormData((p) => ({
      ...p,
      constraints: { ...p.constraints, [key]: value },
    }));
  };

  const addEnumValue = () => {
    const val = enumInput.trim();
    if (!val) return;
    const existing = formData.constraints.allowedValues || [];
    if (existing.includes(val)) return;
    updateConstraint('allowedValues', [...existing, val]);
    setEnumInput('');
  };

  const removeEnumValue = (val) => {
    const existing = formData.constraints.allowedValues || [];
    updateConstraint(
      'allowedValues',
      existing.filter((v) => v !== val)
    );
  };

  const formatConstraints = (def) => {
    const c = def.constraints || {};
    if (def.dataType === 'enum' || def.dataType === 'list') {
      const vals = c.allowedValues || [];
      return vals.length ? `values: [${vals.join(', ')}]` : '—';
    }
    if (def.dataType === 'number') {
      const parts = [];
      if (c.min !== undefined && c.min !== null) parts.push(`min: ${c.min}`);
      if (c.max !== undefined && c.max !== null) parts.push(`max: ${c.max}`);
      return parts.length ? parts.join(', ') : '—';
    }
    if (def.dataType === 'string') {
      const parts = [];
      if (c.pattern) parts.push(`pattern: ${c.pattern}`);
      if (c.maxLength) parts.push(`maxLength: ${c.maxLength}`);
      return parts.length ? parts.join(', ') : '—';
    }
    return '—';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Hub Attributes
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Define the identity attribute schema for all users
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Attribute
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

      {/* Table */}
      {!isLoading && defs.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Key</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Display Name
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Data Type
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Constraints
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Required
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {defs.map((def) => {
                const id = def.id || def._id;
                const isDeleting = deleteConfirmId === id;
                return (
                  <tr key={id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">
                      {def.key}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {def.displayName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          DATA_TYPE_COLORS[def.dataType] ||
                          'bg-gray-100 text-gray-700'
                        }
                      >
                        {def.dataType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                      {formatConstraints(def)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          def.isRequired
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }
                      >
                        {def.isRequired ? 'yes' : 'no'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {isDeleting ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600">
                            Delete? Cannot be undone.
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
                            {deleteMutation.isPending
                              ? 'Deleting...'
                              : 'Confirm Delete'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(def)}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && defs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <svg
              className="h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 6h.008v.008H6V6z"
              />
            </svg>
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">
            No attributes defined
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Define Hub identity attributes for your users
          </p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Attribute
          </Button>
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
                {slideOver === 'create' ? 'New Attribute' : 'Edit Attribute'}
              </h2>
              <Button variant="ghost" size="sm" onClick={closePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {slideOver === 'create' && (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
                  Key cannot be changed after creation. Choose carefully — it is
                  used in policy conditions.
                </div>
              )}

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
                  placeholder="e.g. department"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Namespace</Label>
                <Input
                  value={formData.namespace}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      namespace: e.target.value.toLowerCase().replace(/\s/g, ''),
                    }))
                  }
                  className="font-mono"
                  disabled={isEditing}
                  placeholder="e.g. subject"
                />
                {isEditing && (
                  <p className="text-xs text-gray-400">Cannot be changed after creation.</p>
                )}
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
                  placeholder="e.g. Department"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Data Type</Label>
                <Select
                  value={formData.dataType}
                  onValueChange={(val) =>
                    setFormData((p) => ({
                      ...p,
                      dataType: val,
                      constraints: {},
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {dt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic constraints */}
              <div className="space-y-3">
                <Label>Constraints</Label>

                {formData.dataType === 'string' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">Pattern</Label>
                      <Input
                        value={formData.constraints.pattern || ''}
                        onChange={(e) =>
                          updateConstraint('pattern', e.target.value)
                        }
                        placeholder="regex pattern, optional"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">
                        Max Length
                      </Label>
                      <Input
                        type="number"
                        value={formData.constraints.maxLength || ''}
                        onChange={(e) =>
                          updateConstraint(
                            'maxLength',
                            e.target.value ? Number(e.target.value) : ''
                          )
                        }
                        placeholder="e.g. 255"
                      />
                    </div>
                  </div>
                )}

                {formData.dataType === 'number' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">Min</Label>
                      <Input
                        type="number"
                        value={formData.constraints.min ?? ''}
                        onChange={(e) =>
                          updateConstraint(
                            'min',
                            e.target.value !== '' ? Number(e.target.value) : undefined
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">Max</Label>
                      <Input
                        type="number"
                        value={formData.constraints.max ?? ''}
                        onChange={(e) =>
                          updateConstraint(
                            'max',
                            e.target.value !== '' ? Number(e.target.value) : undefined
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                {formData.dataType === 'boolean' && (
                  <p className="text-sm text-gray-400">
                    Boolean attributes have no constraints
                  </p>
                )}

                {formData.dataType === 'datetime' && (
                  <p className="text-sm text-gray-400">
                    Datetime attributes have no constraints
                  </p>
                )}

                {(formData.dataType === 'enum' ||
                  formData.dataType === 'list') && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(formData.constraints.allowedValues || []).map(
                        (val) => (
                          <span
                            key={val}
                            className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-mono px-2 py-1 rounded"
                          >
                            {val}
                            <button
                              type="button"
                              onClick={() => removeEnumValue(val)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={enumInput}
                        onChange={(e) => setEnumInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addEnumValue();
                          }
                        }}
                        placeholder="Type a value..."
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addEnumValue}
                        disabled={!enumInput.trim()}
                      >
                        Add value
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label>Required</Label>
                <Switch
                  checked={formData.isRequired}
                  onCheckedChange={(val) =>
                    setFormData((p) => ({ ...p, isRequired: val }))
                  }
                />
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
