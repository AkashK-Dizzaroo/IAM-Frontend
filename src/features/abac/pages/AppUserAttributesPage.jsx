import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useToast } from '@/hooks/use-toast';
import { abacService } from '../api/abacService';
import { useAbacScope } from '../contexts/AbacScopeContext';
import { userService } from '@/features/users/api/userService';
import { resourceService } from '@/features/resources';
import { Save, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react';

function normalizeList(res) {
  return res?.data?.data ?? res?.data ?? [];
}

function getUserId(u) {
  return String(u?.id ?? u?._id ?? u?.userId ?? '').trim();
}

const NAMESPACE_STYLES = {
  subject:     { badge: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-500',   label: 'Subject' },
  resource:    { badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', label: 'Resource' },
  action:      { badge: 'bg-teal-50 text-teal-700 border-teal-200',   dot: 'bg-teal-500',   label: 'Action' },
  environment: { badge: 'bg-gray-100 text-gray-600 border-gray-200',  dot: 'bg-gray-400',   label: 'Environment' },
};

const STUDY_ROLE_OPTIONS = [
  'admin',
  'study_manager',
  'study_monitor',
  'principal_investigator',
  'tmf_lead',
  'qa_reviewer',
];

function normalizeStudyAccessValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeStudyAccessValue([value]);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeStudyAccessValue(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const study_id = String(
        entry.study_id ?? entry.studyId ?? entry.study ?? entry.id ?? ''
      ).trim();
      const role = String(entry.role ?? '').trim();
      return { study_id, role };
    })
    .filter(Boolean);
}

function StudyAccessInput({ value, onChange, studyOptions = [] }) {
  const rows = normalizeStudyAccessValue(value);
  const mergedOptions = [
    ...studyOptions,
    ...rows
      .map((r) => ({ value: r.study_id, label: r.study_id }))
      .filter((x) => x.value),
  ]
    .filter((x) => x && String(x.value || '').trim())
    .reduce((acc, cur) => {
    const cleanValue = String(cur.value).trim();
    if (!cleanValue) return acc;
    if (!acc.some((x) => x.value === cleanValue)) {
      acc.push({ value: cleanValue, label: cur.label || cleanValue });
    }
    return acc;
  }, []);

  const updateRow = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));
  const addRow = () => onChange([...rows, { study_id: '', role: '' }]);

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
      {rows.length === 0 && (
        <p className="text-xs text-gray-500">No study role assigned yet.</p>
      )}
      {rows.map((row, idx) => (
        <div key={`${row.study_id}-${idx}`} className="grid grid-cols-12 gap-2">
          <div className="col-span-7">
            <Select
              value={row.study_id || undefined}
              onValueChange={(v) => updateRow(idx, { study_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select study…" />
              </SelectTrigger>
              <SelectContent>
                {mergedOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-4">
            <Select
              value={row.role || undefined}
              onValueChange={(v) => updateRow(idx, { role: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Role…" />
              </SelectTrigger>
              <SelectContent>
                {STUDY_ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1 flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => removeRow(idx)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addRow}>
        Add study role
      </Button>
      <p className="text-[10px] text-gray-500">
        Stored format: [{'{'}"study_id":"...","role":"..."{'}'}]
      </p>
    </div>
  );
}

// Renders the appropriate value input for an attribute definition
function ValueInput({ def, value, onChange, studyOptions }) {
  if (!def) return <Input placeholder="Select an attribute first…" value={value} disabled />;

  const { dataType, isMultiValued, constraints } = def;
  const allowedValues = constraints?.allowedValues ?? [];
  const key = String(def.key || '').trim().toLowerCase();

  if (key === 'study_access') {
    return <StudyAccessInput value={value} onChange={onChange} studyOptions={studyOptions} />;
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
        {selected.length > 0 && (
          <p className="text-xs text-gray-400 pt-1">{selected.length} selected</p>
        )}
      </div>
    );
  }

  if (isMultiValued) {
    const display = Array.isArray(value) ? value.join(', ') : value;
    return (
      <>
        <Input
          placeholder="e.g. val1, val2, val3"
          value={display}
          onChange={(e) => onChange(e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
        />
        <p className="text-[10px] text-gray-500">Comma-separated values.</p>
      </>
    );
  }

  if (dataType === 'enum' && allowedValues.length > 0) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a value…" />
        </SelectTrigger>
        <SelectContent>
          {allowedValues.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (dataType === 'boolean') {
    return (
      <Select value={String(value)} onValueChange={(v) => onChange(v === 'true')}>
        <SelectTrigger>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
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
      <>
        <Input
          type="number"
          placeholder={min != null && max != null ? `${min} – ${max}` : 'Enter number…'}
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {(min != null || max != null) && (
          <p className="text-[10px] text-gray-500">Range: {min ?? '—'} to {max ?? '—'}</p>
        )}
      </>
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

// A single attribute row in the edit grid
function AttributeRow({ def, existingAttr, isReferenced, onSave, onRemove, isSaving, isRemoving, studyOptions }) {
  const emptyValue = def.isMultiValued ? [] : '';
  const currentValue = existingAttr?.value ?? emptyValue;
  const [localValue, setLocalValue] = useState(currentValue);
  const [isDirty, setIsDirty] = useState(false);
  const key = String(def?.key || '').trim().toLowerCase();

  useEffect(() => {
    // Keep editor in sync when user attributes arrive/refetch from API.
    setLocalValue(currentValue);
    setIsDirty(false);
  }, [existingAttr?.attributeDefId, existingAttr?.id, JSON.stringify(currentValue)]);

  const handleChange = (v) => {
    setLocalValue(v);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (key === 'study_access') {
      const normalized = normalizeStudyAccessValue(localValue).filter(
        (r) => String(r.study_id || '').trim() && String(r.role || '').trim()
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
      : Array.isArray(localValue)
      ? localValue.length === 0
      : localValue === '' || localValue === null || localValue === undefined;

  return (
    <div className={`p-4 rounded-lg border transition-colors ${
      isAssigned
        ? 'bg-white border-gray-200 shadow-sm'
        : 'bg-gray-50 border-dashed border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 truncate">
              {def.displayName || def.key}
            </span>
            {isReferenced && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                ● policy
              </span>
            )}
            {def.isRequired && (
              <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">required</span>
            )}
          </div>
          <p className="text-xs font-mono text-gray-400 mt-0.5">{def.key}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-xs capitalize shrink-0">{def.dataType}</Badge>
          {def.isMultiValued && (
            <Badge variant="outline" className="text-xs text-purple-700 border-purple-300 shrink-0">multi</Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <ValueInput def={def} value={localValue} onChange={handleChange} studyOptions={studyOptions} />

        <div className="flex gap-2 justify-end">
          {isAssigned && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => onRemove(existingAttr.attributeDefId ?? def.id)}
              disabled={isRemoving}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs"
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

// Namespace section with collapsible group
function NamespaceSection({ namespace, defs, userAttributes, referencedKeys, onSave, onRemove, savingIds, removingIds, studyOptions }) {
  const [collapsed, setCollapsed] = useState(false);
  const style = NAMESPACE_STYLES[namespace] ?? NAMESPACE_STYLES.environment;
  const assignedCount = defs.filter(d => userAttributes.some(a => (a.attributeDefId ?? a.id) === d.id)).length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
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
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {defs.map((def) => {
            const existingAttr = userAttributes.find(
              (a) => (a.attributeDefId ?? a.id) === def.id || a.attributeDef?.key === def.key
            );
            return (
              <AttributeRow
                key={def.id}
                def={def}
                existingAttr={existingAttr}
                isReferenced={referencedKeys.has(def.key)}
                onSave={onSave}
                onRemove={onRemove}
                isSaving={savingIds.has(def.id)}
                isRemoving={removingIds.has(existingAttr?.attributeDefId ?? def.id)}
                studyOptions={studyOptions}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppUserAttributesPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(true);
  const [savingIds, setSavingIds] = useState(new Set());
  const [removingIds, setRemovingIds] = useState(new Set());

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['abac', 'users', 'appUserAttrsPicker'],
    queryFn: () => abacService.listUsers({ limit: 200 }),
  });
  const allUsers = normalizeList(usersData);

  const { data: appTeamData } = useQuery({
    queryKey: ['appTeam', selectedAppKey],
    queryFn: () => userService.getAppTeamUsers(selectedAppKey),
    enabled: !!selectedAppKey && showOnlyAssigned,
  });
  const assignedUserIds = useMemo(() => {
    const entries = appTeamData?.data ?? [];
    return new Set(entries.map(e => String(e.user?.id ?? e.user?._id)).filter(Boolean));
  }, [appTeamData]);

  const users = showOnlyAssigned && assignedUserIds.size > 0
    ? allUsers.filter((u) => assignedUserIds.has(getUserId(u)))
    : allUsers;

  const selectedUser = users.find((u) => getUserId(u) === selectedUserId);

  const { data: attrDefsData } = useQuery({
    queryKey: ['abac', 'appAttributes', selectedAppKey],
    queryFn: () => abacService.listAppAttrDefs(selectedAppKey),
    enabled: !!selectedAppKey,
  });
  const attributeDefs = normalizeList(attrDefsData);

  const { data: activePoliciesData } = useQuery({
    queryKey: ['abac', 'appPolicies', selectedAppKey, 'active'],
    queryFn: () => abacService.listAppPolicies(selectedAppKey, { status: 'active' }),
    enabled: !!selectedAppKey,
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

  const { data: userAttrsData, isLoading: loadingUserAttrs } = useQuery({
    queryKey: ['abac', 'appUserAttributes', selectedAppKey, selectedUserId],
    queryFn: () => abacService.listAppUserAttrs(selectedAppKey, selectedUserId),
    enabled: !!selectedAppKey && !!selectedUserId,
  });
  const userAttributes = normalizeList(userAttrsData);

  const { data: applicationsData } = useQuery({
    queryKey: ['abac', 'applications', 'forStudyAccess'],
    queryFn: () => abacService.getApplications(),
    staleTime: 60_000,
  });
  const applications = normalizeList(applicationsData);
  const selectedApplication = applications.find(
    (a) =>
      a?.key === selectedAppKey ||
      a?.appCode === selectedAppKey ||
      String(a?.id || a?._id || '') === String(selectedAppKey)
  );

  const { data: resourcesData } = useQuery({
    queryKey: ['abac', 'studyResources', selectedAppKey, selectedApplication?.id],
    queryFn: () =>
      resourceService.getResources({
        applicationId: selectedApplication?.id,
        limit: 1000,
        isActive: 'true',
      }),
    enabled: !!selectedAppKey,
    staleTime: 60_000,
  });

  const studyOptions = useMemo(() => {
    const options = [];
    const seen = new Set();

    const rows = resourcesData?.data ?? resourcesData?.resources ?? [];
    for (const r of Array.isArray(rows) ? rows : []) {
      const studyId = String(
        r.resourceExternalId ?? r.externalId ?? r.studyId ?? ''
      ).trim();
      if (!studyId || seen.has(studyId)) continue;
      seen.add(studyId);
      options.push({
        value: studyId,
        label: r.name ? `${r.name} (${studyId})` : studyId,
      });
    }

    for (const attr of userAttributes) {
      for (const row of normalizeStudyAccessValue(attr?.value)) {
        if (seen.has(row.study_id)) continue;
        seen.add(row.study_id);
        options.push({ value: row.study_id, label: row.study_id });
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [resourcesData, userAttributes]);

  const invalidateUserAttrs = () =>
    queryClient.invalidateQueries({
      queryKey: ['abac', 'appUserAttributes', selectedAppKey, selectedUserId],
    });

  const assignMutation = useMutation({
    mutationFn: ({ defId, value }) =>
      abacService.setAppUserAttr(selectedAppKey, selectedUserId, { attributeDefId: defId, value }),
    onMutate: ({ defId }) => setSavingIds((s) => new Set([...s, defId])),
    onSuccess: () => {
      toast({ title: 'Attribute saved' });
      invalidateUserAttrs();
    },
    onError: (err) =>
      toast({
        title: 'Failed to save',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
    onSettled: (_, __, { defId }) =>
      setSavingIds((s) => { const n = new Set(s); n.delete(defId); return n; }),
  });

  const removeMutation = useMutation({
    mutationFn: (attributeDefId) =>
      abacService.deleteAppUserAttr(selectedAppKey, selectedUserId, attributeDefId),
    onMutate: (id) => setRemovingIds((s) => new Set([...s, id])),
    onSuccess: () => {
      toast({ title: 'Attribute removed' });
      invalidateUserAttrs();
    },
    onError: (err) =>
      toast({
        title: 'Failed to remove',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
    onSettled: (_, __, id) =>
      setRemovingIds((s) => { const n = new Set(s); n.delete(id); return n; }),
  });

  // Group attribute defs by namespace
  const defsByNamespace = useMemo(() => {
    const groups = {};
    for (const def of attributeDefs) {
      const ns = def.namespace || 'subject';
      if (!groups[ns]) groups[ns] = [];
      groups[ns].push(def);
    }
    return groups;
  }, [attributeDefs]);

  const namespaceOrder = ['subject', 'resource', 'action', 'environment'];
  const orderedNamespaces = [
    ...namespaceOrder.filter((ns) => defsByNamespace[ns]),
    ...Object.keys(defsByNamespace).filter((ns) => !namespaceOrder.includes(ns)),
  ];

  if (!selectedAppKey) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to manage user attributes.</p>
      </div>
    );
  }

  const assignedCount = userAttributes.length;
  const totalDefs = attributeDefs.length;
  const userInitial = selectedUser
    ? (selectedUser.displayName || selectedUser.email || '?')[0].toUpperCase()
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {selectedAppName || selectedAppKey} — User Attributes
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign app-specific attributes to users for policy evaluation.
        </p>
      </div>

      {/* User selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-700">Select User</Label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyAssigned}
              onChange={(e) => {
                setShowOnlyAssigned(e.target.checked);
                setSelectedUserId('');
              }}
              className="rounded"
            />
            Show only users assigned to this app
          </label>
        </div>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="h-10">
            <SelectValue
              placeholder={
                loadingUsers
                  ? 'Loading users…'
                  : users.length === 0
                  ? 'No users found'
                  : 'Select a user to manage their attributes…'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => {
              const initial = (u.displayName || u.email || '?')[0].toUpperCase();
              const uid = getUserId(u);
              if (!uid) return null;
              return (
                <SelectItem key={uid} value={uid}>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {initial}
                    </div>
                    <span>{u.displayName || u.email || u.username || u.id}</span>
                    {u.email && u.displayName && (
                      <span className="text-xs text-gray-400">{u.email}</span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {showOnlyAssigned && users.length === 0 && !loadingUsers && (
          <p className="text-xs text-gray-400">No users assigned to this app yet.</p>
        )}
      </div>

      {/* User profile card + attribute editor */}
      {selectedUserId && (
        <>
          {/* User card */}
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
              {userInitial ?? <User className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {selectedUser?.displayName || selectedUser?.email || selectedUserId}
              </p>
              {selectedUser?.email && selectedUser?.displayName && (
                <p className="text-sm text-gray-500 truncate">{selectedUser.email}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              {loadingUserAttrs ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : (
                <>
                  <p className="text-lg font-bold text-gray-900">{assignedCount}/{totalDefs}</p>
                  <p className="text-xs text-gray-400">attributes assigned</p>
                </>
              )}
            </div>
          </div>

          {/* No attribute defs */}
          {!loadingUserAttrs && totalDefs === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="font-medium text-gray-600">No attribute definitions</p>
              <p className="text-sm mt-1">Define app attributes first in App Attributes.</p>
            </div>
          )}

          {/* Grouped attribute sections */}
          {!loadingUserAttrs && totalDefs > 0 && (
            <div className="space-y-4">
              {orderedNamespaces.map((ns) => (
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
                />
              ))}
            </div>
          )}

          {loadingUserAttrs && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
