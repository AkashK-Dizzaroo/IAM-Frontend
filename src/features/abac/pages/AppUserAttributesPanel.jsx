import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { abacService } from '@/features/abac/api/abacService';
import { resourceService } from '@/features/resources';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

// ─── namespace styles ──────────────────────────────────────────────────────────

const NAMESPACE_STYLES = {
  subject:     { dot: 'bg-blue-500',   label: 'Subject' },
  resource:    { dot: 'bg-purple-500', label: 'Resource' },
  action:      { dot: 'bg-teal-500',   label: 'Action' },
  environment: { dot: 'bg-gray-400',   label: 'Environment' },
};

const STUDY_ROLE_OPTIONS = [
  'admin', 'study_manager', 'study_monitor',
  'principal_investigator', 'tmf_lead', 'qa_reviewer',
];

// ─── study access helpers ──────────────────────────────────────────────────────

function normalizeStudyAccessValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeStudyAccessValue([value]);
  }
  if (typeof value === 'string') {
    try { return normalizeStudyAccessValue(JSON.parse(value)); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const study_id = String(entry.study_id ?? entry.studyId ?? entry.study ?? entry.id ?? '').trim();
      const role = String(entry.role ?? '').trim();
      return { study_id, role };
    })
    .filter(Boolean);
}

