import React, { useState } from 'react';
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

const EMPTY_FORM = {
  attribute_name:     '',
  display_name:       '',
  description:        '',
  attribute_type:     'string',
  allowed_values:     '',   // comma-separated string in UI
  default_value:      '',
  is_required:        false,
  is_multi_valued:    false,
};

function formFromAttr(attr) {
  const c = attr.constraints ?? {};
  return {
    attribute_name:  attr.key          ?? '',
    display_name:    attr.displayName  ?? '',
    description:     attr.description  ?? '',
    attribute_type:  attr.dataType     ?? 'string',
    allowed_values:  (c.allowedValues ?? []).join(', '),
    default_value:   c.defaultValue != null ? String(c.defaultValue) : '',
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
  if (form.default_value.trim() !== '') {
    constraints.defaultValue = form.default_value.trim();
  }
  return {
    namespace:     'subject',        // always default; not exposed in UI
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

      {/* attribute_type */}
      <div className="space-y-1.5">
        <Label>
          Attribute Type {!isEdit && <span className="text-red-500">*</span>}
        </Label>
        <Select
          value={form.attribute_type}
          disabled={isEdit}
          onValueChange={(v) =>
            setForm({ ...form, attribute_type: v, allowed_values: '', default_value: '' })
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
      <div className="space-y-1.5">
        <Label htmlFor="f-allowed">
          Allowed Values
          {form.attribute_type === 'enum' && !isEdit && (
            <span className="text-red-500"> *</span>
          )}
          {form.attribute_type !== 'enum' && (
            <span className="text-gray-400 font-normal text-xs ml-1">(only for Enum type)</span>
          )}
        </Label>
        <Input
          id="f-allowed"
          placeholder='e.g. read_only, reviewer, submitter'
          value={form.allowed_values}
          disabled={form.attribute_type !== 'enum'}
          onChange={(e) => setForm({ ...form, allowed_values: e.target.value })}
        />
        {form.attribute_type === 'enum' && form.allowed_values.trim() && (
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

  if (!selectedApp) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to manage its attributes.</p>
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ['abac', 'appAttributes', selectedApp.key],
    queryFn: () => abacService.listAppAttrDefs(selectedApp.key),
    enabled: !!selectedApp.key,
  });

  const rawData = data?.data?.data ?? data?.data ?? [];
  const attributes = Array.isArray(rawData) ? rawData : [];

  const createMutation = useMutation({
    mutationFn: (payload) => abacService.createAppAttrDef(selectedApp.key, payload),
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
    mutationFn: ({ id, payload }) => abacService.updateAppAttrDef(selectedApp.key, id, payload),
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
    mutationFn: (id) => abacService.deleteAppAttrDef(selectedApp.key, id),
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
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 font-medium">Display Name</th>
              <th className="px-4 py-3 font-medium">Attribute Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Allowed Values</th>
              <th className="px-4 py-3 font-medium">Default</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td>
              </tr>
            ) : attributes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  <p className="font-medium">No attributes defined yet.</p>
                  <p className="text-xs mt-1">Click <strong>+ New Attribute</strong> to get started.</p>
                </td>
              </tr>
            ) : (
              attributes.map((attr) => {
                const c = attr.constraints ?? {};
                return (
                  <tr key={attr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{attr.displayName}</p>
                      {attr.description && (
                        <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{attr.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{attr.key}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize text-xs">{attr.dataType}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px]">
                      {c.allowedValues?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.allowedValues.slice(0, 4).map((v) => (
                            <span key={v} className="bg-gray-100 rounded px-1.5 py-0.5 font-mono">{v}</span>
                          ))}
                          {c.allowedValues.length > 4 && (
                            <span className="text-gray-400">+{c.allowedValues.length - 4}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {c.defaultValue != null ? (
                        <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5">{String(c.defaultValue)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => openEdit(attr)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteTarget(attr)}
                        >
                          Delete
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Attribute — {selectedApp.name}</DialogTitle>
          </DialogHeader>
          <AttributeForm form={createForm} setForm={setCreateForm} mode="create" />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit Attribute — <span className="font-mono text-sm">{editTarget?.key}</span>
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <>
              <AttributeForm form={editForm} setForm={setEditForm} mode="edit" />
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
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
