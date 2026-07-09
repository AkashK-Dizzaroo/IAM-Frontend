import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, Check } from 'lucide-react';

// Shared between GlobalPoliciesPage and AppPoliciesPage — both pages build and
// render the same AND/OR condition-tree data structure, just against different
// attribute scopes. Anything here must stay behaviorally identical for both
// callers; page-specific pieces (ConditionRow, PolicyConditionBuilder,
// HierarchicalActionPopover, the editor/create panels) intentionally stay in
// each page file because their behavior genuinely diverges.

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

export function EffectBadge({ effect }) {
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded-full
      text-[10px] font-semibold uppercase tracking-wide
      ${(effect === 'PERMIT' || effect === 'ALLOW')
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700'
      }
    `}>
      {effect === 'PERMIT' || effect === 'ALLOW' ? 'ALLOW' : 'DENY'}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    active:   'bg-green-100 text-green-700',
    draft:    'bg-amber-100 text-amber-700',
    archived: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded-full
      text-[10px] font-medium
      ${map[status] ?? map.draft}
    `}>
      {status}
    </span>
  );
}

export function MultiValueDropdown({ allowedValues = [], selectedValues = [], onChange, disabled }) {
  const allStrings = allowedValues.map(v => String(v));
  const selected = Array.isArray(selectedValues) ? selectedValues.map(v => String(v)) : [];
  const allSelected = allStrings.length > 0 && allStrings.every(v => selected.includes(v));
  const someSelected = selected.length > 0 && !allSelected;

  const summary =
    selected.length === 0
      ? 'Select values...'
      : allSelected
        ? 'All selected'
        : selected.length <= 2
          ? selected.join(', ')
          : `${selected.length} of ${allStrings.length} selected`;

  const toggleValue = (value, checked) => {
    const val = String(value);
    if (checked) {
      onChange(Array.from(new Set([...selected, val])));
    } else {
      onChange(selected.filter(v => v !== val));
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...allStrings]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="flex-1 min-w-0 h-8 px-2 justify-between text-xs font-normal"
        >
          <span className="truncate text-left">{summary}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
        {allStrings.length > 1 && (
          <>
            <div
              role="option"
              tabIndex={0}
              aria-selected={allSelected}
              className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50"
              onClick={toggleAll}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleAll();
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
                  onCheckedChange={toggleAll}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="font-medium text-gray-700">Select all</span>
              </div>
              {allSelected && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className="my-1 border-t border-gray-100" />
          </>
        )}
        <div className="max-h-52 overflow-auto">
          {allStrings.map((value) => {
            const checked = selected.includes(value);
            return (
              <div
                key={value}
                role="option"
                tabIndex={0}
                aria-selected={checked}
                className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleValue(value, !checked)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleValue(value, !checked);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => toggleValue(value, !!next)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>{value}</span>
                </div>
                {checked && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Condition tree helpers
// ---------------------------------------------------------------------------

export const DEFAULT_CONDITIONS = {
  operator: 'AND',
  conditions: []
};

export function normalizeConditions(raw) {
  if (!raw || Object.keys(raw).length === 0) {
    return { operator: 'AND', conditions: [] };
  }
  if ('operator' in raw && 'conditions' in raw) {
    return raw;
  }
  if ('op' in raw) {
    return { operator: 'AND', conditions: [raw] };
  }
  return DEFAULT_CONDITIONS;
}

export const NAMESPACES = ['subject', 'resource', 'action', 'environment'];
export const OPERATORS = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
  'in', 'not_in', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'matches',
  'exists', 'not_exists'
];

export const NO_VALUE_OPS = new Set(['exists', 'not_exists']);
export const ARRAY_OPS = new Set(['in', 'not_in']);

// Recursively collect all leaf condition nodes from the tree
export function collectLeaves(node) {
  if (!node) return [];
  if ('op' in node) return [node];
  if (Array.isArray(node.conditions)) {
    return node.conditions.flatMap(collectLeaves);
  }
  return [];
}

// Returns an array of error strings; empty array = valid
export function validatePolicyForm(form) {
  const errors = [];

  if (!form.name?.trim()) {
    errors.push('Policy name is required.');
  } else if (form.name.trim().length > 255) {
    errors.push('Policy name must be 255 characters or less.');
  }

  const leaves = collectLeaves(form.conditions);
  leaves.forEach((leaf, i) => {
    const num = i + 1;
    if (!leaf.key?.trim()) {
      errors.push(`Condition ${num}: attribute key is required.`);
    }
    if (!NO_VALUE_OPS.has(leaf.op)) {
      const v = leaf.value;
      const isEmpty = v === '' || v === null || v === undefined ||
        (Array.isArray(v) && v.length === 0);
      const allowsDynamicSubjectAccessValue =
        (leaf.op === 'contains' || leaf.op === 'not_contains') &&
        String(leaf.namespace || '').toLowerCase() === 'subject' &&
        ['study_access', 'resource_access'].includes(String(leaf.key || '').trim().toLowerCase());
      if (isEmpty && !allowsDynamicSubjectAccessValue) {
        errors.push(`Condition ${num}: value is required for operator "${leaf.op}".`);
      }
    }
  });

  return errors;
}

// ---------------------------------------------------------------------------
// ConditionGroupRenderer — recursive AND/OR condition-tree renderer.
//
// Leaf nodes are rendered via the caller-supplied ConditionRowComponent
// instead of a hardcoded <ConditionRow>, because the two pages' attribute-key
// inputs genuinely differ (GlobalPoliciesPage uses a plain <select>;
// AppPoliciesPage uses a Radix <Select> with hub/app attribute grouping).
//
// lockOperator locks only the root group to AND (AppPoliciesPage ANDs the
// condition tree with its role/tab matrix); it is intentionally NOT
// propagated to nested groups, so nested OR groups remain freely switchable
// in both pages.
// ---------------------------------------------------------------------------

export function ConditionGroupRenderer({
  tree, onChange, disabled, attributeDefs, depth = 0, lockOperator = false, ConditionRowComponent,
}) {
  const updateOperator = (op) => { if (!disabled) onChange({ ...tree, operator: op }); };
  const updateChild = (i, newNode) => onChange({ ...tree, conditions: tree.conditions.map((c, idx) => idx === i ? newNode : c) });
  const removeChild = (i) => onChange({ ...tree, conditions: tree.conditions.filter((_, idx) => idx !== i) });

  const addLeaf = () => onChange({ ...tree, conditions: [...tree.conditions, { namespace: 'subject', key: '', op: 'eq', value: '' }] });

  return (
    <div className={depth > 0 ? 'border-l-2 border-gray-200 pl-3 ml-2 mt-1' : ''}>
      <div className="flex items-center gap-2 mb-2">
        {lockOperator ? (
          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-gray-200 bg-primary text-white">AND</span>
        ) : (
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            {['AND', 'OR'].map(op => (
              <button key={op} type="button" disabled={disabled} onClick={() => updateOperator(op)}
                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${tree.operator === op ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >{op}</button>
            ))}
          </div>
        )}
        <span className="text-xs text-gray-400">
          {(lockOperator ? 'AND' : tree.operator) === 'AND' ? 'all conditions must match' : 'any condition must match'}
        </span>
      </div>

      <div className="space-y-2">
        {tree.conditions.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-xs text-gray-400 text-center">
            No conditions — add one below.
          </div>
        )}
        {tree.conditions.map((child, i) => {
          if (child && typeof child === 'object' && 'operator' in child && 'conditions' in child) {
            return (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-2.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <ConditionGroupRenderer tree={child} onChange={newGroup => updateChild(i, newGroup)}
                      disabled={disabled} attributeDefs={attributeDefs} depth={depth + 1}
                      ConditionRowComponent={ConditionRowComponent}
                    />
                  </div>
                  <button type="button" onClick={() => removeChild(i)} disabled={disabled}
                    className="w-6 h-6 flex items-center justify-center shrink-0 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors mt-0.5"
                  >×</button>
                </div>
              </div>
            );
          }
          return (
            <ConditionRowComponent key={i} condition={child}
              onChange={(field, val) => updateChild(i, { ...child, [field]: val })}
              onRemove={() => removeChild(i)} canRemove disabled={disabled} attributeDefs={attributeDefs}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <button type="button" disabled={disabled} onClick={addLeaf}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        ><span className="text-base leading-none">+</span> Condition</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConditionJsonEditor
// ---------------------------------------------------------------------------

export function ConditionJsonEditor({ tree, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState('');
  const [parseError, setParseError] = useState('');

  const jsonStr = JSON.stringify(tree, null, 2);

  const enterEdit = () => {
    setDraft(jsonStr);
    setParseError('');
    setEditMode(true);
  };

  const exitEdit = () => {
    setEditMode(false);
    setParseError('');
  };

  const handleChange = (text) => {
    setDraft(text);
    setParseError('');
  };

  // Tries to extract a condition tree from whatever the user pasted.
  // Handles: raw tree, `{"conditions": {...}}` wrapper, or `"conditions": {...}` fragment.
  const parseConditionInput = (text) => {
    // 1. Try raw JSON first
    try {
      return normalizeConditions(JSON.parse(text));
    } catch (_) { /* fall through */ }

    // 2. Try wrapping the fragment: `"conditions": {...}` → valid JSON object
    const trimmed = text.trim();
    try {
      const wrapped = JSON.parse(`{${trimmed}}`);
      if (wrapped.conditions !== undefined) {
        return normalizeConditions(wrapped.conditions);
      }
    } catch (_) { /* fall through */ }

    // 3. Nothing worked — re-throw so caller can show the error
    throw new SyntaxError('Could not parse as a condition tree. Paste the full condition object or just the tree value.');
  };

  const handlePaste = (e) => {
    if (disabled) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    try {
      const normalized = parseConditionInput(pasted);
      onChange(normalized);
      setDraft(JSON.stringify(normalized, null, 2));
      setParseError('');
    } catch {
      setDraft(pasted);
    }
  };

  const applyDraft = () => {
    try {
      const normalized = parseConditionInput(draft);
      onChange(normalized);
      setParseError('');
      setEditMode(false);
    } catch (err) {
      setParseError(`Invalid JSON: ${err.message}`);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <button
          type="button"
          onClick={() => { setOpen(o => !o); if (editMode) exitEdit(); }}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
        >
          <span className="font-mono">Condition JSON</span>
          <span className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {open && !disabled && (
          <div className="flex items-center gap-1">
            {editMode ? (
              <>
                <button
                  type="button"
                  onClick={applyDraft}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={exitEdit}
                  className="px-2 py-0.5 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={enterEdit}
                className="px-2 py-0.5 text-[11px] font-medium text-primary border border-primary/30 rounded hover:bg-primary/5 transition-colors"
              >
                Edit JSON
              </button>
            )}
          </div>
        )}
      </div>
      {open && (
        <div className="border-t border-gray-200">
          {editMode ? (
            <div className="relative">
              <textarea
                value={draft}
                onChange={e => handleChange(e.target.value)}
                onPaste={handlePaste}
                spellCheck={false}
                className="
                  w-full px-3 py-3 text-[11px] font-mono
                  text-gray-900 bg-white resize-none
                  focus:outline-none focus:ring-1 focus:ring-primary/30
                  min-h-[120px] max-h-64
                "
                placeholder='Paste condition JSON here, e.g. {"operator":"AND","conditions":[...]}'
                style={{ overflowY: 'auto' }}
              />
              {parseError && (
                <div className="px-3 pb-2 text-[11px] text-red-500 font-medium">
                  {parseError}
                </div>
              )}
              <div className="px-3 pb-2 text-[10px] text-gray-400">
                Paste JSON to auto-apply, or type and click Apply.
              </div>
            </div>
          ) : (
            <pre className="
              px-3 py-3 text-[11px] font-mono
              text-gray-700 bg-white overflow-x-auto
              max-h-40 overflow-y-auto
            ">
              {jsonStr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// buildActionTree — currently only consumed by AppPoliciesPage's
// ActionTabSelector. (Its sibling helpers getLeafValues/ActionTreeNode were
// found to be dead code in both pages — HierarchicalActionPopover renders a
// flat list, not a tree — and were deleted rather than shared.)
// ---------------------------------------------------------------------------

export function buildActionTree(actionAttrs) {
  const roots = actionAttrs.filter(a => !a.parentId);
  const childMap = {};
  actionAttrs.forEach(a => {
    if (a.parentId) {
      if (!childMap[a.parentId]) childMap[a.parentId] = [];
      childMap[a.parentId].push(a);
    }
  });
  return { roots, childMap };
}

// ---------------------------------------------------------------------------
// VersionHistory
// ---------------------------------------------------------------------------

export function VersionHistory({ versions, currentVersion, onRollback, rolling, readOnly }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="
          flex items-center gap-2 text-xs font-medium
          text-gray-500 uppercase tracking-wider
          hover:text-gray-700 transition-colors
        "
      >
        <span className={`transition-transform duration-150
          ${open ? 'rotate-90' : ''}`}>▶</span>
        Version History ({versions.length})
      </button>
      {open && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-100">
          {versions.map(v => (
            <div key={v.id}
              className="flex items-center justify-between
                         py-2 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className={`
                  text-xs font-mono font-semibold
                  ${v.version === currentVersion
                    ? 'text-primary' : 'text-gray-500'
                  }
                `}>
                  v{v.version}
                </span>
                {v.version === currentVersion && (
                  <span className="text-[10px] bg-primary/10
                    text-primary px-1.5 py-0.5 rounded-full
                    font-medium">
                    current
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(
                    new Date(v.createdAt),
                    { addSuffix: true }
                  )}
                </span>
                {v.snapshot?.restoredFrom && (
                  <span className="text-[10px] text-amber-600">
                    restored from v{v.snapshot.restoredFrom}
                  </span>
                )}
              </div>
              {v.version !== currentVersion && !readOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRollback(v.version)}
                  disabled={rolling}
                  className="text-xs h-6 px-2"
                >
                  Restore
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyEditorState
// ---------------------------------------------------------------------------

export function EmptyEditorState({ onNewPolicy }) {
  return (
    <div className="flex-1 flex flex-col items-center
                    justify-center text-center p-8">
      <div className="w-12 h-12 rounded-full bg-gray-100
                      flex items-center justify-center mb-4">
        <svg width="24" height="24" fill="none"
          stroke="#9CA3AF" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12
                   a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <p className="font-medium text-gray-900 mb-1">
        Select a policy
      </p>
      <p className="text-sm text-gray-500 mb-4">
        Choose a policy from the list to view and edit it,
        or create a new one.
      </p>
      <Button variant="outline" size="sm" onClick={onNewPolicy}>
        + New Policy
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PolicyListPanel
// ---------------------------------------------------------------------------

export function PolicyListPanel({
  policies, loading, selectedPolicyId, onSelect,
  listFilter, setListFilter, listSearch, setListSearch,
  onNewPolicy,
  panelTitle = 'Global Policies',
  createFirstHint = 'Create your first global policy',
}) {
  return (
    <div className="
      w-80 flex-shrink-0 flex flex-col
      border-r border-gray-100 bg-white
      h-full overflow-hidden
    ">
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-semibold text-gray-900">
            {panelTitle}
          </h1>
          <Button size="sm" onClick={onNewPolicy}>
            + New
          </Button>
        </div>
        <Input
          placeholder="Search policies..."
          value={listSearch}
          onChange={e => setListSearch(e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="flex border-b border-gray-100">
        {['all', 'active', 'draft', 'archived'].map(f => (
          <button
            key={f}
            onClick={() => setListFilter(f)}
            className={`
              flex-1 py-2 text-xs font-medium capitalize
              transition-colors border-b-2
              ${listFilter === f
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-1 p-2">
            {[...new Array(4)].map((_, i) => (
              <div key={i}
                className="h-16 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && policies.length === 0 && (
          <div className="flex flex-col items-center
                          justify-center py-12 text-center px-4">
            <p className="text-sm font-medium text-gray-900 mb-1">
              No policies
            </p>
            <p className="text-xs text-gray-500">
              {listFilter !== 'all'
                ? `No ${listFilter} policies`
                : createFirstHint
              }
            </p>
          </div>
        )}

        {!loading && policies.map(policy => (
          <button
            key={policy.id}
            onClick={() => onSelect(policy.id)}
            className={`
              w-full text-left px-5 py-4
              border-b border-gray-100
              transition-colors hover:bg-gray-50
              ${selectedPolicyId === policy.id
                ? 'bg-primary/5 border-l-4 border-l-primary'
                : 'border-l-4 border-l-transparent'
              }
            `}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <span className="font-semibold text-sm text-gray-900 line-clamp-1">
                {policy.name}
              </span>
              <EffectBadge effect={policy.effect} />
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <StatusBadge status={policy.status} />
              <span className="text-xs font-medium text-gray-400">
                Priority {policy.priority}
              </span>
            </div>
            {policy.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">
                {policy.description}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
