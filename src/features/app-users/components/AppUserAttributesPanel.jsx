import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appUserService } from '../api/appUserService';
import { appAttributeService } from '@/features/app-attributes/api/appAttributeService';
import { applicationService } from '@/features/applications/api/applicationService';
import { resourceService } from '@/features/resources';
import { QK } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, ChevronRight, Save, Pencil, Check } from 'lucide-react';

// ─── resource tree ────────────────────────────────────────────────────────────

function buildResourceTree(resources) {
  const byId = {};
  for (const r of resources) {
    byId[r.id ?? r._id] = { ...r, children: [] };
  }
  const roots = [];
  for (const r of resources) {
    const id = r.id ?? r._id;
    const parentId = r.parentResource?._id ?? r.parentResource?.id ?? r.parentId ?? null;
    if (parentId && byId[parentId]) {
      byId[parentId].children.push(byId[id]);
    } else {
      roots.push(byId[id]);
    }
  }
  return roots;
}

function ResourceTreeSelect({ resources, selectedResourceId, onSelect }) {
  const tree = useMemo(() => buildResourceTree(resources), [resources]);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggle = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (resources.length === 0) {
    return <p className="text-xs text-gray-400 py-2">No resources available.</p>;
  }

  const renderNode = (node, depth = 0) => {
    const id = node.id ?? node._id;
    const isSelected = selectedResourceId === id;
    const hasChildren = node.children?.length > 0;
    const isExpanded = expandedIds.has(id);

    return (
      <div key={id}>
        <div
          role="option"
          aria-selected={isSelected}
          tabIndex={0}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer select-none transition-colors group
            ${isSelected
              ? 'bg-primary/10 border border-primary/30'
              : 'hover:bg-gray-50 border border-transparent'
            }`}
          style={{ marginLeft: depth * 16 }}
          onClick={() => onSelect(isSelected ? '' : id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(isSelected ? '' : id);
            }
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(id); }}
              className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5 -ml-0.5 rounded"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className={`h-3 w-3 rounded-full shrink-0 border-2 transition-colors ${
            isSelected ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-primary/50'
          }`} />
          <span className={`text-sm truncate ${isSelected ? 'font-medium text-primary' : 'text-gray-800'}`}>
            {node.name}
          </span>
          {node.level && (
            <span className="shrink-0 text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded px-1">
              L{node.level}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-1.5 max-h-48 overflow-y-auto space-y-0.5">
      {tree.map((node) => renderNode(node))}
    </div>
  );
}

// ─── resource + role row ──────────────────────────────────────────────────────

function ResourceRoleRow({ index, row, resources, roleOptions, onChange, onRemove, canRemove }) {
  const [treeOpen, setTreeOpen] = useState(false);
  const rowRef = useRef(null);
  const selectedResource = resources.find((r) => (r.id ?? r._id) === row.resourceId);

  useEffect(() => {
    function handleClick(e) {
      if (!rowRef.current?.contains(e.target)) setTreeOpen(false);
    }
    if (treeOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [treeOpen]);

  return (
    <div ref={rowRef} className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTreeOpen((o) => !o)}
          className={`flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors min-w-0
            ${selectedResource
              ? 'bg-white border-gray-200 text-gray-900'
              : 'bg-white border-dashed border-gray-300 text-gray-400'
            }`}
        >
          {selectedResource ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-gray-900 truncate">{selectedResource.name}</span>
              {selectedResource.level && (
                <span className="shrink-0 text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded px-1">
                  L{selectedResource.level}
                </span>
              )}
            </span>
          ) : (
            <span className="truncate">Select resource…</span>
          )}
          <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${treeOpen ? 'rotate-90' : ''}`} />
        </button>

        <div className="w-44 shrink-0">
          <Select value={row.role || ''} onValueChange={(v) => onChange(index, { role: v })}>
            <SelectTrigger className={`bg-white ${!row.role ? 'text-gray-400' : ''}`}>
              <SelectValue placeholder="Select role… *" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
              {roleOptions.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">No roles defined</div>
              )}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          disabled={!canRemove}
          onClick={() => onRemove(index)}
          className="shrink-0 p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {treeOpen && (
        <ResourceTreeSelect
          resources={resources}
          selectedResourceId={row.resourceId || ''}
          onSelect={(id) => { onChange(index, { resourceId: id }); setTreeOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── attribute input ──────────────────────────────────────────────────────────

function AttrInput({ def, value, onChange }) {
  const constraints = def.constraints ?? {};

  if (def.dataType === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={`edit-attr-${def.id}`}
          checked={value === true || value === 'true'}
          onCheckedChange={onChange}
        />
        <Label htmlFor={`edit-attr-${def.id}`} className="text-sm cursor-pointer">
          {value === true || value === 'true' ? 'Yes' : 'No'}
        </Label>
      </div>
    );
  }

  if (def.dataType === 'enum' && Array.isArray(constraints.allowedValues)) {
    return (
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a value…" />
        </SelectTrigger>
        <SelectContent>
          {constraints.allowedValues.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (def.dataType === 'list' && Array.isArray(constraints.allowedValues)) {
    return (
      <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-gray-200 bg-white min-h-[38px]">
        {constraints.allowedValues.map((v) => {
          const selected = Array.isArray(value) && value.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() =>
                onChange(
                  selected
                    ? (Array.isArray(value) ? value : []).filter((x) => x !== v)
                    : [...(Array.isArray(value) ? value : []), v]
                )
              }
              className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                selected
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Input
      type={
        def.dataType === 'number'
          ? 'number'
          : def.dataType === 'datetime'
            ? 'datetime-local'
            : 'text'
      }
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${def.displayName || def.key}…`}
    />
  );
}

function formatAttrDisplayValue(def, value) {
  if (value === undefined || value === null || value === '') return '—';
  if (def.dataType === 'boolean') return (value === true || value === 'true') ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function normalizeForCompare(def, value) {
  if (value === undefined || value === null) return '';
  if (def.dataType === 'boolean') return (value === true || value === 'true') ? 'true' : 'false';
  if (Array.isArray(value)) return [...value].sort().join('|');
  return String(value);
}

// ─── attribute row (required always shown; optional ones are add/removable) ──

function AttrRow({ def, value, editing, edited, onToggleEdit, onChange, onRemove, canRemove }) {
  return (
    <div
      className={`flex items-center justify-between border rounded-md px-3 py-2 transition-colors ${
        edited ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{def.key}</Badge>
        {editing ? (
          <div className="flex-1 min-w-0">
            <AttrInput def={def} value={value} onChange={onChange} />
          </div>
        ) : (
          <>
            <span className={`text-sm font-mono truncate ${edited ? 'text-amber-700' : 'text-gray-700'}`}>
              {formatAttrDisplayValue(def, value)}
            </span>
            {edited && <span className="text-xs text-amber-600 italic">(edited)</span>}
          </>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {!editing && (
          <span className="text-[10px] text-gray-400 font-mono mr-1">
            {def.dataType}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${editing ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-blue-500'}`}
          onClick={onToggleEdit}
        >
          {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>
        {!def.isRequired && canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const EMPTY_ROW = { resourceId: '', role: '' };

function normalizeResourceRows(value) {
  if (!value) return [];
  let items = value;
  if (typeof value === 'string') {
    try { items = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(items)) items = [items];
  return items
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      return {
        resourceId: String(entry.resource_id ?? entry.resourceId ?? entry.id ?? '').trim(),
        role: String(entry.role ?? '').trim(),
      };
    })
    .filter(Boolean);
}

// ─── edit dialog ──────────────────────────────────────────────────────────────

export function AppUserAttributesPanel({ appKey, user, attrDefs, open, onClose, onAttributeChanged }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [attrValues, setAttrValues] = useState({});
  const [originalAttrValues, setOriginalAttrValues] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [addedOptionalIds, setAddedOptionalIds] = useState([]);
  const [originallyAssignedIds, setOriginallyAssignedIds] = useState([]);
  const [removedDefIds, setRemovedDefIds] = useState([]);
  const [editingDefId, setEditingDefId] = useState(null);
  const [pendingAddId, setPendingAddId] = useState('');
  const [pendingAddValue, setPendingAddValue] = useState('');

  const userId = user?.id;

  const { data: applicationsData } = useQuery({
    queryKey: QK.appsForStudyAccess,
    queryFn: () => applicationService.getApplications(),
  });
  const selectedApplication = (applicationsData?.data?.data ?? applicationsData?.data ?? []).find(
    (a) => a?.key === appKey
  );

  const { data: resourcesData } = useQuery({
    queryKey: QK.studyResources(appKey, selectedApplication?.id),
    queryFn: () =>
      resourceService.getResources({ applicationId: selectedApplication?.id, limit: 1000, isActive: 'true' }),
    enabled: !!selectedApplication?.id,
  });
  const resources = useMemo(() => {
    const raw = resourcesData?.data ?? resourcesData?.resources ?? [];
    return Array.isArray(raw) ? raw.filter((r) => r.isUnassignedNode !== true) : [];
  }, [resourcesData]);

  const { data: userAttrsData, isLoading: loadingAttrs } = useQuery({
    queryKey: QK.appUserAttributes(appKey, userId),
    queryFn: () => appUserService.listAppUserAttrs(appKey, userId),
    enabled: !!appKey && !!userId && open,
    staleTime: 10_000,
  });
  const userAttributes = userAttrsData?.data?.data ?? userAttrsData?.data ?? [];

  // Role def: first attr def whose key ends with _role and has allowedValues
  const roleDef = useMemo(
    () => attrDefs.find(
      (d) =>
        /(_role|^role)$/i.test(d.key) &&
        Array.isArray(d.constraints?.allowedValues) &&
        d.constraints.allowedValues.length > 0
    ),
    [attrDefs]
  );
  const roleOptions = roleDef?.constraints?.allowedValues ?? [];

  // Resource-access attr def
  const resourceAccessDef = useMemo(
    () => attrDefs.find((d) => ['resource_access', 'study_access'].includes(d.key)),
    [attrDefs]
  );

  // Other editable defs: exclude action namespace, resource_access, and the role def
  const otherDefs = useMemo(
    () =>
      attrDefs.filter(
        (d) =>
          d.namespace !== 'action' &&
          !['resource_access', 'study_access'].includes(d.key) &&
          d.id !== roleDef?.id
      ),
    [attrDefs, roleDef]
  );

  // Required attrs are always shown and cannot be removed; optional ones are
  // shown only once already-assigned or explicitly added via "Add Attribute".
  const requiredOtherDefs = useMemo(() => otherDefs.filter((d) => d.isRequired), [otherDefs]);
  const optionalOtherDefs = useMemo(() => otherDefs.filter((d) => !d.isRequired), [otherDefs]);
  const addedOptionalDefs = useMemo(
    () => optionalOtherDefs.filter((d) => addedOptionalIds.includes(d.id)),
    [optionalOtherDefs, addedOptionalIds]
  );
  const availableOptionalDefs = useMemo(
    () => optionalOtherDefs.filter((d) => !addedOptionalIds.includes(d.id)),
    [optionalOtherDefs, addedOptionalIds]
  );
  const visibleOtherDefs = useMemo(
    () => [...requiredOtherDefs, ...addedOptionalDefs],
    [requiredOtherDefs, addedOptionalDefs]
  );
  const pendingAddDef = useMemo(
    () => optionalOtherDefs.find((d) => d.id === pendingAddId) ?? null,
    [optionalOtherDefs, pendingAddId]
  );

  // Seed form from existing user attributes whenever the dialog opens or user changes
  useEffect(() => {
    if (!open || loadingAttrs) return;

    // Seed resource-access rows
    const resourceAttr = userAttributes.find(
      (a) => a.attributeDef?.key === 'resource_access' || a.attributeDef?.key === 'study_access'
    );
    const existingRows = normalizeResourceRows(resourceAttr?.value);
    setRows(existingRows.length > 0 ? existingRows : [{ ...EMPTY_ROW }]);

    // Seed other attribute values, and pre-expand optional attrs that already have a value
    const vals = {};
    const preExpanded = [];
    for (const def of otherDefs) {
      const existing = userAttributes.find(
        (a) => a.attributeDefId === def.id || a.attributeDef?.key === def.key
      );
      if (existing) {
        vals[def.id] = existing.value;
        if (!def.isRequired) preExpanded.push(def.id);
      }
    }
    setAttrValues(vals);
    setOriginalAttrValues(vals);
    setAddedOptionalIds(preExpanded);
    setOriginallyAssignedIds(preExpanded);
    setRemovedDefIds([]);
    setEditingDefId(null);
    setPendingAddId('');
    setPendingAddValue('');
    setIsDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadingAttrs, userAttributes.length]);

  const updateRow = (idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setIsDirty(true);
  };
  const removeRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };
  const addRow = () => {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
    setIsDirty(true);
  };

  const handleConfirmAddOptional = () => {
    if (!pendingAddDef) return;
    setAddedOptionalIds((prev) => [...prev, pendingAddDef.id]);
    setAttrValues((prev) => ({ ...prev, [pendingAddDef.id]: pendingAddValue }));
    setRemovedDefIds((prev) => prev.filter((id) => id !== pendingAddDef.id));
    setPendingAddId('');
    setPendingAddValue('');
    setIsDirty(true);
  };

  const handleRemoveOptional = (defId) => {
    setAddedOptionalIds((prev) => prev.filter((id) => id !== defId));
    setAttrValues((prev) => {
      const next = { ...prev };
      delete next[defId];
      return next;
    });
    if (originallyAssignedIds.includes(defId)) {
      setRemovedDefIds((prev) => (prev.includes(defId) ? prev : [...prev, defId]));
    }
    setEditingDefId((prev) => (prev === defId ? null : prev));
    setIsDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ removedDefIds: toRemove, ...payload }) => {
      const result = await appUserService.assignAppUser(appKey, payload);
      await Promise.all(
        toRemove.map((defId) => appUserService.deleteAppUserAttr(appKey, payload.userId, defId))
      );
      return result;
    },
    onSuccess: () => {
      toast({ title: 'User updated', description: 'Attributes saved successfully.' });
      queryClient.invalidateQueries({ queryKey: QK.appUsers(appKey) });
      queryClient.invalidateQueries({ queryKey: QK.appUserAttributes(appKey, userId) });
      queryClient.invalidateQueries({ queryKey: QK.appTeam(appKey) });
      onAttributeChanged?.();
      setIsDirty(false);
      onClose();
    },
    onError: (err) =>
      toast({
        title: 'Failed to save',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
  });

  const handleSave = () => {
    if (!userId) return;
    const validAssignments = rows.filter((r) => r.resourceId && r.role);

    const seen = new Set();
    for (const r of validAssignments) {
      const key = `${r.resourceId}::${r.role}`;
      if (seen.has(key)) {
        const resourceName = resources.find((res) => (res.id ?? res._id) === r.resourceId)?.name ?? r.resourceId;
        toast({
          title: 'Duplicate assignment',
          description: `"${resourceName}" with role "${r.role}" appears more than once. Remove the duplicate row before saving.`,
          variant: 'destructive',
        });
        return;
      }
      seen.add(key);
    }

    const attributePayload = {};
    for (const def of visibleOtherDefs) {
      const val = attrValues[def.id];
      if (val !== undefined && val !== '' && val !== null) {
        attributePayload[def.key] = val;
      }
    }

    saveMutation.mutate({
      userId,
      assignments: validAssignments,
      attributes: attributePayload,
      removedDefIds,
    });
  };

  const initial = user ? (user.displayName || user.email || '?')[0].toUpperCase() : '';
  const hasValidRow = rows.some((r) => r.resourceId && r.role);
  const hasAttributes = visibleOtherDefs.some((def) => {
    const v = attrValues[def.id];
    return v !== undefined && v !== '' && v !== null;
  });
  const canSave = isDirty && (hasValidRow || hasAttributes || removedDefIds.length > 0) && !saveMutation.isPending;

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o && !showDiscardDialog) handleClose(); }}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-gray-900">
                {user?.displayName || user?.email || '—'}
              </DialogTitle>
              {user?.email && (
                <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs text-gray-500 mt-0.5 ml-12">
            Edit resource access and attributes for this user.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loadingAttrs ? (
            <div className="space-y-3">
              {[...new Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* ── Resource + Role assignments ── */}
              <div className="space-y-2">
                <div>
                  <Label className="text-sm font-medium">Resource Access</Label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Select resources and the role for each. Role is required per row.
                  </p>
                </div>

                <div className="flex items-center gap-2 px-0.5">
                  <span className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Resource</span>
                  <span className="w-44 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Role <span className="text-red-500">*</span>
                  </span>
                  <span className="w-7 shrink-0" />
                </div>

                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <ResourceRoleRow
                      key={idx}
                      index={idx}
                      row={row}
                      resources={resources}
                      roleOptions={roleOptions}
                      onChange={updateRow}
                      onRemove={removeRow}
                      canRemove={rows.length > 1}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium py-1 px-1 rounded transition-colors hover:bg-indigo-50"
                >
                  <Plus className="w-4 h-4" />
                  Add resource
                </button>
              </div>

              {/* ── Additional attributes ── */}
              {otherDefs.length > 0 && (
                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Additional Attributes</Label>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Application-specific attributes for this user.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs text-gray-500 shrink-0">
                      {visibleOtherDefs.length} assigned
                    </Badge>
                  </div>

                  {visibleOtherDefs.length === 0 ? (
                    <p className="text-xs text-gray-400">No attributes assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {visibleOtherDefs.map((def) => (
                        <AttrRow
                          key={def.id}
                          def={def}
                          value={attrValues[def.id]}
                          editing={editingDefId === def.id}
                          edited={
                            normalizeForCompare(def, attrValues[def.id]) !==
                            normalizeForCompare(def, originalAttrValues[def.id])
                          }
                          onToggleEdit={() =>
                            setEditingDefId((prev) => (prev === def.id ? null : def.id))
                          }
                          onChange={(val) => {
                            setAttrValues((prev) => ({ ...prev, [def.id]: val }));
                            setIsDirty(true);
                          }}
                          onRemove={() => handleRemoveOptional(def.id)}
                          canRemove={!def.isRequired}
                        />
                      ))}
                    </div>
                  )}

                  {availableOptionalDefs.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                      <Label className="text-xs font-medium text-gray-700">Add Attribute</Label>
                      <Select
                        value={pendingAddId}
                        onValueChange={(val) => {
                          const def = availableOptionalDefs.find((d) => d.id === val);
                          setPendingAddId(val);
                          setPendingAddValue(def?.dataType === 'boolean' ? false : '');
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select attribute definition…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOptionalDefs.map((def) => (
                            <SelectItem key={def.id} value={def.id}>
                              {def.displayName ? `${def.displayName} (${def.key})` : def.key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {pendingAddDef && (
                        <div className="flex gap-2 items-start">
                          <div className="flex-1">
                            <AttrInput
                              def={pendingAddDef}
                              value={pendingAddValue}
                              onChange={setPendingAddValue}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={handleConfirmAddOptional}
                          >
                            Add
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saveMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              : <Save className="w-4 h-4 mr-1.5" />
            }
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Discard changes?</DialogTitle>
          <DialogDescription>
            You have unsaved changes. They will be lost if you close without saving.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowDiscardDialog(false)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setShowDiscardDialog(false);
              onClose();
            }}
          >
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
