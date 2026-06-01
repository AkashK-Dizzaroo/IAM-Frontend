import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { abacService } from '@/features/abac/api/abacService';
import { QK } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, X, ChevronRight, ChevronDown } from 'lucide-react';

const DATA_TYPES = ['string', 'number', 'boolean', 'enum', 'list', 'datetime'];
const NAMESPACES = ['subject', 'resource', 'action', 'environment'];

const NAMESPACE_TAB_LABEL = {
  subject: 'Subject',
  resource: 'Resource',
  action: 'Action',
  environment: 'Environment',
};

const NAMESPACE_BADGE = {
  subject:     'bg-blue-50 text-blue-700 border-blue-200',
  resource:    'bg-purple-50 text-purple-700 border-purple-200',
  action:      'bg-teal-50 text-teal-700 border-teal-200',
  environment: 'bg-gray-100 text-gray-600 border-gray-200',
};

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

/**
 * HubAttributesPage
 *
 * Admin page for managing hub-level attribute definitions, grouped by
 * namespace in tabs. Supports single-attribute create/edit/delete and
 * bulk multi-select delete via a floating action bar at the bottom of
 * each namespace tab. Bulk delete uses Promise.all over individual service
 * calls and resets selection after completion.
 */
export function HubAttributesPage() {
  const { toast } = useToast();
  const [dialogMode, setDialogMode] = useState(null); // null | 'create' | <def object>
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [enumInput, setEnumInput] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [namespaceTab, setNamespaceTab] = useState('subject');
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(EMPTY_FORM);

  // ── Bulk-select state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: QK.hubAttributes,
    queryFn: abacService.listHubAttrDefs,
    staleTime: 0,
  });
  const defs = data?.data?.data ?? data?.data ?? [];

  const { data: globalPoliciesData } = useQuery({
    queryKey: QK.globalPolicies('active'),
    queryFn: () => abacService.listGlobalPolicies({ status: 'active' }),
    staleTime: 0,
  });

  const referencedKeys = useMemo(() => {
    const raw = globalPoliciesData?.data?.data ?? globalPoliciesData?.data ?? [];
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
  }, [globalPoliciesData]);

  const countByNamespace = useMemo(() => {
    const counts = { subject: 0, resource: 0, action: 0, environment: 0 };
    for (const a of defs) {
      if (a.namespace && Object.prototype.hasOwnProperty.call(counts, a.namespace)) counts[a.namespace] += 1;
    }
    return counts;
  }, [defs]);

  const defsByNamespace = useMemo(() => {
    const o = {};
    for (const ns of NAMESPACES) {
      o[ns] = defs.filter((d) => d.namespace === ns);
    }
    return o;
  }, [defs]);

  // Reset selection when the active tab changes so stale ids from another ns are cleared.
  const handleNamespaceTabChange = (ns) => {
    setNamespaceTab(ns);
    setSelectedIds(new Set());
  };

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM);
    setEnumInput('');
  }, []);

  const openCreate = () => {
    resetForm();
    const initial = { ...EMPTY_FORM, namespace: namespaceTab };
    setFormData(initial);
    setOriginalFormData(initial);
    setDialogMode('create');
  };

  const openEdit = (def) => {
    const initial = {
      key: def.key || '',
      displayName: def.displayName || '',
      namespace: def.namespace || 'subject',
      dataType: def.dataType || 'string',
      constraints: def.constraints || {},
      isRequired: def.isRequired || false,
    };
    setFormData(initial);
    setOriginalFormData(initial);
    setEnumInput('');
    setDialogMode(def);
  };

  const closeDialog = () => setDialogMode(null);

  const isFormDirty = JSON.stringify(formData) !== JSON.stringify(originalFormData);

  const handleCancelDialog = () => {
    if (isFormDirty) {
      setShowDiscardDialog(true);
    } else {
      closeDialog();
    }
  };

  const isOpen = dialogMode !== null;
  const isEditing = isOpen && dialogMode !== 'create';
  const editId = isEditing ? (dialogMode.id || dialogMode._id) : null;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => abacService.createHubAttrDef(data),
    onSuccess: () => {
      toast({ title: 'Attribute created' });
      refetch();
      closeDialog();
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => abacService.updateHubAttrDef(id, data),
    onSuccess: () => {
      toast({ title: 'Attribute updated' });
      refetch();
      closeDialog();
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

  // ── Bulk-select helpers ────────────────────────────────────────────────────
  const nsDefs = defsByNamespace[namespaceTab] ?? [];
  const nsIds = nsDefs.map((d) => d.id || d._id);
  const allNsSelected = nsIds.length > 0 && nsIds.every((id) => selectedIds.has(id));
  const someNsSelected = nsIds.some((id) => selectedIds.has(id)) && !allNsSelected;

  const handleSelectAll = () => {
    if (allNsSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        nsIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        nsIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleRowCheckbox = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => abacService.deleteHubAttrDef(id)));
      toast({
        title: 'Attributes deleted',
        description: `${ids.length} attribute${ids.length === 1 ? '' : 's'} deleted.`,
      });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      refetch();
    } catch (err) {
      const msg =
        err?.response?.status === 409
          ? 'Cannot delete — one or more attributes are referenced by active policies or have user values.'
          : err.message;
      toast({ title: 'Bulk delete failed', description: msg, variant: 'destructive' });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Summary list for the confirmation dialog (max 5 shown).
  const bulkDeletePreviewNames = useMemo(() => {
    const ids = Array.from(selectedIds);
    const matched = defs.filter((d) => ids.includes(d.id || d._id));
    return matched.slice(0, 5).map((d) => d.displayName || d.key);
  }, [selectedIds, defs]);

  const bulkDeleteOverflow = selectedIds.size > 5 ? selectedIds.size - 5 : 0;

  // ── Form helpers ───────────────────────────────────────────────────────────
  const handleSave = () => {
    const payload = { ...formData };
    if (dialogMode === 'create') {
      createMutation.mutate(payload);
    } else {
      const { key, ...rest } = payload;
      updateMutation.mutate({ id: editId, data: rest });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

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
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hub Attributes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define the identity attribute schema shared across all applications.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Attribute
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Namespace Tabs */}
      {!isLoading && (
        <Tabs value={namespaceTab} onValueChange={handleNamespaceTabChange} className="w-full">
          <TabsList
            className="grid w-full h-auto p-1 gap-1 sm:grid-cols-2 lg:grid-cols-4 bg-gray-100/80"
            aria-label="Attribute namespace"
          >
            {NAMESPACES.map((ns) => (
              <TabsTrigger
                key={ns}
                value={ns}
                className="flex items-center justify-center gap-1.5 py-2.5 text-sm data-[state=active]:shadow-sm"
              >
                <span className="font-medium">{NAMESPACE_TAB_LABEL[ns]}</span>
                <span
                  className={`min-w-[1.25rem] rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                    namespaceTab === ns
                      ? 'bg-primary/15 text-primary'
                      : 'bg-gray-200/80 text-gray-600'
                  }`}
                >
                  {countByNamespace[ns] ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {NAMESPACES.map((ns) => {
            const currentNsDefs = defsByNamespace[ns] ?? [];
            return (
              <TabsContent key={ns} value={ns} className="mt-0 pt-4 focus-visible:outline-none">
                {currentNsDefs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center border border-gray-200 rounded-lg bg-white">
                    <div className="rounded-full bg-gray-100 p-4 mb-4">
                      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-1">
                      No {NAMESPACE_TAB_LABEL[ns]} attributes yet
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Use <strong>+ New Attribute</strong> to add attributes in the{' '}
                      <span className="font-mono">{ns}</span> namespace.
                    </p>
                    <Button onClick={openCreate}>
                      <Plus className="h-4 w-4" />
                      New Attribute
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Column header row */}
                    <div className="flex items-center py-2 px-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {/* Select-all checkbox */}
                      <div className="w-6 shrink-0 mr-2 flex items-center justify-center">
                        <Checkbox
                          checked={
                            ns === namespaceTab
                              ? allNsSelected
                                ? true
                                : someNsSelected
                                ? 'indeterminate'
                                : false
                              : false
                          }
                          onCheckedChange={handleSelectAll}
                          aria-label={`Select all ${NAMESPACE_TAB_LABEL[ns]} attributes`}
                        />
                      </div>
                      <div className="flex-1">Display Name / Key</div>
                      <div className="w-[90px] shrink-0">Type</div>
                      <div className="w-[220px] shrink-0">Constraints</div>
                      <div className="w-[90px] shrink-0">Flags</div>
                      <div className="w-[80px] shrink-0 text-right">Actions</div>
                    </div>

                    {currentNsDefs.map((def) => {
                      const id = def.id || def._id;
                      const isDeleting = deleteConfirmId === id;
                      const isPolicyReferenced = referencedKeys.has(`${def.namespace}.${def.key}`);
                      const isChecked = selectedIds.has(id);

                      return (
                        <div
                          key={id}
                          className="flex items-center py-2 px-3 hover:bg-gray-50 border-b border-gray-100 transition-colors group"
                        >
                          {/* Row checkbox — hidden until hover or any selection is active */}
                          <div className="w-6 shrink-0 mr-2 flex items-center justify-center">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleRowCheckbox(id)}
                              aria-label={`Select ${def.displayName || def.key}`}
                              className={
                                selectedIds.size > 0
                                  ? 'opacity-100'
                                  : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                              }
                            />
                          </div>

                          {/* Display name + key */}
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-gray-900 text-sm truncate">
                                {def.displayName || def.key}
                              </span>
                              <span className="font-mono text-[11px] text-gray-400 bg-gray-100 rounded px-1 py-0.5 leading-none shrink-0">
                                {def.key}
                              </span>
                            </div>
                            {isPolicyReferenced && (
                              <span className="text-[10px] text-green-700 font-medium">● in active policy</span>
                            )}
                          </div>

                          {/* Type badge */}
                          <div className="w-[90px] shrink-0">
                            <Badge className={`${DATA_TYPE_COLORS[def.dataType] || 'bg-gray-100 text-gray-700'} capitalize text-xs`}>
                              {def.dataType}
                            </Badge>
                          </div>

                          {/* Constraints */}
                          <div className="w-[220px] shrink-0 text-xs text-gray-500 truncate pr-2">
                            {formatConstraints(def)}
                          </div>

                          {/* Required flag */}
                          <div className="w-[90px] shrink-0">
                            {def.isRequired ? (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] w-fit">Required</Badge>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="w-[80px] shrink-0 flex items-center justify-end gap-1">
                            {isDeleting ? (
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {isPolicyReferenced && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                    ⚠ used in policy
                                  </span>
                                )}
                                <span className="text-xs text-red-600">Confirm?</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => deleteMutation.mutate(id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Edit attribute"
                                  onClick={() => openEdit(def)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  title="Delete attribute"
                                  onClick={() => setDeleteConfirmId(id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Floating bulk-action bar — only visible when rows are selected in this tab */}
                    {selectedIds.size > 0 && ns === namespaceTab && (
                      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between rounded-b-lg shadow-sm z-10">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700">
                            {selectedIds.size} selected
                          </span>
                          <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-sm text-gray-500 hover:text-gray-700 underline"
                          >
                            Deselect all
                          </button>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setBulkDeleteOpen(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          Delete {selectedIds.size}{' '}
                          {selectedIds.size === 1 ? 'item' : 'items'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !showDiscardDialog) handleCancelDialog(); }}>
        <DialogContent className="max-w-3xl w-full max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-gray-100 shrink-0">
            <DialogTitle className="text-base font-semibold text-gray-900">
              {dialogMode === 'create' ? 'New Hub Attribute' : 'Edit Hub Attribute'}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {dialogMode === 'create' && (
              <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
                Key and namespace cannot be changed after creation. Choose carefully — they are used in policy conditions.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Key</Label>
                <Input
                  value={formData.key}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      key: e.target.value.toLowerCase().replace(/\s/g, ''),
                    }))
                  }
                  className="font-mono"
                  disabled={isEditing}
                  placeholder="e.g. department"
                />
                {isEditing && (
                  <p className="text-xs text-gray-400">Cannot be changed after creation.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Namespace</Label>
                <Select
                  value={formData.namespace}
                  onValueChange={(val) => setFormData((p) => ({ ...p, namespace: val }))}
                  disabled={isEditing}
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
                {isEditing && (
                  <p className="text-xs text-gray-400">Cannot be changed after creation.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) => setFormData((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. Department"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Data Type</Label>
                <Select
                  value={formData.dataType}
                  onValueChange={(val) =>
                    setFormData((p) => ({ ...p, dataType: val, constraints: {} }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic constraints */}
            <div className="space-y-3">
              <Label>Constraints</Label>

              {formData.dataType === 'string' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Pattern</Label>
                    <Input
                      value={formData.constraints.pattern || ''}
                      onChange={(e) => updateConstraint('pattern', e.target.value)}
                      placeholder="regex pattern, optional"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Max Length</Label>
                    <Input
                      type="number"
                      value={formData.constraints.maxLength || ''}
                      onChange={(e) =>
                        updateConstraint('maxLength', e.target.value ? Number(e.target.value) : '')
                      }
                      placeholder="e.g. 255"
                    />
                  </div>
                </div>
              )}

              {formData.dataType === 'number' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Min</Label>
                    <Input
                      type="number"
                      value={formData.constraints.min ?? ''}
                      onChange={(e) =>
                        updateConstraint('min', e.target.value !== '' ? Number(e.target.value) : undefined)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Max</Label>
                    <Input
                      type="number"
                      value={formData.constraints.max ?? ''}
                      onChange={(e) =>
                        updateConstraint('max', e.target.value !== '' ? Number(e.target.value) : undefined)
                      }
                    />
                  </div>
                </div>
              )}

              {(formData.dataType === 'boolean' || formData.dataType === 'datetime') && (
                <p className="text-sm text-gray-400">
                  {formData.dataType === 'boolean' ? 'Boolean' : 'Datetime'} attributes have no constraints.
                </p>
              )}

              {(formData.dataType === 'enum' || formData.dataType === 'list') && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                    {(formData.constraints.allowedValues || []).map((val) => (
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
                    ))}
                    {(formData.constraints.allowedValues || []).length === 0 && (
                      <span className="text-xs text-gray-400 italic">No values added yet</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={enumInput}
                      onChange={(e) => setEnumInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addEnumValue(); }
                      }}
                      placeholder="Type a value and press Enter or Add…"
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

            <div className="flex items-center justify-between pt-1 pb-1">
              <div>
                <Label>Required</Label>
                <p className="text-xs text-gray-500 mt-0.5">Users must have a value for this attribute</p>
              </div>
              <Switch
                checked={formData.isRequired}
                onCheckedChange={(val) => setFormData((p) => ({ ...p, isRequired: val }))}
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0">
            <Button variant="outline" onClick={handleCancelDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Attribute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk-delete confirmation dialog ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.size}{' '}
              {selectedIds.size === 1 ? 'item' : 'items'}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This action cannot be undone.</p>
          {bulkDeletePreviewNames.length > 0 && (
            <ul className="mt-2 space-y-1">
              {bulkDeletePreviewNames.map((name, i) => (
                <li key={i} className="text-sm text-gray-700 truncate">
                  • {name}
                </li>
              ))}
              {bulkDeleteOverflow > 0 && (
                <li className="text-sm text-gray-400">+{bulkDeleteOverflow} more</li>
              )}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Discard changes confirmation dialog ── */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            You have unsaved changes. They will be lost if you close without saving.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDiscardDialog(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDiscardDialog(false);
                closeDialog();
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