function StudyAccessInput({ value, onChange, studyOptions = [] }) {
  const rows = normalizeStudyAccessValue(value);
  const mergedOptions = [
    ...studyOptions,
    ...rows.map((r) => ({ value: r.study_id, label: r.study_id })).filter((x) => x.value),
  ]
    .filter((x) => x && String(x.value || '').trim())
    .reduce((acc, cur) => {
      const cleanValue = String(cur.value).trim();
      if (!cleanValue || acc.some((x) => x.value === cleanValue)) return acc;
      acc.push({ value: cleanValue, label: cur.label || cleanValue });
      return acc;
    }, []);

  const updateRow = (idx, patch) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));
  const addRow = () => onChange([...rows, { study_id: '', role: '' }]);

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
      {rows.length === 0 && <p className="text-xs text-gray-500">No study role assigned yet.</p>}
      {rows.map((row, idx) => (
        <div key={`${row.study_id}-${idx}`} className="grid grid-cols-12 gap-2">
          <div className="col-span-7">
            <Select value={row.study_id || undefined} onValueChange={(v) => updateRow(idx, { study_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select study…" /></SelectTrigger>
              <SelectContent>
                {mergedOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-4">
            <Select value={row.role || undefined} onValueChange={(v) => updateRow(idx, { role: v })}>
              <SelectTrigger><SelectValue placeholder="Role…" /></SelectTrigger>
              <SelectContent>
                {STUDY_ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1 flex items-center justify-end">
            <Button type="button" variant="ghost" size="sm"
              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => removeRow(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addRow}>
        Add study role
      </Button>
    </div>
  );
}

// ─── resource access input ────────────────────────────────────────────────────

function normalizeResourceAccessValue(value) {
  if (typeof value === 'string') {
    try { return normalizeResourceAccessValue(JSON.parse(value)); } catch { return []; }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return [value];
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      return {
        resource_id:    String(entry.resource_id ?? entry.resourceId ?? entry.id ?? '').trim(),
        role:           String(entry.role ?? '').trim(),
        resource_level: entry.resource_level ?? entry.resourceLevel ?? null,
      };
    })
    .filter(Boolean);
}

function ResourceAccessDisplay({ value, resourceMap = {} }) {
  const rows = normalizeResourceAccessValue(value);
  if (rows.length === 0) {
    return <p className="text-xs text-gray-500 px-1">No resource access assigned.</p>;
  }

  // Split into L2 rows and L3 rows
  const l2Rows = rows.filter((r) => {
    const meta = resourceMap[r.resource_id];
    return !meta || meta.level !== 3;
  });
  const l3Rows = rows.filter((r) => {
    const meta = resourceMap[r.resource_id];
    return meta?.level === 3;
  });

  // Group L3 rows by their L2 parent id
  const l3ByParent = {};
  for (const row of l3Rows) {
    const meta = resourceMap[row.resource_id];
    const parentId = meta?.parentId ?? '__unknown__';
    if (!l3ByParent[parentId]) l3ByParent[parentId] = [];
    l3ByParent[parentId].push(row);
  }

  // Build display list: L2 rows first, each followed by their L3 children
  // Also handle L3 whose parent is not in l2Rows (parent has no direct access entry)
  const renderedParents = new Set();

  const renderRow = (row, isChild = false) => {
    const meta = resourceMap[row.resource_id];
    const name = meta?.name ?? row.resource_id;
    return (
      <div
        key={`${row.resource_id}-${row.role}`}
        className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 ${
          isChild
            ? 'bg-white border border-gray-200 ml-5 border-l-2 border-l-blue-200'
            : 'bg-gray-50 border border-gray-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isChild && (
            <span className="text-gray-300 text-xs shrink-0">└</span>
          )}
          <div className="min-w-0">
            <span className="text-sm text-gray-900 font-medium truncate block">{name}</span>
            {isChild && meta?.parentName && (
              <span className="text-xs text-gray-400 truncate block">in {meta.parentName}</span>
            )}
          </div>
        </div>
        {row.role && (
          <span className="shrink-0 text-xs font-mono text-gray-600 bg-white border border-gray-200 rounded px-2 py-0.5 whitespace-nowrap">
            {row.role}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      {l2Rows.map((row) => {
        const id = row.resource_id;
        renderedParents.add(id);
        const children = l3ByParent[id] ?? [];
        return (
          <div key={id} className="space-y-1">
            {renderRow(row, false)}
            {children.map((child) => renderRow(child, true))}
          </div>
        );
      })}
      {/* L3 rows whose L2 parent has no direct access entry */}
      {Object.entries(l3ByParent)
        .filter(([parentId]) => !renderedParents.has(parentId))
        .map(([parentId, children]) => {
          const parentMeta = resourceMap[parentId];
          const parentName = parentMeta?.name ?? parentId;
          return (
            <div key={parentId} className="space-y-1">
              {/* Ghost L2 header when the parent itself has no access entry */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 border border-dashed border-gray-200">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{parentName}</span>
                <span className="text-[10px] text-gray-400 italic">(no direct access)</span>
              </div>
              {children.map((child) => renderRow(child, true))}
            </div>
          );
        })}
    </div>
  );
}

// ─── value input ───────────────────────────────────────────────────────────────

function ValueInput({ def, value, onChange, studyOptions, resourceMap }) {
  if (!def) return <Input placeholder="Select an attribute first…" value={value} disabled />;

  const { dataType, isMultiValued, constraints } = def;
  const allowedValues = constraints?.allowedValues ?? [];
  const key = String(def.key || '').trim().toLowerCase();

  if (key === 'study_access') {
    return <StudyAccessInput value={value} onChange={onChange} studyOptions={studyOptions} />;
  }

  if (key === 'resource_access') {
    return <ResourceAccessDisplay value={value} resourceMap={resourceMap} />;
  }

  if (isMultiValued && allowedValues.length > 0) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5 rounded-md border border-gray-200 p-3 bg-white">
        {allowedValues.map((v) => (
          <div key={v} className="flex items-center gap-2">
            <Checkbox
              id={`mv-${def.id}-${v}`}
              checked={selected.includes(v)}
              onCheckedChange={() => {
                const next = selected.includes(v)
                  ? selected.filter((x) => x !== v)
                  : [...selected, v];
                onChange(next);
              }}
            />
            <Label htmlFor={`mv-${def.id}-${v}`} className="font-mono text-sm cursor-pointer">{v}</Label>
          </div>
        ))}
        {selected.length > 0 && <p className="text-xs text-gray-400 pt-1">{selected.length} selected</p>}
      </div>
    );
  }

  if (isMultiValued) {
    const display = Array.isArray(value) ? value.join(', ') : value;
    return (
      <Input
        placeholder="e.g. val1, val2, val3"
        value={display}
        onChange={(e) => onChange(e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
      />
    );
  }

  if (dataType === 'enum' && allowedValues.length > 0) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select a value…" /></SelectTrigger>
        <SelectContent>
          {allowedValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (dataType === 'boolean') {
    return (
      <Select value={String(value)} onValueChange={(v) => onChange(v === 'true')}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (dataType === 'number') {
    const min = constraints?.min;
    const max = constraints?.max;
    return (
      <Input
        type="number"
        placeholder={min != null && max != null ? `${min} – ${max}` : 'Enter number…'}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }

  return (
    <Input
      placeholder="Enter value…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ─── attribute card ────────────────────────────────────────────────────────────

function AttributeCard({ def, existingAttr, isReferenced, onSave, onRemove, isSaving, isRemoving, studyOptions, resourceMap }) {
  const emptyValue = def.isMultiValued ? [] : '';
  const currentValue = existingAttr?.value ?? emptyValue;
  const [localValue, setLocalValue] = useState(currentValue);
  const [isDirty, setIsDirty] = useState(false);
  const key = String(def?.key || '').trim().toLowerCase();

  useEffect(() => {
    setLocalValue(currentValue);
    setIsDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAttr?.attributeDefId, existingAttr?.id, JSON.stringify(currentValue)]);

  const handleChange = (v) => { setLocalValue(v); setIsDirty(true); };

  const handleSave = () => {
    if (key === 'study_access') {
      const normalized = normalizeStudyAccessValue(localValue).filter(
        (r) => String(r.study_id || '').trim() && String(r.role || '').trim()
      );
      onSave(def.id, normalized);
    } else if (key === 'resource_access') {
      const normalized = normalizeResourceAccessValue(localValue).filter(
        (r) => String(r.resource_id || '').trim()
      );
      onSave(def.id, normalized);
    } else {
      onSave(def.id, localValue);
    }
    setIsDirty(false);
  };

  const isAssigned = !!existingAttr;
  const isEmpty =
    key === 'study_access'
      ? normalizeStudyAccessValue(localValue).filter(
          (r) => String(r.study_id || '').trim() && String(r.role || '').trim()
        ).length === 0
      : key === 'resource_access'
      ? normalizeResourceAccessValue(localValue).filter(
          (r) => String(r.resource_id || '').trim()
        ).length === 0
      : Array.isArray(localValue)
      ? localValue.length === 0
      : localValue === '' || localValue === null || localValue === undefined;

  return (
    <div className={`p-3.5 rounded-lg border transition-colors ${
      isAssigned ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-dashed border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{def.displayName || def.key}</span>
            {isReferenced && (
              <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                ● policy
              </span>
            )}
            {def.isRequired && (
              <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                required
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-gray-400 mt-0.5">{def.key}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-xs capitalize">{def.dataType}</Badge>
          {def.isMultiValued && (
            <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">multi</Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <ValueInput def={def} value={localValue} onChange={handleChange} studyOptions={studyOptions} resourceMap={resourceMap} />
        <div className="flex gap-1.5 justify-end">
          {isAssigned && (
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
              onClick={() => onRemove(existingAttr.attributeDefId ?? def.id)}
              disabled={isRemoving}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs px-2"
            onClick={handleSave}
            disabled={isEmpty || (!isDirty && isAssigned) || isSaving}
            variant={isDirty ? 'default' : 'outline'}
          >
            <Save className="h-3 w-3 mr-1" />
            {isSaving ? 'Saving…' : isAssigned ? (isDirty ? 'Update' : 'Saved') : 'Assign'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── namespace section ─────────────────────────────────────────────────────────

function NamespaceSection({ namespace, defs, userAttributes, referencedKeys, onSave, onRemove, savingIds, removingIds, studyOptions, resourceMap }) {
  const [collapsed, setCollapsed] = useState(false);
  const style = NAMESPACE_STYLES[namespace] ?? NAMESPACE_STYLES.environment;
  const assignedCount = defs.filter((d) =>
    userAttributes.some((a) => (a.attributeDefId ?? a.id) === d.id)
  ).length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
          <span className="font-medium text-gray-800 text-sm capitalize">{style.label}</span>
          <span className="text-xs text-gray-400">{defs.length} attribute{defs.length !== 1 ? 's' : ''}</span>
          {assignedCount > 0 && (
            <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              {assignedCount} assigned
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronUp className="h-4 w-4 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {defs.map((def) => {
            const existingAttr = userAttributes.find(
              (a) => (a.attributeDefId ?? a.id) === def.id || a.attributeDef?.key === def.key
            );
            const isWide = ['resource_access', 'study_access'].includes(
              String(def.key || '').trim().toLowerCase()
            );
            return (
              <div key={def.id} className={isWide ? 'sm:col-span-2' : ''}>
                <AttributeCard
                  def={def}
                  existingAttr={existingAttr}
                  isReferenced={referencedKeys.has(def.key)}
                  onSave={onSave}
                  onRemove={onRemove}
                  isSaving={savingIds.has(def.id)}
                  isRemoving={removingIds.has(existingAttr?.attributeDefId ?? def.id)}
                  studyOptions={studyOptions}
                  resourceMap={resourceMap}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── dialog panel ─────────────────────────────────────────────────────────────

export function AppUserAttributesPanel({ appKey, user, attrDefs, open, onClose, onAttributeChanged }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savingIds, setSavingIds] = useState(new Set());
  const [removingIds, setRemovingIds] = useState(new Set());

  const userId = user?.id;

  const { data: userAttrsData, isLoading: loadingAttrs } = useQuery({
    queryKey: ['abac', 'appUserAttributes', appKey, userId],
    queryFn: () => abacService.listAppUserAttrs(appKey, userId),
    enabled: !!appKey && !!userId && open,
    staleTime: 10_000,
  });
  const userAttributes = userAttrsData?.data?.data ?? userAttrsData?.data ?? [];

  const { data: activePoliciesData } = useQuery({
    queryKey: ['abac', 'appPolicies', appKey, 'active'],
    queryFn: () => abacService.listAppPolicies(appKey, { status: 'active' }),
    enabled: !!appKey,
    staleTime: 60_000,
  });
  const referencedKeys = useMemo(() => {
    const policies = activePoliciesData?.data?.data ?? activePoliciesData?.data ?? [];
    const keys = new Set();
    for (const policy of policies) {
      for (const cond of policy.conditions?.conditions ?? []) {
        if (cond.key) keys.add(cond.key);
      }
    }
    return keys;
  }, [activePoliciesData]);

  const { data: applicationsData } = useQuery({
    queryKey: ['abac', 'applications', 'forStudyAccess'],
    queryFn: () => abacService.getApplications(),
    staleTime: 60_000,
  });
  const selectedApplication = (applicationsData?.data?.data ?? applicationsData?.data ?? []).find(
    (a) => a?.key === appKey || a?.appCode === appKey
  );

  const { data: resourcesData } = useQuery({
    queryKey: ['abac', 'studyResources', appKey, selectedApplication?.id],
    queryFn: () =>
      resourceService.getResources({ applicationId: selectedApplication?.id, limit: 1000, isActive: 'true' }),
    enabled: !!appKey,
    staleTime: 60_000,
  });

  const { studyOptions, resourceMap } = useMemo(() => {
    const rawRows = resourcesData?.data ?? resourcesData?.resources ?? [];
    const rows = Array.isArray(rawRows) ? rawRows : [];

    // id → { name, level, parentId, parentName } for resource_access display
    const map = {};
    for (const r of rows) {
      const id = String(r.id ?? r._id ?? '').trim();
      if (!id) continue;
      map[id] = {
        name:       r.name ?? id,
        level:      r.level ?? null,
        parentId:   String(r.parentResource?._id ?? r.parentResource?.id ?? r.parentId ?? '').trim() || null,
        parentName: r.parentResource?.name ?? null,
      };
    }

    // study options for study_access selects (keyed by externalId)
    const options = [];
    const seen = new Set();
    for (const r of rows) {
      const studyId = String(r.resourceExternalId ?? r.externalId ?? r.studyId ?? '').trim();
      if (!studyId || seen.has(studyId)) continue;
      seen.add(studyId);
      options.push({ value: studyId, label: r.name ? `${r.name} (${studyId})` : studyId });
    }
    for (const attr of userAttributes) {
      for (const row of normalizeStudyAccessValue(attr?.value)) {
        if (seen.has(row.study_id)) continue;
        seen.add(row.study_id);
        options.push({ value: row.study_id, label: row.study_id });
      }
    }
    return {
      studyOptions: options.sort((a, b) => a.label.localeCompare(b.label)),
      resourceMap: map,
    };
  }, [resourcesData, userAttributes]);

  const invalidateUserAttrs = () => {
    queryClient.invalidateQueries({ queryKey: ['abac', 'appUserAttributes', appKey, userId] });
  };

  const assignMutation = useMutation({
    mutationFn: ({ defId, value }) =>
      abacService.setAppUserAttr(appKey, userId, { attributeDefId: defId, value }),
    onMutate: ({ defId }) => setSavingIds((s) => new Set([...s, defId])),
    onSuccess: () => {
      toast({ title: 'Attribute saved' });
      invalidateUserAttrs();
      onAttributeChanged?.();
    },
    onError: (err) =>
      toast({ title: 'Failed to save', description: err?.response?.data?.error ?? err.message, variant: 'destructive' }),
    onSettled: (_, __, { defId }) =>
      setSavingIds((s) => { const n = new Set(s); n.delete(defId); return n; }),
  });

  const removeMutation = useMutation({
    mutationFn: (attributeDefId) =>
      abacService.deleteAppUserAttr(appKey, userId, attributeDefId),
    onMutate: (id) => setRemovingIds((s) => new Set([...s, id])),
    onSuccess: () => {
      toast({ title: 'Attribute removed' });
      invalidateUserAttrs();
      onAttributeChanged?.();
    },
    onError: (err) =>
      toast({ title: 'Failed to remove', description: err?.response?.data?.error ?? err.message, variant: 'destructive' }),
    onSettled: (_, __, id) =>
      setRemovingIds((s) => { const n = new Set(s); n.delete(id); return n; }),
  });

  const defsByNamespace = useMemo(() => {
    const groups = {};
    for (const def of attrDefs) {
      const ns = def.namespace || 'subject';
      if (!groups[ns]) groups[ns] = [];
      groups[ns].push(def);
    }
    return groups;
  }, [attrDefs]);

  const namespaceOrder = ['subject', 'resource', 'action', 'environment'];
  const orderedNamespaces = [
    ...namespaceOrder.filter((ns) => defsByNamespace[ns]),
    ...Object.keys(defsByNamespace).filter((ns) => !namespaceOrder.includes(ns)),
  ];

  const assignedCount = userAttributes.length;
  const totalDefs = attrDefs.length;
  const initial = user ? (user.displayName || user.email || '?')[0].toUpperCase() : '';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-full max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-gray-900">
                {user?.displayName || user?.username || '—'}
              </DialogTitle>
              {user?.email && (
                <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
              )}
            </div>
            {!loadingAttrs && (
              <span className="shrink-0 inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                {assignedCount}/{totalDefs} assigned
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loadingAttrs && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loadingAttrs && totalDefs === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="font-medium text-gray-600">No attribute definitions</p>
              <p className="text-sm mt-1">Define app attributes first in App Attributes.</p>
            </div>
          )}

          {!loadingAttrs && totalDefs > 0 && orderedNamespaces.map((ns) => (
            <NamespaceSection
              key={ns}
              namespace={ns}
              defs={defsByNamespace[ns]}
              userAttributes={userAttributes}
              referencedKeys={referencedKeys}
              onSave={(defId, value) => assignMutation.mutate({ defId, value })}
              onRemove={(attributeDefId) => removeMutation.mutate(attributeDefId)}
              savingIds={savingIds}
              removingIds={removingIds}
              studyOptions={studyOptions}
              resourceMap={resourceMap}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
