import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { abacService } from '../api/abacService';
import { useAbacScope } from '../contexts/AbacScopeContext';
import { useAuth } from '@/features/auth/hooks/useAuth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenMatchedPolicies(matched) {
  if (!matched || typeof matched !== 'object') return [];
  const global = (matched.global ?? []).map((p) => ({ ...p, scope: 'global' }));
  const app = (matched.app ?? []).map((p) => ({ ...p, scope: 'app' }));
  return [...global, ...app];
}

// ---------------------------------------------------------------------------
// UserSearchPicker
// ---------------------------------------------------------------------------

function UserSearchPicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus the search input when the dropdown opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['abac', 'users', debouncedSearch],
    queryFn: () => abacService.listUsers({ search: debouncedSearch, limit: 20 }),
    enabled: open,
    staleTime: 30_000,
  });

  const raw = data?.data;
  const users = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);

  const handleSelect = (user) => {
    onSelect(user);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-dashed border-gray-300 rounded-md hover:border-gray-400 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        Search users
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col overflow-hidden">
          {/* Search input */}
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email or username…"
              className="w-full text-sm outline-none placeholder-gray-400"
            />
          </div>

          {/* Results */}
          <div className="max-h-52 overflow-y-auto">
            {isFetching && users.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">Searching…</div>
            ) : users.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">No users found</div>
            ) : (
              users.map((u) => {
                const name = u.displayName || u.username || u.email || 'User';
                const sub  = u.email && u.email !== name ? u.email : u.username;
                const parts = name.split(' ');
                const initials = parts.length > 1
                  ? (parts[0][0] + parts[1][0]).toUpperCase()
                  : name.substring(0, 2).toUpperCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelect(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold">
                      {initials}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                      {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
                      <p className="text-[10px] text-gray-300 font-mono truncate">{u.id}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Merge hub + app attr defs, deduplicating by key (app wins)
function mergeAttrDefs(hubDefs, appDefs) {
  const map = new Map();
  (hubDefs ?? []).forEach((d) => map.set(d.key, { ...d, source: 'hub' }));
  (appDefs ?? []).forEach((d) => map.set(d.key, { ...d, source: 'app' }));
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// SmartAttrRow — a single key+value row that is schema-aware
// ---------------------------------------------------------------------------

const TYPE_BADGE = {
  string:   'bg-blue-50 text-blue-600',
  number:   'bg-purple-50 text-purple-600',
  boolean:  'bg-green-50 text-green-600',
  enum:     'bg-amber-50 text-amber-600',
  list:     'bg-orange-50 text-orange-600',
  datetime: 'bg-pink-50 text-pink-600',
};

function SmartAttrRow({ attr, attrDefs, onChange, onRemove, keyPlaceholder = 'key', valuePlaceholder = 'value' }) {
  const selectedDef = attrDefs.find((d) => d.key === attr.key);
  const constraints = selectedDef?.constraints ?? {};
  const allowedValues = constraints.allowedValues;
  const dataType = selectedDef?.dataType;

  const handleKeyChange = (newKey) => {
    // When the key changes to a known def, reset the value
    const def = attrDefs.find((d) => d.key === newKey);
    onChange({ key: newKey, value: def ? '' : attr.value });
  };

  const valueInput = (() => {
    if (allowedValues?.length > 0) {
      return (
        <select
          value={attr.value}
          onChange={(e) => onChange({ ...attr, value: e.target.value })}
          className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Select value…</option>
          {allowedValues.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      );
    }
    if (dataType === 'boolean') {
      return (
        <select
          value={attr.value}
          onChange={(e) => onChange({ ...attr, value: e.target.value })}
          className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Select…</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    return (
      <Input
        placeholder={valuePlaceholder}
        value={attr.value}
        onChange={(e) => onChange({ ...attr, value: e.target.value })}
        type={dataType === 'number' ? 'number' : 'text'}
        className="flex-1 font-mono text-sm"
      />
    );
  })();

  return (
    <div className="flex items-center gap-2">
      {/* Key: dropdown when defs exist, plain input as fallback */}
      {attrDefs.length > 0 ? (
        <div className="flex-1 min-w-0 relative">
          <select
            value={attr.key}
            onChange={(e) => handleKeyChange(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 font-mono bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary pr-6"
          >
            <option value="">Select attribute…</option>
            {attrDefs.map((d) => (
              <option key={d.key} value={d.key}>
                {d.displayName ? `${d.displayName} (${d.key})` : d.key}
              </option>
            ))}
            <option value="__custom__">— custom key —</option>
          </select>
          {/* type badge overlay — only when a def is selected */}
          {selectedDef && (
            <span className={`absolute right-6 top-1/2 -translate-y-1/2 text-[9px] font-semibold px-1 rounded pointer-events-none ${TYPE_BADGE[selectedDef.dataType] ?? 'bg-gray-100 text-gray-500'}`}>
              {selectedDef.dataType}
            </span>
          )}
        </div>
      ) : (
        <Input
          placeholder={keyPlaceholder}
          value={attr.key}
          onChange={(e) => onChange({ ...attr, key: e.target.value })}
          className="flex-1 font-mono text-sm"
        />
      )}

      {/* Custom key input when __custom__ is chosen */}
      {attr.key === '__custom__' && (
        <Input
          placeholder="custom.key"
          value={attr.customKey ?? ''}
          onChange={(e) => onChange({ ...attr, customKey: e.target.value })}
          className="flex-1 font-mono text-sm"
          autoFocus
        />
      )}

      {/* Value input — schema-aware */}
      {attr.key !== '__custom__' ? valueInput : (
        <Input
          placeholder={valuePlaceholder}
          value={attr.value}
          onChange={(e) => onChange({ ...attr, value: e.target.value })}
          className="flex-1 font-mono text-sm"
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 flex-shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionSection — handles both simple and object/advanced mode
// ---------------------------------------------------------------------------

function ActionSection({ form, setForm, actionDefs }) {
  // Simple mode: action is a string (e.g. "view")
  // If actionDefs has a "type" attr with allowedValues, show those as chips + free-text
  const typeDef = actionDefs.find((d) => d.key === 'type');
  const typeAllowed = typeDef?.constraints?.allowedValues ?? [];

  return (
    <div className="space-y-3 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</Label>
        <div className="flex items-center bg-gray-100 rounded p-0.5 gap-0.5">
          <button
            onClick={() => setForm((f) => ({ ...f, actionMode: 'simple' }))}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
              form.actionMode === 'simple' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setForm((f) => ({ ...f, actionMode: 'advanced' }))}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
              form.actionMode === 'advanced' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Object
          </button>
        </div>
      </div>

      {form.actionMode === 'simple' ? (
        <div className="space-y-2">
          {typeAllowed.length > 0 ? (
            <>
              {/* Quick-select chips from "type" allowed values */}
              <div className="flex flex-wrap gap-1.5">
                {typeAllowed.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, action: v }))}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-mono ${
                      form.action === v
                        ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <Input
                placeholder="or type a custom action…"
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="font-mono text-sm"
              />
            </>
          ) : (
            <Input
              placeholder="e.g. view, edit, delete"
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
            />
          )}
          {typeAllowed.length === 0 && actionDefs.length === 0 && (
            <p className="text-[11px] text-amber-600">
              No action attributes defined — add them in App Attributes (namespace: action) for smart suggestions.
            </p>
          )}
        </div>
      ) : (
        /* Object mode — schema-driven rows */
        <div className="space-y-2">
          {form.actionAttrs.map((attr, i) => (
            <SmartAttrRow
              key={`act-${i}`}
              attr={attr}
              attrDefs={actionDefs}
              onChange={(updated) => {
                const list = [...form.actionAttrs];
                list[i] = updated;
                setForm((f) => ({ ...f, actionAttrs: list }));
              }}
              onRemove={() => {
                setForm((f) => ({
                  ...f,
                  actionAttrs: f.actionAttrs.filter((_, idx) => idx !== i),
                }));
              }}
              keyPlaceholder="key"
              valuePlaceholder="value"
            />
          ))}
          <button
            onClick={() => setForm((f) => ({ ...f, actionAttrs: [...f.actionAttrs, { key: '', value: '' }] }))}
            className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
          >
            + Add
          </button>
          {actionDefs.length === 0 && (
            <p className="text-[11px] text-amber-600">
              No action attributes defined — add them in App Attributes (namespace: action) for smart inputs.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResolvedAttributesPanel (unchanged)
// ---------------------------------------------------------------------------

function ResolvedAttributesPanel({ attrs }) {
  const [open, setOpen] = useState(false);
  if (!attrs) return null;

  const namespaces = [
    { label: 'Subject',     key: 'subject',     color: 'text-blue-700'   },
    { label: 'Resource',    key: 'resource',     color: 'text-purple-700' },
    { label: 'Action',      key: 'action',       color: 'text-teal-700'   },
    { label: 'Environment', key: 'environment',  color: 'text-gray-700'   },
  ];

  return (
    <div className="border border-gray-200 rounded bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 transition-colors"
      >
        <span>Resolved Attributes</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {namespaces.map(({ label, key, color }) => {
            const val = attrs[key];
            if (val === undefined || val === null) return null;
            return (
              <div key={key} className="px-3 py-2.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
                <pre className="mt-1.5 text-xs font-mono text-gray-700 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PolicyTesterPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    subjectId:        '',
    selectedUser:     null,   // full user object from search picker
    actionMode:       'simple',
    action:           '',
    actionAttrs:      [{ key: '', value: '' }],
    resourceAttrs:    [{ key: '', value: '' }],
    environmentAttrs: [{ key: '', value: '' }],
  });

  const [result, setResult] = useState(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: hubAttrData } = useQuery({
    queryKey: ['abac', 'hubAttrDefs'],
    queryFn: () => abacService.listHubAttrDefs(),
    staleTime: 120_000,
  });

  const { data: appAttrData } = useQuery({
    queryKey: ['abac', 'appAttributes', selectedAppKey],
    queryFn: () => abacService.listAppAttrDefs(selectedAppKey),
    enabled: !!selectedAppKey,
    staleTime: 120_000,
  });

  // ── Normalise attr defs ────────────────────────────────────────────────────

  const hubDefs = useMemo(() => {
    const raw = hubAttrData?.data?.data ?? hubAttrData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [hubAttrData]);

  const appDefs = useMemo(() => {
    const raw = appAttrData?.data?.data ?? appAttrData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [appAttrData]);

  const allDefs = useMemo(() => mergeAttrDefs(hubDefs, appDefs), [hubDefs, appDefs]);

  const resourceDefs   = useMemo(() => allDefs.filter((d) => d.namespace === 'resource'),   [allDefs]);
  const actionDefs     = useMemo(() => allDefs.filter((d) => d.namespace === 'action'),     [allDefs]);
  const environmentDefs = useMemo(() => allDefs.filter((d) => d.namespace === 'environment'), [allDefs]);

  // ── Mutation ───────────────────────────────────────────────────────────────

  const evaluateMutation = useMutation({
    mutationFn: (payload) => abacService.evaluate(selectedAppKey, payload),
    onSuccess: (axiosRes) => {
      const body = axiosRes?.data;
      setResult(body?.data ?? body);
    },
    onError: (err) => {
      const raw = err?.response?.data?.message ?? err?.response?.data?.error;
      const errorMsg = Array.isArray(raw) ? raw.join('; ') : raw || err.message;
      toast({ title: 'Evaluation failed', description: errorMsg, variant: 'destructive' });
    },
  });

  if (!selectedAppKey) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to test policies.</p>
      </div>
    );
  }

  // ── Payload builder ────────────────────────────────────────────────────────

  const resolveAttrKey = (attr) =>
    attr.key === '__custom__' ? (attr.customKey ?? '').trim() : attr.key.trim();

  const arrayToObject = (arr) =>
    arr.reduce((acc, attr) => {
      const k = resolveAttrKey(attr);
      if (!k) return acc;
      let val = attr.value;
      if (val === 'true')       val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(val) && val !== '') val = Number(val);
      else {
        try { val = JSON.parse(val); } catch { /* keep string */ }
      }
      acc[k] = val;
      return acc;
    }, {});

  const handleTest = (dryRun = false) => {
    try {
      const resObj = arrayToObject(form.resourceAttrs);
      const envObj = arrayToObject(form.environmentAttrs);
      const actionValue = form.actionMode === 'advanced'
        ? arrayToObject(form.actionAttrs)
        : form.action.trim();

      const payload = {
        subject_id: form.subjectId.trim(),
        subjectId:  form.subjectId.trim(),
        action:     actionValue,
        ...(Object.keys(resObj).length > 0 && { resource:     resObj }),
        ...(Object.keys(envObj).length > 0 && { environment:  envObj }),
      };
      evaluateMutation.mutate({ ...payload, dryRun });
    } catch {
      toast({ title: 'Evaluation Error', description: 'Failed to parse attributes.', variant: 'destructive' });
    }
  };

  // ── Row helpers for resource/environment ───────────────────────────────────

  const updateRow = (type, index, updated) => {
    setForm((f) => {
      const list = [...f[type]];
      list[index] = updated;
      return { ...f, [type]: list };
    });
  };

  const addRow = (type) =>
    setForm((f) => ({ ...f, [type]: [...f[type], { key: '', value: '' }] }));

  const removeRow = (type, index) =>
    setForm((f) => ({ ...f, [type]: f[type].filter((_, i) => i !== index) }));

  // ── Output helpers ─────────────────────────────────────────────────────────

  const rows = flattenMatchedPolicies(result?.matchedPolicies);
  const durationMs = result?.durationMs ?? result?.duration_ms;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto flex gap-8 h-[calc(100vh-8rem)]">

      {/* ── Input Panel ─────────────────────────────────────────────────── */}
      <div className="w-1/2 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Request Context</h2>
          <p className="text-xs text-gray-500">Simulate an incoming access request.</p>
          {selectedAppName && (
            <p className="text-[11px] text-primary font-medium mt-1 truncate">App: {selectedAppName}</p>
          )}
        </div>

        <div className="p-5 space-y-6 flex-1 overflow-y-auto">

          {/* Subject */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject ID</Label>
            <Input
              placeholder="e.g. user-uuid"
              value={form.subjectId}
              onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
            />
            {/* Selected user display */}
            {form.selectedUser && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-md">
                <span className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold bg-primary/15 text-primary flex-shrink-0">
                  {(form.selectedUser.displayName || form.selectedUser.username || form.selectedUser.email || 'U').substring(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary truncate">
                    {form.selectedUser.displayName || form.selectedUser.username || form.selectedUser.email}
                  </p>
                  {form.selectedUser.email && form.selectedUser.email !== (form.selectedUser.displayName || form.selectedUser.username) && (
                    <p className="text-[10px] text-gray-400 truncate">{form.selectedUser.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, selectedUser: null, subjectId: '' }))}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {/* Me badge */}
              {currentUser?.id && (
                <button
                  onClick={() => setForm((f) => ({ ...f, subjectId: currentUser.id, selectedUser: currentUser }))}
                  title={`Use my ID: ${currentUser.id}`}
                  className="flex items-center gap-2 px-2 py-1 bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold bg-primary/15 text-primary">Me</span>
                  <span className="text-xs text-primary font-medium">
                    {currentUser.displayName || currentUser.username || currentUser.email || 'Me'}
                  </span>
                </button>
              )}
              {/* Search picker */}
              <UserSearchPicker
                onSelect={(u) => setForm((f) => ({ ...f, subjectId: u.id, selectedUser: u }))}
              />
            </div>
          </div>

          {/* Resource */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource Attributes</Label>
              {resourceDefs.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  {resourceDefs.length} attr{resourceDefs.length !== 1 ? 's' : ''} defined
                </span>
              )}
            </div>

            {form.resourceAttrs.map((attr, i) => (
              <SmartAttrRow
                key={`res-${i}`}
                attr={attr}
                attrDefs={resourceDefs}
                onChange={(updated) => updateRow('resourceAttrs', i, updated)}
                onRemove={() => removeRow('resourceAttrs', i)}
                keyPlaceholder="resource.key"
                valuePlaceholder="value"
              />
            ))}

            <button
              onClick={() => addRow('resourceAttrs')}
              className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
            >
              + Add
            </button>

            {resourceDefs.length === 0 && (
              <p className="text-[11px] text-amber-600">
                No resource attributes defined — add them in App Attributes (namespace: resource) for smart inputs.
              </p>
            )}
          </div>

          {/* Action */}
          <ActionSection
            form={form}
            setForm={setForm}
            actionDefs={actionDefs}
          />

          {/* Environment */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Environment Attributes</Label>
              {environmentDefs.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  {environmentDefs.length} attr{environmentDefs.length !== 1 ? 's' : ''} defined
                </span>
              )}
            </div>

            {form.environmentAttrs.map((attr, i) => (
              <SmartAttrRow
                key={`env-${i}`}
                attr={attr}
                attrDefs={environmentDefs}
                onChange={(updated) => updateRow('environmentAttrs', i, updated)}
                onRemove={() => removeRow('environmentAttrs', i)}
                keyPlaceholder="environment.key"
                valuePlaceholder="value"
              />
            ))}

            <button
              onClick={() => addRow('environmentAttrs')}
              className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
            >
              + Add
            </button>

            {environmentDefs.length === 0 && (
              <p className="text-[11px] text-amber-600">
                No environment attributes defined — add them in Hub or App Attributes (namespace: environment) for smart inputs.
              </p>
            )}
          </div>

        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
          <Button
            className="flex-1"
            onClick={() => handleTest(false)}
            disabled={evaluateMutation.isPending || !form.subjectId.trim()}
          >
            {evaluateMutation.isPending ? 'Evaluating…' : 'Evaluate'}
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => handleTest(true)}
            disabled={evaluateMutation.isPending || !form.subjectId.trim()}
            title="Includes draft policies in the result without writing to audit logs"
          >
            {evaluateMutation.isPending ? 'Evaluating…' : 'Dry-run'}
          </Button>
        </div>
      </div>

      {/* ── Output Panel ────────────────────────────────────────────────── */}
      <div className="w-1/2 flex flex-col bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 bg-white">
          <h2 className="font-semibold text-gray-900">Evaluation Result</h2>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          {!result ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Run an evaluation to see the result
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`p-6 rounded-lg border flex items-center justify-between ${
                result.effect === 'PERMIT' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-2xl font-bold ${result.effect === 'PERMIT' ? 'text-green-700' : 'text-red-700'}`}>
                      {result.effect}
                    </h3>
                    {result.dryRun && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full">
                        Simulation
                      </span>
                    )}
                  </div>
                  {result.effect !== 'DENY' && (
                    <p className="text-sm mt-1 text-green-600">{result.reason || 'Decision reached successfully.'}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Evaluation Time</span>
                  <p className="text-lg font-mono text-gray-700">{durationMs != null ? `${durationMs} ms` : '—'}</p>
                </div>
              </div>

              {result.effect === 'DENY' && (
                <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <span className="text-red-500 text-lg leading-none mt-0.5">✕</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">Access Denied</p>
                    <p className="text-sm text-red-700 mt-0.5">
                      {result.reason || 'A DENY policy matched this request. No ALLOW policy overrode it.'}
                    </p>
                  </div>
                </div>
              )}

              <ResolvedAttributesPanel attrs={result.resolvedAttributes} />

              <div>
                <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Matched Policies</Label>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-600 italic">No policies matched this request.</p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((p, i) => {
                      const isDecisiveDeny =
                        result.effect === 'DENY' &&
                        p.effect !== 'PERMIT' &&
                        rows.findIndex((r) => r.effect !== 'PERMIT') === i;
                      return (
                        <div
                          key={`${p.scope}-${p.policyId ?? i}`}
                          className={`p-3 rounded text-sm flex justify-between items-center shadow-sm border ${
                            isDecisiveDeny ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isDecisiveDeny && (
                              <span className="text-red-500 text-xs shrink-0" title="This policy caused the DENY">▶</span>
                            )}
                            <span className={`font-medium truncate ${isDecisiveDeny ? 'text-red-800' : 'text-gray-800'}`}>
                              {p.policyName ?? p.name ?? 'Policy'}
                            </span>
                            {isDecisiveDeny && (
                              <span className="text-[10px] text-red-600 font-semibold shrink-0">decisive</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {p.isDraft && (
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded uppercase">draft</span>
                            )}
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">{p.scope}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              p.effect === 'PERMIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {p.effect}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {result.conditionFailedPolicies?.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Condition Failed</Label>
                  <div className="space-y-2">
                    {result.conditionFailedPolicies.map((p, i) => (
                      <div key={`cf-${p.policyId ?? i}`} className="bg-white border border-gray-200 p-3 rounded text-sm flex justify-between items-center shadow-sm opacity-60">
                        <span className="font-medium text-gray-700">{p.policyName ?? 'Policy'}</span>
                        <div className="flex items-center gap-2">
                          {p.isDraft && (
                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded uppercase">draft</span>
                          )}
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">{p.scope}</span>
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">cond. failed</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.targetExcludedCount > 0 && (
                <p className="text-xs text-gray-400 italic">
                  {result.targetExcludedCount} {result.targetExcludedCount === 1 ? 'policy was' : 'policies were'} excluded by target filter (wrong resource type, action, or subject type).
                </p>
              )}

              {result.obligations?.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Obligations Triggered</Label>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded text-xs font-mono overflow-x-auto shadow-inner">
                    {JSON.stringify(result.obligations, null, 2)}
                  </pre>
                </div>
              )}

              {result.skippedDraftPolicies?.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Draft Policies Not Evaluated</Label>
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
                    <p className="text-xs text-amber-700 font-medium">
                      The following policies are in <span className="font-bold">draft</span> status and were skipped. Activate them to include them in evaluation.
                    </p>
                    <ul className="text-sm text-amber-800 space-y-1">
                      {result.skippedDraftPolicies.map((p) => (
                        <li key={p.policyId} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          {p.policyName}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {result.coverageGaps?.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Coverage Gaps</Label>
                  <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded p-3 space-y-1">
                    {result.coverageGaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
