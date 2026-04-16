import React, { useState, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { abacService } from '../api/abacService';
import { useAbacScope } from '../contexts/AbacScopeContext';

const DATA_TYPES = [
  { value: 'string',   label: 'String'   },
  { value: 'number',   label: 'Number'   },
  { value: 'boolean',  label: 'Boolean'  },
  { value: 'enum',     label: 'Enum'     },
  { value: 'list',     label: 'List'     },
  { value: 'datetime', label: 'DateTime' },
];

const NAMESPACES = ['subject', 'resource', 'action', 'environment'];

const NAMESPACE_BADGE = {
  subject:     'bg-blue-50 text-blue-700 border-blue-200',
  resource:    'bg-purple-50 text-purple-700 border-purple-200',
  action:      'bg-teal-50 text-teal-700 border-teal-200',
  environment: 'bg-gray-100 text-gray-600 border-gray-200',
};

const EMPTY_FORM = {
  attribute_name:     '',
  display_name:       '',
  description:        '',
  namespace:          'subject',
  attribute_type:     'string',
  allowed_values:     '',   // comma-separated string in UI
  default_value:      '',
  min_value:          '',
  max_value:          '',
  is_required:        false,
  is_multi_valued:    false,
};

function formFromAttr(attr) {
  const c = attr.constraints ?? {};
  return {
    attribute_name:  attr.key          ?? '',
    display_name:    attr.displayName  ?? '',
    description:     attr.description  ?? '',
    namespace:       attr.namespace    ?? 'subject',
    attribute_type:  attr.dataType     ?? 'string',
    allowed_values:  (c.allowedValues ?? []).join(', '),
    default_value:   c.defaultValue != null ? String(c.defaultValue) : '',
    min_value:       c.min != null ? String(c.min) : '',
    max_value:       c.max != null ? String(c.max) : '',
    is_required:     attr.isRequired   ?? false,
    is_multi_valued: attr.isMultiValued ?? false,
  };
}

function buildPayload(form) {
  const constraints = {};
  if (form.attribute_type === 'enum' && form.allowed_values.trim()) {
    constraints.allowedValues = form.allowed_values
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (form.attribute_type === 'number') {
    if (form.min_value.trim() !== '') constraints.min = Number(form.min_value);
    if (form.max_value.trim() !== '') constraints.max = Number(form.max_value);
  }
  if (form.default_value.trim() !== '') {
    constraints.defaultValue = form.default_value.trim();
  }
  return {
    namespace:     form.namespace,
    key:           form.attribute_name.trim(),
    displayName:   form.display_name.trim(),
    description:   form.description.trim() || undefined,
    dataType:      form.attribute_type,
    isRequired:    form.is_required,
    isMultiValued: form.is_multi_valued,
    constraints,
  };
}

// ─── Form fields ─────────────────────────────────────────────────────────────

function AttributeForm({ form, setForm, mode }) {
  const isEdit = mode === 'edit';

  return (
    <div className="space-y-4">
      {/* attribute_name */}
      <div className="space-y-1.5">
        <Label htmlFor="f-key">
          Attribute Name {!isEdit && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id="f-key"
          placeholder="e.g. tmf_role"
          className="font-mono text-sm"
          value={form.attribute_name}
          disabled={isEdit}
          onChange={(e) =>
            setForm({
              ...form,
              attribute_name: e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_'),
            })
          }
        />
        {isEdit && (
          <p className="text-xs text-gray-400">Cannot be changed after creation.</p>
        )}
      </div>

      {/* display_name */}
      <div className="space-y-1.5">
        <Label htmlFor="f-display">
          Display Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="f-display"
          placeholder="e.g. TMF Role"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
        />
      </div>

      {/* description */}
      <div className="space-y-1.5">
        <Label htmlFor="f-desc">Description</Label>
        <Textarea
          id="f-desc"
          placeholder="e.g. Controls access level within eTMF application"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      {/* namespace */}
      <div className="space-y-1.5">
        <Label>
          Namespace {!isEdit && <span className="text-red-500">*</span>}
        </Label>
        <Select
          value={form.namespace}
          disabled={isEdit}
          onValueChange={(v) => setForm({ ...form, namespace: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NAMESPACES.map((ns) => (
              <SelectItem key={ns} value={ns}>{ns}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEdit && (
          <p className="text-xs text-gray-400">Cannot be changed after creation.</p>
        )}
      </div>

      {/* attribute_type */}
      <div className="space-y-1.5">
        <Label>
          Attribute Type {!isEdit && <span className="text-red-500">*</span>}
        </Label>
        <Select
          value={form.attribute_type}
          disabled={isEdit}
          onValueChange={(v) =>
            setForm({ ...form, attribute_type: v, allowed_values: '', default_value: '', min_value: '', max_value: '' })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEdit && (
          <p className="text-xs text-gray-400">Cannot be changed after creation.</p>
        )}
      </div>

      {/* allowed_values — only for enum */}
      {form.attribute_type === 'enum' && (
        <div className="space-y-1.5">
          <Label htmlFor="f-allowed">
            Allowed Values
            {!isEdit && <span className="text-red-500"> *</span>}
          </Label>
          <Input
            id="f-allowed"
            placeholder='e.g. read_only, reviewer, submitter'
            value={form.allowed_values}
            onChange={(e) => setForm({ ...form, allowed_values: e.target.value })}
          />
          <p className="text-xs text-gray-400">Comma-separated list of allowed values.</p>
          {form.allowed_values.trim() && (
            <div className="flex flex-wrap gap-1 pt-1">
              {form.allowed_values
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
                .map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs font-mono">{v}</Badge>
                ))}
            </div>
          )}
        </div>
      )}

      {/* min/max — only for number */}
      {form.attribute_type === 'number' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-min">Min Value</Label>
            <Input
              id="f-min"
              type="number"
              placeholder="e.g. 0"
              value={form.min_value}
              onChange={(e) => setForm({ ...form, min_value: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-max">Max Value</Label>
            <Input
              id="f-max"
              type="number"
              placeholder="e.g. 100"
              value={form.max_value}
              onChange={(e) => setForm({ ...form, max_value: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* default_value */}
      <div className="space-y-1.5">
        <Label htmlFor="f-default">Default Value</Label>
        {form.attribute_type === 'enum' ? (
          <Select
            value={form.default_value}
            onValueChange={(v) => setForm({ ...form, default_value: v === '__none__' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="No default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No default</SelectItem>
              {form.allowed_values
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
                .map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="f-default"
            placeholder={
              form.attribute_type === 'boolean'  ? 'true or false' :
              form.attribute_type === 'number'   ? '0' :
              form.attribute_type === 'datetime' ? '2024-01-01T00:00:00Z' :
              'Optional default'
            }
            value={form.default_value}
            onChange={(e) => setForm({ ...form, default_value: e.target.value })}
          />
        )}
      </div>

      {/* is_required + is_multi_valued */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="f-required"
            checked={form.is_required}
            onCheckedChange={(c) => setForm({ ...form, is_required: Boolean(c) })}
          />
          <Label htmlFor="f-required" className="cursor-pointer">
            Is Required
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="f-multi"
            checked={form.is_multi_valued}
            disabled={isEdit}
            onCheckedChange={(c) => setForm({ ...form, is_multi_valued: Boolean(c) })}
          />
          <Label htmlFor="f-multi" className={`cursor-pointer ${isEdit ? 'text-gray-400' : ''}`}>
            Is Multi-Valued
          </Label>
          {isEdit && (
            <span className="text-xs text-gray-400">(cannot change after creation)</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AppAttributesPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const selectedApp = selectedAppKey
    ? { key: selectedAppKey, name: selectedAppName ?? selectedAppKey }
    : null;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate]     = useState(false);
  const [editTarget, setEditTarget]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createForm, setCreateForm]     = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm]         = useState({ ...EMPTY_FORM });

  const { data, isLoading } = useQuery({
    queryKey: ['abac', 'appAttributes', selectedApp?.key],
    queryFn: () => abacService.listAppAttrDefs(selectedApp.key),
    enabled: !!selectedApp?.key,
  });

  const rawData = data?.data?.data ?? data?.data ?? [];
  const attributes = Array.isArray(rawData) ? rawData : [];

  // Fetch active policies to detect which attr keys are referenced
  const { data: policiesData } = useQuery({
    queryKey: ['abac', 'appPolicies', selectedApp?.key, 'active'],
    queryFn: () => abacService.listAppPolicies(selectedApp.key, { status: 'active' }),
    enabled: !!selectedApp?.key,
    staleTime: 60_000,
  });

  const referencedKeys = useMemo(() => {
    const raw = policiesData?.data?.data ?? policiesData?.data ?? [];
    const policies = Array.isArray(raw) ? raw : [];
    const set = new Set();
    policies.forEach((p) => {
      const conds = p.conditions?.conditions ?? [];
      conds.forEach((c) => {
        if (c.namespace && (c.key ?? c.attribute)) {
          set.add(`${c.namespace}.${c.key ?? c.attribute}`);
        }
      });
    });
    return set;
  }, [policiesData]);

  const createMutation = useMutation({
    mutationFn: (payload) => abacService.createAppAttrDef(selectedApp?.key, payload),
    onSuccess: () => {
      toast({ title: 'Attribute created' });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appAttributes', selectedApp.key] });
      setShowCreate(false);
      setCreateForm({ ...EMPTY_FORM });
    },
    onError: (err) =>
      toast({
        title: 'Failed to create',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => abacService.updateAppAttrDef(selectedApp?.key, id, payload),
    onSuccess: () => {
      toast({ title: 'Attribute updated' });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appAttributes', selectedApp.key] });
      setEditTarget(null);
    },
    onError: (err) =>
      toast({
        title: 'Failed to update',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => abacService.deleteAppAttrDef(selectedApp?.key, id),
    onSuccess: () => {
      toast({ title: 'Attribute deleted' });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appAttributes', selectedApp.key] });
      setDeleteTarget(null);
    },
    onError: (err) =>
      toast({
        title: 'Delete failed',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
  });

  if (!selectedApp) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to manage its attributes.</p>
      </div>
    );
  }

  const handleCreate = () => {
    if (!createForm.attribute_name.trim() || !createForm.display_name.trim()) return;
    createMutation.mutate(buildPayload(createForm));
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    const c = {};
    if (editForm.attribute_type === 'enum' && editForm.allowed_values.trim()) {
      c.allowedValues = editForm.allowed_values.split(',').map((v) => v.trim()).filter(Boolean);
    }
    if (editForm.attribute_type === 'number') {
      if (editForm.min_value.trim() !== '') c.min = Number(editForm.min_value);
      if (editForm.max_value.trim() !== '') c.max = Number(editForm.max_value);
    }
    if (editForm.default_value.trim()) {
      c.defaultValue = editForm.default_value.trim();
    }
    updateMutation.mutate({
      id: editTarget.id,
      payload: {
        displayName: editForm.display_name.trim(),
        description: editForm.description.trim() || undefined,
        isRequired:  editForm.is_required,
        constraints: c,
      },
    });
  };

  const openEdit = (attr) => {
    setEditTarget(attr);
    setEditForm(formFromAttr(attr));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{selectedApp.name} — App Attributes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define attributes specific to this application. These cannot conflict with Hub Attributes.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateForm({ ...EMPTY_FORM });
            setShowCreate(true);
          }}
        >
          + New Attribute
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-3 py-2.5 font-medium w-[22%]">Display Name</th>
              <th className="px-3 py-2.5 font-medium w-[18%]">Attribute Name</th>
              <th className="px-3 py-2.5 font-medium w-[10%]">Namespace</th>
              <th className="px-3 py-2.5 font-medium w-[8%]">Type</th>
              <th className="px-3 py-2.5 font-medium w-[18%]">Allowed Values</th>
              <th className="px-3 py-2.5 font-medium w-[10%]">Default</th>
              <th className="px-3 py-2.5 font-medium w-[8%]">Flags</th>
              <th className="px-3 py-2.5 font-medium w-[6%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading…</td>
              </tr>
            ) : attributes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  <p className="font-medium">No attributes defined yet.</p>
                  <p className="text-xs mt-1">Click <strong>+ New Attribute</strong> to get started.</p>
                </td>
              </tr>
            ) : (
              attributes.map((attr) => {
                const c = attr.constraints ?? {};
                return (
                  <tr key={attr.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900 truncate">{attr.displayName}</p>
                      {attr.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{attr.description}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate">{attr.key}</span>
                        {referencedKeys.has(`${attr.namespace}.${attr.key}`) && (
                          <span className="text-[10px] text-green-700 font-sans font-medium">● in active policy</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded border capitalize ${NAMESPACE_BADGE[attr.namespace] ?? NAMESPACE_BADGE.environment}`}>
                        {attr.namespace}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="capitalize text-xs">{attr.dataType}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {c.allowedValues?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.allowedValues.slice(0, 3).map((v) => (
                            <span key={v} className="bg-gray-100 rounded px-1.5 py-0.5 font-mono">{v}</span>
                          ))}
                          {c.allowedValues.length > 3 && (
                            <span className="text-gray-400">+{c.allowedValues.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {c.defaultValue != null ? (
                        <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5">{String(c.defaultValue)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        {attr.isRequired && (
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] w-fit">Required</Badge>
                        )}
                        {attr.isMultiValued && (
                          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] w-fit">Multi</Badge>
                        )}
                        {!attr.isRequired && !attr.isMultiValued && (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Edit attribute"
                          onClick={() => openEdit(attr)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete attribute"
                          onClick={() => setDeleteTarget(attr)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) setShowCreate(false); }}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>New Attribute — {selectedApp.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <AttributeForm form={createForm} setForm={setCreateForm} mode="create" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2 shrink-0">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                !createForm.attribute_name.trim() ||
                !createForm.display_name.trim()
              }
            >
              {createMutation.isPending ? 'Saving…' : 'Save Attribute'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              Edit Attribute — <span className="font-mono text-sm">{editTarget?.key}</span>
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <AttributeForm form={editForm} setForm={setEditForm} mode="edit" />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2 shrink-0">
                <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending || !editForm.display_name.trim()}
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Attribute?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Delete <span className="font-mono font-medium">{deleteTarget?.key}</span>?
            This will fail if any users still have values for this attribute.
          </p>
          {deleteTarget && referencedKeys.has(`${deleteTarget.namespace}.${deleteTarget.key}`) && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 mt-1">
              <span className="text-amber-500 text-sm mt-0.5">⚠</span>
              <p className="text-xs text-amber-800">
                <strong className="font-semibold">Used in an active policy.</strong>{' '}
                Deleting this attribute will break any policy conditions that reference{' '}
                <span className="font-mono">{deleteTarget.namespace}.{deleteTarget.key}</span>.
                Evaluation will silently fail for those conditions.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
