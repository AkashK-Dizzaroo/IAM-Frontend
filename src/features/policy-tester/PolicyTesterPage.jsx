import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { QK } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { evaluationService } from './api/evaluationService';
import { appAttributeService } from '@/features/app-attributes/api/appAttributeService';
import { hubAttributeService } from '@/features/hub-attributes/api/hubAttributeService';
import { abacUserService } from '@/features/users/api/abacUserService';
import { appUserService } from '@/features/app-users/api/appUserService';
import { useAbacScope } from '@/features/scope';
import { useAuth } from '@/features/auth';
import { resourceService } from '@/features/resources';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenMatchedPolicies(matched) {
  if (!matched || typeof matched !== 'object') return [];
  const global = (matched.global ?? []).map((p) => ({ ...p, scope: 'global' }));
  const app = (matched.app ?? []).map((p) => ({ ...p, scope: 'app' }));
  return [...global, ...app];
}

function mergeAttrDefs(hubDefs, appDefs) {
  const map = new Map();
  (hubDefs ?? []).forEach((d) => map.set(d.key, { ...d, source: 'hub' }));
  (appDefs ?? []).forEach((d) => map.set(d.key, { ...d, source: 'app' }));
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Generic SearchDropdown — used by both UserPicker and ResourcePicker
// ---------------------------------------------------------------------------

function SearchDropdown({ triggerLabel, triggerIcon, placeholder, items, isFetching, onSelect, renderItem, renderEmpty, onSearchChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => onSearchChange?.(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSelect = (item) => {
    onSelect(item);
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
        {triggerIcon}
        {triggerLabel}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="w-full text-sm outline-none placeholder-gray-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {isFetching && items.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">Searching…</div>
            ) : items.length === 0 ? (
              renderEmpty ? renderEmpty() : (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">No results found</div>
              )
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left hover:bg-gray-50 transition-colors"
                >
                  {renderItem(item)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserSearchPicker
// ---------------------------------------------------------------------------

function UserSearchPicker({ onSelect }) {
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: QK.users(debouncedSearch),
    queryFn: () => abacUserService.list({ search: debouncedSearch, limit: 20 }),
    staleTime: 30_000,
  });

  const raw = data?.data;
  const users = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);

  return (
    <SearchDropdown
      triggerLabel="Search users"
      triggerIcon={
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      }
      placeholder="Name or email…"
      items={users}
      isFetching={isFetching}
      onSelect={onSelect}
      onSearchChange={setDebouncedSearch}
      renderItem={(u) => {
        const name = u.displayName || u.email || 'User';
        const sub = u.email && u.email !== name ? u.email : null;
        const parts = name.split(' ');
        const initials = parts.length > 1
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : name.substring(0, 2).toUpperCase();
        return (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold">
              {initials}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
              {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
            </div>
          </div>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// ResourceSearchPicker
// ---------------------------------------------------------------------------

function ResourceSearchPicker({ onSelect, applicationId }) {
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: [...QK.resourcesByApp(applicationId), debouncedSearch],
    queryFn: () => resourceService.getResources({ applicationId, search: debouncedSearch, limit: 30 }),
    enabled: !!applicationId,
    staleTime: 30_000,
  });

  const raw = data?.data ?? data;
  const resources = Array.isArray(raw) ? raw : [];

  return (
    <SearchDropdown
      triggerLabel="Search resources"
      triggerIcon={
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      }
      placeholder="Resource name…"
      items={resources}
      isFetching={isFetching}
      onSelect={onSelect}
      onSearchChange={setDebouncedSearch}
      renderEmpty={() => (
        <div className="px-3 py-3 text-xs text-gray-400 text-center">
          {!applicationId ? 'Select an app first' : 'No resources found'}
        </div>
      )}
      renderItem={(r) => (
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="flex-shrink-0 w-6 h-6 rounded bg-purple-100 text-purple-600 flex items-center justify-center text-[9px] font-bold">
            L{r.level ?? '?'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
            {r.externalId && <p className="text-xs text-gray-400 font-mono truncate">{r.externalId}</p>}
          </div>
        </div>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// SubjectAttributesPreview
// ---------------------------------------------------------------------------

function SubjectAttributesPreview({ userId, appKey }) {
  const [open, setOpen] = useState(false);

  const { data: hubData, isFetching: hubFetching } = useQuery({
    queryKey: QK.hubUserAttrs(userId),
    queryFn: () => abacUserService.listHubUserAttrs(userId),
    enabled: !!userId && open,
    staleTime: 30_000,
  });

  const { data: appData, isFetching: appFetching } = useQuery({
    queryKey: QK.appUserAttrs(appKey, userId),
    queryFn: () => appUserService.listAppUserAttrs(appKey, userId),
    enabled: !!userId && !!appKey && open,
    staleTime: 30_000,
  });

  const hubAttrs = useMemo(() => {
    const raw = hubData?.data?.data ?? hubData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [hubData]);

  const appAttrs = useMemo(() => {
    const raw = appData?.data?.data ?? appData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [appData]);

  const isFetching = hubFetching || appFetching;
  const hasAttrs = hubAttrs.length > 0 || appAttrs.length > 0;

  if (!userId) return null;

  return (
    <div className="border border-gray-200 rounded-md bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          Subject Attributes Preview
          {!open && <span className="text-gray-400 font-normal">(click to expand)</span>}
        </span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-200 px-3 py-2.5 space-y-3">
          {isFetching ? (
            <p className="text-xs text-gray-400 text-center py-2">Loading…</p>
          ) : !hasAttrs ? (
            <p className="text-xs text-gray-400 italic">No attributes assigned to this user.</p>
          ) : (
            <>
              {hubAttrs.length > 0 && (
                <AttrList label="Hub Attributes" color="text-blue-600" attrs={hubAttrs} />
              )}
              {appAttrs.length > 0 && (
                <AttrList label="App Attributes" color="text-purple-600" attrs={appAttrs} />
              )}
              <p className="text-[10px] text-gray-400 italic">Hub attrs take precedence on key collision.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResourceAttributesPreview
// ---------------------------------------------------------------------------

function ResourceAttributesPreview({ resourceId }) {
  const [open, setOpen] = useState(true);

  const { data, isFetching } = useQuery({
    queryKey: ['resources', 'attrs', resourceId],
    queryFn: () => resourceService.getResourceAttributes(resourceId),
    enabled: !!resourceId,
    staleTime: 30_000,
  });

  const attrsMap = useMemo(() => {
    const raw = data?.data ?? data ?? {};
    return typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  }, [data]);

  const entries = Object.entries(attrsMap);

  if (!resourceId) return null;

  return (
    <div className="border border-purple-200 rounded-md bg-purple-50 overflow-hidden mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          Resource Attributes
        </span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-purple-200 px-3 py-2.5">
          {isFetching ? (
            <p className="text-xs text-purple-400 text-center py-2">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-purple-400 italic">No attributes stored for this resource.</p>
          ) : (
            <div className="space-y-1">
              {entries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-purple-600 flex-shrink-0">{k}</span>
                  <span className="text-purple-300">→</span>
                  <span className="font-mono text-purple-900 truncate">
                    {Array.isArray(v) ? v.join(', ') : String(v ?? '')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttrList — generic key-value list renderer
// ---------------------------------------------------------------------------

function formatAttrValue(val) {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return val.map((item) =>
      typeof item === 'object' ? JSON.stringify(item) : String(item)
    ).join(', ');
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function AttrList({ label, color, attrs }) {
  return (
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${color}`}>{label}</p>
      <div className="space-y-1">
        {attrs.map((a) => {
          const key = a.attributeDef?.key ?? a.attributeKey ?? a.attributeName ?? a.key ?? a.id;
          const val = a.value;
          return (
            <div key={key ?? a.id} className="flex items-start gap-2 text-xs">
              <span className="font-mono text-gray-500 flex-shrink-0 pt-px">{key}</span>
              <span className="text-gray-300 flex-shrink-0 pt-px">→</span>
              <span className="font-mono text-gray-800 break-all">{formatAttrValue(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TYPE_BADGE
// ---------------------------------------------------------------------------

const TYPE_BADGE = {
  string:   'bg-blue-50 text-blue-600',
  number:   'bg-purple-50 text-purple-600',
  boolean:  'bg-green-50 text-green-600',
  enum:     'bg-amber-50 text-amber-600',
  list:     'bg-orange-50 text-orange-600',
  datetime: 'bg-pink-50 text-pink-600',
};

// ---------------------------------------------------------------------------
// ListTagInput — for list/multi-value attrs (e.g. child_action)
// ---------------------------------------------------------------------------

function ListTagInput({ value, onChange, allowedValues, placeholder }) {
  const [inputVal, setInputVal] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const addTag = (tag) => {
    const trimmed = String(tag).trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInputVal('');
  };

  const removeTag = (tag) => onChange(tags.filter((t) => t !== tag));

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-wrap gap-1 items-center border border-gray-200 rounded px-2 py-1 bg-white focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary min-h-[32px]">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 bg-orange-100 text-orange-800 text-[10px] font-semibold px-1.5 py-0.5 rounded">
          {t}
          <button type="button" onClick={() => removeTag(t)} className="hover:text-red-600 leading-none">×</button>
        </span>
      ))}
      {allowedValues?.length > 0 ? (
        <select
          value=""
          onChange={(e) => { if (e.target.value) addTag(e.target.value); }}
          className="text-xs outline-none bg-transparent text-gray-500 flex-1 min-w-[80px]"
        >
          <option value="">+ Add…</option>
          {allowedValues.filter((v) => !tags.includes(v)).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : (
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKey}
          placeholder={tags.length === 0 ? (placeholder || 'Type and press Enter…') : ''}
          className="text-xs outline-none flex-1 min-w-[80px] placeholder-gray-400"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionAttrRow — handles boolean toggle, list tag input, and plain string/number
// ---------------------------------------------------------------------------

function ActionAttrRow({ attr, attrDefs, onChange, onRemove }) {
  const selectedDef = attrDefs.find((d) => d.key === attr.key);
  const dataType = selectedDef?.dataType;
  const constraints = selectedDef?.constraints ?? {};
  const allowedValues = constraints.allowedValues;

  const handleKeyChange = (newKey) => {
    const def = attrDefs.find((d) => d.key === newKey);
    const defaultValue = def?.dataType === 'list' ? [] : def?.dataType === 'boolean' ? '' : '';
    onChange({ key: newKey, value: defaultValue });
  };

  // Value input is type-aware
  const renderValue = () => {
    if (dataType === 'list' || (selectedDef?.isMultiValued)) {
      return (
        <ListTagInput
          value={attr.value}
          onChange={(newArr) => onChange({ ...attr, value: newArr })}
          allowedValues={allowedValues}
          placeholder="Type and press Enter…"
        />
      );
    }
    if (dataType === 'boolean') {
      return (
        <div className="flex gap-1 flex-shrink-0">
          {['true', 'false'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ ...attr, value: v })}
              className={`text-xs px-2.5 py-1 rounded font-semibold border transition-colors ${
                attr.value === v
                  ? v === 'true'
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-red-400 text-white border-red-400'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      );
    }
    if (allowedValues?.length > 0) {
      return (
        <select
          value={attr.value}
          onChange={(e) => onChange({ ...attr, value: e.target.value })}
          className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">Select…</option>
          {allowedValues.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }
    return (
      <Input
        placeholder="value"
        value={attr.value}
        onChange={(e) => onChange({ ...attr, value: e.target.value })}
        type={dataType === 'number' ? 'number' : 'text'}
        className="flex-1 font-mono text-sm"
      />
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {/* Key selector */}
        {attrDefs.length > 0 ? (
          <div className="w-40 flex-shrink-0 relative">
            <select
              value={attr.key}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 font-mono bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary pr-5"
            >
              <option value="">Select…</option>
              {attrDefs.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.displayName ?? d.key}
                </option>
              ))}
              <option value="__custom__">— custom —</option>
            </select>
            {selectedDef && (
              <span className={`absolute right-5 top-1/2 -translate-y-1/2 text-[8px] font-bold px-0.5 rounded pointer-events-none ${TYPE_BADGE[selectedDef.dataType] ?? 'bg-gray-100 text-gray-500'}`}>
                {selectedDef.dataType === 'list' ? '[ ]' : selectedDef.dataType === 'boolean' ? 'bool' : selectedDef.dataType}
              </span>
            )}
          </div>
        ) : (
          <Input
            placeholder="action.key"
            value={attr.key}
            onChange={(e) => onChange({ ...attr, key: e.target.value })}
            className="w-40 flex-shrink-0 font-mono text-sm"
          />
        )}

        {/* Custom key input */}
        {attr.key === '__custom__' && (
          <Input
            placeholder="custom.key"
            value={attr.customKey ?? ''}
            onChange={(e) => onChange({ ...attr, customKey: e.target.value })}
            className="w-32 flex-shrink-0 font-mono text-sm"
            autoFocus
          />
        )}

        {/* Value */}
        {attr.key !== '__custom__' ? renderValue() : (
          <Input
            placeholder="value"
            value={typeof attr.value === 'string' ? attr.value : JSON.stringify(attr.value)}
            onChange={(e) => onChange({ ...attr, value: e.target.value })}
            className="flex-1 font-mono text-sm"
          />
        )}

        <Button variant="ghost" size="icon" onClick={onRemove} className="text-gray-400 hover:text-red-500 flex-shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </Button>
      </div>

      {/* Hint for list type */}
      {selectedDef && dataType === 'list' && (
        <p className="text-[10px] text-orange-600 ml-[10.5rem]">
          Multi-value — type and press Enter to add each value
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PayloadPreview — shows the exact JSON payload that will be sent
// ---------------------------------------------------------------------------

function PayloadPreview({ form, actionDefs, coerceValue, actionAttrsToObject }) {
  const [open, setOpen] = useState(false);

  const preview = useMemo(() => {
    if (!form.selectedUser) return null;
    try {
      const action = actionAttrsToObject(form.actionAttrs);
      const resource = form.selectedResource
        ? { id: form.selectedResource.id, name: form.selectedResource.name }
        : undefined;
      const envObj = form.environmentAttrs.reduce((acc, attr) => {
        const k = attr.key === '__custom__' ? (attr.customKey ?? '').trim() : attr.key.trim();
        if (!k) return acc;
        acc[k] = coerceValue(attr.value);
        return acc;
      }, {});
      return {
        subjectId: form.selectedUser.id,
        action,
        ...(resource && { resource }),
        ...(Object.keys(envObj).length > 0 && { environment: envObj }),
      };
    } catch {
      return null;
    }
  }, [form, actionDefs]);

  if (!form.selectedUser) return null;

  return (
    <div className="border border-gray-200 rounded bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:bg-gray-50 transition-colors"
      >
        <span>Payload Preview</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3 py-2">
          <pre className="text-[10px] font-mono text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {preview ? JSON.stringify(preview, null, 2) : '(fill in subject + action first)'}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionSection — always object mode, smart per-attr inputs
// ---------------------------------------------------------------------------

function ActionSection({ form, setForm, actionDefs }) {
  const hasTabDefs  = actionDefs.some((d) => d.dataType === 'boolean');
  const hasListDefs = actionDefs.some((d) => d.dataType === 'list' || d.isMultiValued);

  return (
    <div className="space-y-3 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</Label>
        {actionDefs.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            {hasTabDefs && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">tab access</span>}
            {hasListDefs && <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-medium">child actions</span>}
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {form.actionAttrs.map((attr, i) => (
          <ActionAttrRow
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
          />
        ))}

        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, actionAttrs: [...f.actionAttrs, { key: '', value: '' }] }))}
          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Action Attribute
        </button>

        {actionDefs.length === 0 && (
          <p className="text-[11px] text-amber-600">
            No action attributes defined for this app yet.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResolvedAttributesPanel
// ---------------------------------------------------------------------------

function ResolvedAttributesPanel({ attrs, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);
  if (!attrs) return null;

  const namespaces = [
    { label: 'Subject',     key: 'subject',    color: 'text-blue-700'   },
    { label: 'Resource',    key: 'resource',   color: 'text-purple-700' },
    { label: 'Action',      key: 'action',     color: 'text-teal-700'   },
    { label: 'Environment', key: 'environment', color: 'text-gray-700'  },
  ];

  return (
    <div className="border border-gray-200 rounded bg-white overflow-hidden">
      <button
        type="button"
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
  const { selectedAppKey, selectedAppName, selectedAppId } = useAbacScope();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    selectedUser:     null,
    selectedResource: null,
    actionAttrs:      [{ key: '', value: '' }],
    environmentAttrs: [{ key: '', value: '' }],
  });

  const [result, setResult] = useState(null);

  // ── Attr definitions ───────────────────────────────────────────────────────

  const { data: hubAttrData } = useQuery({
    queryKey: QK.hubAttributes,
    queryFn: () => hubAttributeService.list(),
  });

  const { data: appAttrData } = useQuery({
    queryKey: QK.appAttributes(selectedAppKey),
    queryFn: () => appAttributeService.list(selectedAppKey),
    enabled: !!selectedAppKey,
  });

  const hubDefs = useMemo(() => {
    const raw = hubAttrData?.data?.data ?? hubAttrData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [hubAttrData]);

  const appDefs = useMemo(() => {
    const raw = appAttrData?.data?.data ?? appAttrData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [appAttrData]);

  const allDefs = useMemo(() => mergeAttrDefs(hubDefs, appDefs), [hubDefs, appDefs]);

  const actionDefs      = useMemo(() => allDefs.filter((d) => d.namespace === 'action'),      [allDefs]);
  const environmentDefs = useMemo(() => allDefs.filter((d) => d.namespace === 'environment'), [allDefs]);

  // ── Mutation ───────────────────────────────────────────────────────────────

  const evaluateMutation = useMutation({
    mutationFn: (payload) => evaluationService.evaluate(selectedAppKey, payload),
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

  const coerceValue = (val, dataType) => {
    if (Array.isArray(val)) return val;
    if (val === 'true')  return true;
    if (val === 'false') return false;
    if (dataType === 'number' && !isNaN(val) && val !== '') return Number(val);
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  };

  const actionAttrsToObject = (attrs) =>
    attrs.reduce((acc, attr) => {
      const k = attr.key === '__custom__' ? (attr.customKey ?? '').trim() : attr.key.trim();
      if (!k) return acc;
      const def = actionDefs.find((d) => d.key === k);
      acc[k] = coerceValue(attr.value, def?.dataType);
      return acc;
    }, {});

  const isActionValid = () =>
    form.actionAttrs.some((a) => {
      const k = a.key === '__custom__' ? (a.customKey ?? '').trim() : a.key.trim();
      return k.length > 0;
    });

  const handleTest = (dryRun = false) => {
    if (!form.selectedUser) {
      toast({ title: 'Subject required', description: 'Select a user first.', variant: 'destructive' });
      return;
    }
    if (!isActionValid()) {
      toast({ title: 'Action required', description: 'Add at least one action attribute.', variant: 'destructive' });
      return;
    }

    try {
      const action = actionAttrsToObject(form.actionAttrs);

      // Resource: always include the selected resource id so the attribute-resolver
      // can enrich it from the DB, plus any extra inline keys
      const resource = form.selectedResource
        ? { id: form.selectedResource.id, name: form.selectedResource.name }
        : undefined;

      const envObj = form.environmentAttrs.reduce((acc, attr) => {
        const k = attr.key === '__custom__' ? (attr.customKey ?? '').trim() : attr.key.trim();
        if (!k) return acc;
        acc[k] = coerceValue(attr.value);
        return acc;
      }, {});

      const payload = {
        subjectId:  form.selectedUser.id,
        subject_id: form.selectedUser.id,
        action,
        ...(resource && { resource }),
        ...(Object.keys(envObj).length > 0 && { environment: envObj }),
        dryRun,
      };

      evaluateMutation.mutate(payload);
    } catch {
      toast({ title: 'Evaluation Error', description: 'Failed to build payload.', variant: 'destructive' });
    }
  };

  // ── Output helpers ─────────────────────────────────────────────────────────

  const rows = flattenMatchedPolicies(result?.matchedPolicies);
  const durationMs = result?.durationMs ?? result?.duration_ms;
  const canEvaluate = !evaluateMutation.isPending && !!form.selectedUser;

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

          {/* ── Subject ── */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject (User)</Label>

            {form.selectedUser ? (
              /* Selected user card */
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-md">
                <span className="flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold bg-primary/15 text-primary flex-shrink-0">
                  {(form.selectedUser.displayName || form.selectedUser.email || 'U').substring(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">
                    {form.selectedUser.displayName || form.selectedUser.email}
                  </p>
                  {form.selectedUser.email && form.selectedUser.email !== form.selectedUser.displayName && (
                    <p className="text-[11px] text-gray-400 truncate">{form.selectedUser.email}</p>
                  )}
                  <p className="text-[10px] text-gray-300 font-mono truncate">{form.selectedUser.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, selectedUser: null }))}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
                  title="Remove user"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Picker row */
              <div className="flex flex-wrap gap-2">
                {currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, selectedUser: currentUser }))}
                    title={`Use my account`}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors"
                  >
                    <span className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold bg-primary/15 text-primary">Me</span>
                    <span className="text-xs text-primary font-medium">
                      {currentUser.displayName || currentUser.email || 'Me'}
                    </span>
                  </button>
                )}
                <UserSearchPicker
                  onSelect={(u) => setForm((f) => ({ ...f, selectedUser: u }))}
                />
              </div>
            )}

            {/* Subject attrs preview */}
            {form.selectedUser && (
              <SubjectAttributesPreview
                userId={form.selectedUser.id}
                appKey={selectedAppKey}
              />
            )}
          </div>

          {/* ── Resource ── */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource</Label>

            {form.selectedResource ? (
              /* Selected resource card */
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-purple-50 border border-purple-200 rounded-md">
                <span className="flex items-center justify-center w-7 h-7 rounded bg-purple-100 text-purple-700 text-[10px] font-bold flex-shrink-0">
                  L{form.selectedResource.level ?? '?'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-purple-800 truncate">{form.selectedResource.name}</p>
                  {form.selectedResource.externalId && (
                    <p className="text-[10px] text-purple-400 font-mono truncate">{form.selectedResource.externalId}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, selectedResource: null }))}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
                  title="Remove resource"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ResourceSearchPicker
                  applicationId={selectedAppId}
                  onSelect={(r) => setForm((f) => ({ ...f, selectedResource: r }))}
                />
                <span className="text-[11px] text-gray-400">or leave blank for resource-agnostic eval</span>
              </div>
            )}

            {/* Resource attrs preview */}
            {form.selectedResource && (
              <ResourceAttributesPreview resourceId={form.selectedResource.id} />
            )}
          </div>

          {/* ── Action ── */}
          <ActionSection
            form={form}
            setForm={setForm}
            actionDefs={actionDefs}
          />

          {/* ── Environment ── */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Environment</Label>
              {environmentDefs.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  {environmentDefs.length} attr{environmentDefs.length !== 1 ? 's' : ''} defined
                </span>
              )}
            </div>

            {form.environmentAttrs.map((attr, i) => (
              <div key={`env-${i}`} className="flex items-center gap-2">
                {environmentDefs.length > 0 ? (
                  <select
                    value={attr.key}
                    onChange={(e) => {
                      const list = [...form.environmentAttrs];
                      list[i] = { key: e.target.value, value: '' };
                      setForm((f) => ({ ...f, environmentAttrs: list }));
                    }}
                    className="w-40 flex-shrink-0 text-xs border border-gray-200 rounded px-2 py-1.5 font-mono bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="">Select…</option>
                    {environmentDefs.map((d) => (
                      <option key={d.key} value={d.key}>{d.displayName ?? d.key}</option>
                    ))}
                    <option value="__custom__">— custom —</option>
                  </select>
                ) : (
                  <Input
                    placeholder="env.key"
                    value={attr.key}
                    onChange={(e) => {
                      const list = [...form.environmentAttrs];
                      list[i] = { ...list[i], key: e.target.value };
                      setForm((f) => ({ ...f, environmentAttrs: list }));
                    }}
                    className="w-40 flex-shrink-0 font-mono text-sm"
                  />
                )}
                <Input
                  placeholder="value"
                  value={typeof attr.value === 'string' ? attr.value : JSON.stringify(attr.value)}
                  onChange={(e) => {
                    const list = [...form.environmentAttrs];
                    list[i] = { ...list[i], value: e.target.value };
                    setForm((f) => ({ ...f, environmentAttrs: list }));
                  }}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setForm((f) => ({ ...f, environmentAttrs: f.environmentAttrs.filter((_, idx) => idx !== i) }))}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                </Button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, environmentAttrs: [...f.environmentAttrs, { key: '', value: '' }] }))}
              className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
            >
              + Add
            </button>
          </div>

        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-3">
          <PayloadPreview form={form} actionDefs={actionDefs} coerceValue={coerceValue} actionAttrsToObject={actionAttrsToObject} />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => handleTest(false)}
              disabled={!canEvaluate}
            >
              {evaluateMutation.isPending ? 'Evaluating…' : 'Evaluate'}
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => handleTest(true)}
              disabled={!canEvaluate}
              title="Includes draft policies without writing to audit logs"
            >
              {evaluateMutation.isPending ? 'Evaluating…' : 'Dry-run'}
            </Button>
          </div>
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

              {/* Decision banner */}
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
                  <p className={`text-sm mt-1 ${result.effect === 'PERMIT' ? 'text-green-600' : 'text-red-700'}`}>
                    {result.reason || (result.effect === 'PERMIT' ? 'Decision reached.' : 'No matching PERMIT policy.')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Eval Time</span>
                  <p className="text-lg font-mono text-gray-700">{durationMs != null ? `${durationMs} ms` : '—'}</p>
                </div>
              </div>

              <ResolvedAttributesPanel attrs={result.resolvedAttributes} defaultOpen={result.effect !== 'PERMIT'} />

              {/* Matched policies */}
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
                            {isDecisiveDeny && <span className="text-red-500 text-xs shrink-0">▶</span>}
                            <span className={`font-medium truncate ${isDecisiveDeny ? 'text-red-800' : 'text-gray-800'}`}>
                              {p.policyName ?? p.name ?? 'Policy'}
                            </span>
                            {isDecisiveDeny && <span className="text-[10px] text-red-600 font-semibold shrink-0">decisive</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {p.isDraft && (
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded uppercase">draft</span>
                            )}
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">{p.scope}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              p.effect === 'PERMIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>{p.effect}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Condition failed */}
              {result.conditionFailedPolicies?.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Condition Failed</Label>
                  <div className="space-y-2">
                    {result.conditionFailedPolicies.map((p, i) => (
                      <div key={`cf-${p.policyId ?? i}`} className="bg-white border border-gray-200 p-3 rounded text-sm flex justify-between items-center opacity-60">
                        <span className="font-medium text-gray-700">{p.policyName ?? 'Policy'}</span>
                        <div className="flex items-center gap-2">
                          {p.isDraft && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded uppercase">draft</span>}
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
                  {result.targetExcludedCount} {result.targetExcludedCount === 1 ? 'policy was' : 'policies were'} excluded by target filter.
                </p>
              )}

              {/* Obligations */}
              {result.obligations?.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Obligations Triggered</Label>
                  <pre className="bg-gray-800 text-green-400 p-4 rounded text-xs font-mono overflow-x-auto shadow-inner">
                    {JSON.stringify(result.obligations, null, 2)}
                  </pre>
                </div>
              )}

              {/* Skipped drafts */}
              {result.skippedDraftPolicies?.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Draft Policies Skipped</Label>
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
                    <p className="text-xs text-amber-700 font-medium">
                      Use <span className="font-bold">Dry-run</span> to include these in evaluation.
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

              {/* Coverage gaps */}
              {result.coverageGaps?.length > 0 && (
                <div>
                  <Label className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Coverage Gaps</Label>
                  <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded p-3 space-y-1">
                    {result.coverageGaps.map((g, i) => <li key={i}>{g}</li>)}
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
