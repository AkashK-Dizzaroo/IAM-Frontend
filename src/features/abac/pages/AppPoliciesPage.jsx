import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { abacService } from '../api/abacService';
import { useAbacScope } from '../contexts/AbacScopeContext';
import { Lock, Globe2, ChevronDown, ChevronRight, Info, Tag, Settings, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function EffectBadge({ effect }) {
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

function StatusBadge({ status }) {
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

function MultiValueDropdown({ allowedValues = [], selectedValues = [], onChange, disabled }) {
  const selected = Array.isArray(selectedValues) ? selectedValues.map(v => String(v)) : [];
  const summary =
    selected.length === 0
      ? 'Select values...'
      : selected.length <= 2
        ? selected.join(', ')
        : `${selected.length} selected`;

  const toggleValue = (value, checked) => {
    const val = String(value);
    if (checked) {
      onChange(Array.from(new Set([...selected, val])));
    } else {
      onChange(selected.filter(v => v !== val));
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
        <div className="max-h-56 overflow-auto">
          {allowedValues.map((v) => {
            const value = String(v);
            const checked = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-gray-50"
                onClick={() => toggleValue(value, !checked)}
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
              </button>
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

const DEFAULT_CONDITIONS = {
  operator: 'AND',
  conditions: []
};

function normalizeConditions(raw) {
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

const NAMESPACES = ['subject', 'resource', 'action', 'environment'];
const OPERATORS = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
  'in', 'not_in', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'matches',
  'exists', 'not_exists'
];

const NO_VALUE_OPS = new Set(['exists', 'not_exists']);

function collectLeaves(node) {
  if (!node) return [];
  if ('op' in node) return [node];
  if (Array.isArray(node.conditions)) {
    return node.conditions.flatMap(collectLeaves);
  }
  return [];
}

function validatePolicyForm(form) {
  const errors = [];

  if (!form.name?.trim()) {
    errors.push('Policy name is required.');
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
      if (isEmpty) {
        errors.push(`Condition ${num}: value is required for operator "${leaf.op}".`);
      }
    }
  });

  return errors;
}

// ---------------------------------------------------------------------------
// ConditionRow
// ---------------------------------------------------------------------------

const ARRAY_OPS = new Set(['in', 'not_in']);

function ConditionRow({ condition, onChange, onRemove, canRemove, disabled, attributeDefs = [] }) {
  const noValue = ['exists', 'not_exists'].includes(condition.op);
  const isArrayOp = ARRAY_OPS.has(condition.op);

  const filteredAttrs = attributeDefs.filter(attr => attr.namespace === condition.namespace);
  // When operator switches, coerce value type
  const handleOpChange = (e) => {
    const newOp = e.target.value;
    const switchingToArray = ARRAY_OPS.has(newOp) && !isArrayOp;
    const switchingFromArray = !ARRAY_OPS.has(newOp) && isArrayOp;
    if (switchingToArray) {
      const cur = condition.value;
      onChange('value', cur ? [cur] : []);
    } else if (switchingFromArray) {
      onChange('value', Array.isArray(condition.value) ? condition.value.join(', ') : '');
    }
    onChange('op', newOp);
  };

  // Resolve the selected attr definition for smart value inputs
  const selectedAttr = filteredAttrs.find(a => a.key === condition.key);
  let constraints = selectedAttr?.constraints || {};
  if (typeof constraints === 'string') {
    try { constraints = JSON.parse(constraints); } catch { constraints = {}; }
  }
  const allowedValues = constraints.allowedValues;
  const dataType = selectedAttr?.dataType;

  const valueInput = !noValue && (() => {
    if (allowedValues && Array.isArray(allowedValues)) {
      if (isArrayOp) {
        return (
          <MultiValueDropdown
            allowedValues={allowedValues}
            selectedValues={condition.value}
            disabled={disabled}
            onChange={(values) => onChange('value', values)}
          />
        );
      }

      return (
        <select
          disabled={disabled}
          value={condition.value ?? ''}
          onChange={e => onChange('value', e.target.value)}
          className="
            flex-1 min-w-0 text-xs border border-gray-200
            rounded px-2 py-1.5
            bg-white text-gray-900
            focus:outline-none focus:ring-1
            focus:ring-primary/30 focus:border-primary
          "
        >
          <option value="">Select value...</option>
          {allowedValues.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      );
    }
    if (dataType === 'boolean' && !isArrayOp) {
      return (
        <select
          disabled={disabled}
          value={String(condition.value ?? '')}
          onChange={e => onChange('value', e.target.value === 'true')}
          className="
            flex-1 min-w-0 text-xs border border-gray-200
            rounded px-2 py-1.5
            bg-white text-gray-900
            focus:outline-none focus:ring-1
            focus:ring-primary/30 focus:border-primary
          "
        >
          <option value="">Select...</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }
    return (
      <input
        disabled={disabled}
        type={dataType === 'number' ? 'number' : 'text'}
        maxLength={constraints.maxLength}
        pattern={constraints.pattern}
        placeholder={isArrayOp ? 'val1, val2, … or @namespace.attr' : 'value or @namespace.attr'}
        title={isArrayOp
          ? 'Comma-separated list of values, or @namespace.attr to reference another attribute'
          : constraints.pattern ? `Pattern: ${constraints.pattern}` : 'Use @namespace.attr (e.g. @subject.study_access) to compare against another attribute'
        }
        value={
          isArrayOp && Array.isArray(condition.value)
            ? condition.value.join(', ')
            : condition.value ?? ''
        }
        onChange={e => {
          const raw = e.target.value;
          if (isArrayOp) {
            const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
            onChange('value', raw.trimEnd().endsWith(',') ? [...arr, ''] : arr);
          } else {
            onChange('value', raw);
          }
        }}
        className="
          flex-1 min-w-0 text-xs border border-gray-200
          rounded px-2 py-1.5 font-mono
          bg-white text-gray-900 placeholder-gray-400
          focus:outline-none focus:ring-1
          focus:ring-primary/30 focus:border-primary
        "
      />
    );
  })();

  return (
    <div className="
      flex items-start gap-2 p-2.5 rounded-lg
      bg-gray-50 border border-gray-200
      group
    ">
      {/* 1. Namespace */}
      <select
        disabled={disabled}
        value={condition.namespace}
        onChange={e => onChange('namespace', e.target.value)}
        className="
          text-xs border border-gray-200 rounded px-2 py-1.5
          bg-white text-gray-700 focus:outline-none
          focus:ring-1 focus:ring-primary/30 focus:border-primary
          shrink-0
        "
      >
        {NAMESPACES.map(ns => (
          <option key={ns} value={ns}>{ns}</option>
        ))}
      </select>

      {/* 2. Attribute key — dropdown when attrs exist, text fallback with hint when empty */}
      {filteredAttrs.length > 0 ? (
        <select
          disabled={disabled}
          value={condition.key}
          onChange={e => onChange('key', e.target.value)}
          className="
            flex-1 min-w-0 text-xs border border-gray-200
            rounded px-2 py-1.5 font-mono
            bg-white text-gray-900
            focus:outline-none focus:ring-1
            focus:ring-primary/30 focus:border-primary
          "
        >
          <option value="">Select attribute...</option>
          {filteredAttrs.map(attr => (
            <option key={attr.key} value={attr.key}>
              {attr.displayName || attr.key}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <input
            disabled={disabled}
            type="text"
            placeholder="attribute.key"
            value={condition.key}
            onChange={e => onChange('key', e.target.value)}
            className="
              w-full text-xs border border-gray-200
              rounded px-2 py-1.5 font-mono
              bg-white text-gray-900 placeholder-gray-400
              focus:outline-none focus:ring-1
              focus:ring-primary/30 focus:border-primary
            "
          />
          <span className="text-[10px] text-amber-600 leading-tight">
            No attributes defined for &quot;{condition.namespace}&quot; — define them in App Attributes first
          </span>
        </div>
      )}

      {/* 3. Operator — NOW before value for natural key → op → value reading order */}
      <select
        disabled={disabled}
        value={condition.op}
        onChange={handleOpChange}
        className="
          text-xs border border-gray-200 rounded px-2 py-1.5
          bg-white text-gray-700 focus:outline-none
          focus:ring-1 focus:ring-primary/30 focus:border-primary
          shrink-0
        "
      >
        {OPERATORS.map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>

      {/* 4. Value */}
      {!noValue && valueInput}

      {/* 5. Remove */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || !canRemove}
        className="
          w-6 h-6 flex items-center justify-center shrink-0
          rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50
          transition-colors disabled:opacity-0
        "
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConditionJsonPreview
// ---------------------------------------------------------------------------

function ConditionJsonPreview({ tree }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="
          w-full flex items-center justify-between
          px-3 py-2 bg-gray-50 text-xs font-medium
          text-gray-600 hover:bg-gray-100 transition-colors
        "
      >
        <span className="font-mono">Condition JSON</span>
        <span className={`transition-transform duration-150
          ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && (
        <pre className="
          px-3 py-3 text-[11px] font-mono
          text-gray-700 bg-white overflow-x-auto
          border-t border-gray-200
          max-h-40 overflow-y-auto
        ">
          {JSON.stringify(tree, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConditionTreeBuilder
// ---------------------------------------------------------------------------

function ConditionTreeBuilder({ value, onChange, disabled, attributeDefs }) {
  const tree = normalizeConditions(value);

  const updateOperator = (operator) => {
    if (disabled) return;
    onChange({ ...tree, operator });
  };

  const updateCondition = (index, field, val) => {
    if (disabled) return;
    const updated = tree.conditions.map((c, i) =>
      i === index ? { ...c, [field]: val } : c
    );
    onChange({ ...tree, conditions: updated });
  };

  const addCondition = () => {
    if (disabled) return;
    onChange({
      ...tree,
      conditions: [
        ...tree.conditions,
        { namespace: 'subject', key: '', op: 'eq', value: '' }
      ]
    });
  };

  const removeCondition = (index) => {
    if (disabled || tree.conditions.length <= 0) return;
    onChange({
      ...tree,
      conditions: tree.conditions.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">
          Match
        </span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {['AND', 'OR'].map(op => (
            <button
              key={op}
              type="button"
              disabled={disabled}
              onClick={() => updateOperator(op)}
              className={`
                px-3 py-1 text-xs font-semibold
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${tree.operator === op
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              {op}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">
          {tree.operator === 'AND'
            ? 'all of the following conditions'
            : 'any of the following conditions'
          }
        </span>
      </div>

      <div className="space-y-2">
        {tree.conditions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            No conditions configured. This policy applies to all requests.
          </div>
        ) : (
          tree.conditions.map((cond, index) => (
            <ConditionRow
              key={index}
              condition={cond}
              disabled={disabled}
              attributeDefs={attributeDefs}
              onChange={(field, val) => updateCondition(index, field, val)}
              onRemove={() => removeCondition(index)}
              canRemove={tree.conditions.length > 0}
            />
          ))
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={addCondition}
        className="
          flex items-center gap-1.5 text-sm text-primary
          hover:text-primary/80 font-medium transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-primary
        "
      >
        <span className="text-lg leading-none">+</span>
        Add Condition
      </button>

      <ConditionJsonPreview tree={tree} />
    </div>
  );
}

// TargetSection and ObligationsSection removed as per requirements



// ---------------------------------------------------------------------------
// VersionHistory
// ---------------------------------------------------------------------------

function VersionHistory({ versions, currentVersion, onRollback, rolling, readOnly }) {
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

function EmptyEditorState({ onNewPolicy }) {
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

function PolicyListPanel({
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
            {[...Array(4)].map((_, i) => (
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

// ---------------------------------------------------------------------------
// PolicyEditorPanel
// ---------------------------------------------------------------------------

function PolicyEditorPanel({ policy, versions, onDelete, appKey, attributeDefs }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(null);
  const isArchived = policy.status === 'archived';

  useEffect(() => {
    if (policy) {
      setForm({
        name:        policy.name,
        description: policy.description ?? '',
        priority:    policy.priority,
        effect:      policy.effect === 'PERMIT' ? 'ALLOW' : policy.effect,
        conditions:  policy.conditions,
      });
    }
  }, [policy?.id]);

  const isDirty = form && policy && (
    form.name !== policy.name ||
    form.description !== (policy.description ?? '') ||
    form.priority !== policy.priority ||
    form.effect !== (policy.effect === 'PERMIT' ? 'ALLOW' : policy.effect) ||
    JSON.stringify(form.conditions) !== JSON.stringify(policy.conditions)
  );

  const updateMutation = useMutation({
    mutationFn: (data) =>
      abacService.updateAppPolicy(appKey, policy.id, data),
    onSuccess: () => {
      toast({ title: 'Policy saved' });
      queryClient.invalidateQueries(['abac', 'appPolicy', appKey, policy.id]);
      queryClient.invalidateQueries(['abac', 'appPolicies', appKey]);
      queryClient.invalidateQueries(['abac', 'appPolicyVersions', appKey, policy.id]);
    },
    onError: (err) => toast({
      title: 'Save failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const statusMutation = useMutation({
    mutationFn: (status) =>
      abacService.setAppPolicyStatus(appKey, policy.id, status),
    onSuccess: (_, status) => {
      toast({ title: `Policy ${status}` });
      queryClient.invalidateQueries(['abac', 'appPolicies', appKey]);
      queryClient.invalidateQueries(['abac', 'appPolicy', appKey, policy.id]);
    },
    onError: (err) => toast({
      title: 'Status change failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (version) =>
      abacService.rollbackAppPolicy(appKey, policy.id, version),
    onSuccess: () => {
      toast({ title: 'Rolled back successfully' });
      queryClient.invalidateQueries(['abac', 'appPolicy', appKey, policy.id]);
      queryClient.invalidateQueries(['abac', 'appPolicies', appKey]);
      queryClient.invalidateQueries(['abac', 'appPolicyVersions', appKey, policy.id]);
    },
    onError: (err) => toast({
      title: 'Rollback failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => abacService.deleteAppPolicy(appKey, policy.id),
    onSuccess: () => {
      toast({ title: 'Policy deleted permanently' });
      queryClient.invalidateQueries(['abac', 'appPolicies', appKey]);
      onDelete?.();
    },
    onError: (err) => toast({
      title: 'Delete failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const handleSave = () => {
    const errors = validatePolicyForm(form);
    if (errors.length > 0) {
      toast({
        title: 'Validation error',
        description: errors[0],
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate({
      name:        form.name,
      description: form.description || undefined,
      priority:    parseInt(form.priority) || 10,
      effect:      form.effect,
      conditions:  form.conditions,
    });
  };

  if (!form) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <div className="
        px-6 py-4 bg-white border-b border-gray-100
        flex items-center justify-between flex-shrink-0
      ">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            value={form.name}
            disabled={isArchived}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="
              font-semibold text-lg text-gray-900
              bg-transparent border-0 border-b-2
              border-transparent hover:border-gray-200
              focus:border-primary outline-none
              transition-colors flex-1 min-w-0
              disabled:opacity-80 disabled:cursor-not-allowed
            "
            placeholder="Policy name"
          />
          <EffectBadge effect={form.effect} />
          <StatusBadge status={policy.status} />
          <span className="text-xs text-gray-400 font-mono">
            v{policy.currentVersion}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {policy.status !== 'archived' && (
            <>
              {isDirty && policy.status === 'active' && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mr-1">
                  Editing a live policy — changes take effect immediately on save
                </div>
              )}
              {isDirty && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setForm({
                    name:        policy.name,
                    description: policy.description ?? '',
                    priority:    policy.priority,
                    effect:      policy.effect === 'PERMIT' ? 'ALLOW' : policy.effect,
                    conditions:  policy.conditions,
                  })}
                >
                  Discard
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? 'Saving...'
                  : policy.status === 'active'
                  ? 'Save Changes'
                  : 'Save Draft'}
              </Button>
            </>
          )}

          {policy.status === 'draft' && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => statusMutation.mutate('active')}
              disabled={statusMutation.isPending}
            >
              Publish
            </Button>
          )}
          {policy.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
              onClick={() => statusMutation.mutate('archived')}
              disabled={statusMutation.isPending}
            >
              Archive
            </Button>
          )}
          {policy.status === 'archived' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  if (window.confirm('Are you sure you want to permanently delete this policy? This cannot be undone.')) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => statusMutation.mutate('active')}
                disabled={statusMutation.isPending}
              >
                Restore
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">
              Description
            </Label>
            <Textarea
              value={form.description}
              disabled={isArchived}
              onChange={e => setForm(f => ({
                ...f, description: e.target.value
              }))}
              placeholder="Describe what this policy does..."
              rows={2}
              className="text-sm resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-start gap-6">
            <div className="space-y-1.5 w-32">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Priority
              </Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={form.priority}
                disabled={isArchived}
                onChange={e => setForm(f => ({
                  ...f, priority: e.target.value
                }))}
                className="text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-gray-400">
                Lower = evaluated first
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Effect
              </Label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {['ALLOW', 'DENY'].map(eff => (
                  <button
                    key={eff}
                    type="button"
                    disabled={isArchived}
                    onClick={() => setForm(f => ({ ...f, effect: eff }))}
                    className={`
                      px-4 py-2 text-sm font-semibold
                      transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${form.effect === eff
                        ? eff === 'ALLOW'
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                      }
                    `}
                  >
                    {eff}
                  </button>
                ))}
              </div>
              {form.effect === 'DENY' && !isArchived && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  ⚠ DENY policies block access even if other ALLOW policies match (unless a higher-priority ALLOW overrides).
                </p>
              )}
            </div>
          </div>

          <Separator className="my-2" />

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Conditions
              </Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Leave empty to apply the effect to all requests.
              </p>
            </div>
            <ConditionTreeBuilder
              value={form.conditions}
              onChange={conditions => setForm(f => ({ ...f, conditions }))}
              disabled={isArchived}
              attributeDefs={attributeDefs}
            />
          </div>



          <Separator className="my-2" />

          <VersionHistory
            versions={versions}
            currentVersion={policy.currentVersion}
            onRollback={(v) => rollbackMutation.mutate(v)}
            rolling={rollbackMutation.isPending}
            readOnly={isArchived}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PolicyCreatePanel
// ---------------------------------------------------------------------------

function PolicyCreatePanel({ appKey, createTitle = 'New Global Policy', onClose, onCreated, attributeDefs }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    priority: 10,
    effect: 'ALLOW',
    conditions: DEFAULT_CONDITIONS,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      return abacService.createAppPolicy(appKey, {
        name:        form.name,
        description: form.description || undefined,
        priority:    parseInt(form.priority) || 10,
        effect:      form.effect,
        conditions:  form.conditions,
      });
    },
    onSuccess: (res) => {
      toast({ title: 'Policy created as draft' });
      queryClient.invalidateQueries(['abac', 'appPolicies', appKey]);
      onCreated(
        res.data?.data?.id ?? res.data?.data?._id ?? res.data?.id
      );
      onClose();
    },
    onError: (err) => toast({
      title: 'Creation failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <div className="
        px-6 py-4 bg-white border-b border-gray-100
        flex items-center justify-between flex-shrink-0
      ">
        <h2 className="font-semibold text-gray-900">
          {createTitle}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.name.trim()}
          >
            {createMutation.isPending ? 'Creating...' : 'Create as Draft'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          <div className="space-y-1.5">
            <Label>Policy Name *</Label>
            <Input
              placeholder="e.g. Block suspended users"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="What does this policy do?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="flex items-start gap-4">
            <div className="space-y-1.5 w-32">
              <Label>Priority</Label>
              <Input
                type="number" min={1} max={1000}
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              />
              <p className="text-[11px] text-gray-400">Lower = evaluated first</p>
            </div>
            <div className="space-y-1.5">
              <Label>Effect</Label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {['ALLOW', 'DENY'].map(eff => (
                  <button key={eff} type="button"
                    onClick={() => setForm(f => ({ ...f, effect: eff }))}
                    className={`
                      px-4 py-2 text-sm font-semibold
                      transition-colors
                      ${form.effect === eff
                        ? eff === 'ALLOW'
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                      }
                    `}
                  >
                    {eff}
                  </button>
                ))}
              </div>
              {form.effect === 'DENY' && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  ⚠ DENY policies block access even if other ALLOW policies match (unless a higher-priority ALLOW overrides).
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Conditions
              </Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Leave empty to apply the effect to all requests.
              </p>
            </div>
            <ConditionTreeBuilder
              value={form.conditions}
              onChange={conditions => setForm(f => ({ ...f, conditions }))}
              attributeDefs={attributeDefs}
            />
          </div>


        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HubGlobalConfigTab — always read-only view of hub-level settings
// ---------------------------------------------------------------------------

function HubGlobalConfigTab({ appName }) {
  const [expandedId, setExpandedId] = useState(null);

  const { data: globalPoliciesData, isLoading: policiesLoading } = useQuery({
    queryKey: ['abac', 'globalPolicies', 'active'],
    queryFn: () => abacService.listGlobalPolicies({ status: 'active' }),
    staleTime: 60_000,
  });
  const globalPolicies = globalPoliciesData?.data?.data ?? globalPoliciesData?.data ?? [];

  const { data: hubAttrsData, isLoading: attrsLoading } = useQuery({
    queryKey: ['abac', 'hubAttributes'],
    queryFn: () => abacService.listHubAttrDefs(),
    staleTime: 60_000,
  });
  const hubAttributes = hubAttrsData?.data?.data ?? hubAttrsData?.data ?? [];

  const isLoading = policiesLoading || attrsLoading;

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-6">
        <Lock size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Hub / Global Configuration — Read Only
          </p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            These settings are managed at the Hub/IAM level and{' '}
            <strong>override</strong> any local {appName} policies.
            To make changes, use <strong>Hub Management → Global Policies</strong> in the sidebar.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-8">

          {/* ── Global Policies ─────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe2 size={14} className="text-gray-500" />
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                Global Policies
              </h3>
              <span className="ml-auto text-[10px] text-gray-400">
                {globalPolicies.length} active
              </span>
            </div>

            {globalPolicies.length === 0 ? (
              <div className="px-4 py-8 rounded-xl border border-dashed border-gray-200 text-center">
                <p className="text-sm text-gray-400">No active global policies</p>
              </div>
            ) : (
              <div className="space-y-2">
                {globalPolicies.map(policy => (
                  <div key={policy.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(v => v === policy.id ? null : policy.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className={`
                        flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full
                        text-[10px] font-bold uppercase tracking-wide
                        ${(policy.effect === 'PERMIT' || policy.effect === 'ALLOW') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                      `}>
                        {policy.effect === 'PERMIT' || policy.effect === 'ALLOW' ? 'ALLOW' : 'DENY'}
                      </span>
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                        {policy.name}
                      </span>
                      <span className="flex-shrink-0 text-[10px] text-gray-400 mr-1">
                        Priority {policy.priority}
                      </span>
                      <span className={`
                        flex-shrink-0 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium
                        ${policy.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}
                      `}>
                        {policy.status}
                      </span>
                      <Lock size={11} className="text-amber-400 flex-shrink-0" />
                      {expandedId === policy.id
                        ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
                        : <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />
                      }
                    </button>
                    {expandedId === policy.id && (
                      <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-gray-50/60">
                        {policy.description && (
                          <p className="text-xs text-gray-500 mb-2">{policy.description}</p>
                        )}
                        {(() => {
                          const conds = policy.conditions?.conditions ?? [];
                          const op = policy.conditions?.operator ?? 'AND';
                          if (conds.length === 0) {
                            return (
                              <div className="flex items-center gap-2">
                                <Info size={10} className="text-gray-400" />
                                <span className="text-[11px] text-gray-400">No conditions — policy matches all requests</span>
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Info size={10} className="text-gray-400" />
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                  Conditions ({op})
                                </span>
                              </div>
                              {conds.map((c, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono bg-white border border-gray-100 rounded px-2.5 py-1">
                                  {i > 0 && (
                                    <span className="text-[10px] font-sans font-semibold text-indigo-400 w-7 text-center shrink-0">
                                      {op}
                                    </span>
                                  )}
                                  <span className="text-blue-600">{c.namespace}</span>
                                  <span className="text-gray-300">.</span>
                                  <span className="text-gray-700 font-semibold">{c.key ?? c.attribute}</span>
                                  <span className="text-amber-600 px-1">{c.op ?? c.operator}</span>
                                  <span className="text-green-700">&quot;{String(c.value ?? '')}&quot;</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Hub Attribute Definitions ──────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Tag size={14} className="text-gray-500" />
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                Hub Attribute Definitions
              </h3>
              <span className="ml-auto text-[10px] text-gray-400">
                {hubAttributes.length} defined
              </span>
            </div>

            {hubAttributes.length === 0 ? (
              <div className="px-4 py-8 rounded-xl border border-dashed border-gray-200 text-center">
                <p className="text-sm text-gray-400">No hub attributes defined</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {hubAttributes.map(attr => (
                  <div
                    key={attr.id ?? attr.key}
                    title={attr.description ?? ''}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white select-none"
                  >
                    <Lock size={10} className="text-amber-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {attr.name ?? attr.key}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {attr.dataType ?? attr.type ?? 'string'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppPoliciesPage
// ---------------------------------------------------------------------------

export function AppPoliciesPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const selectedApp = selectedAppKey
    ? { key: selectedAppKey, name: selectedAppName ?? selectedAppKey }
    : null;

  if (!selectedApp) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <span className="text-xl">📦</span>
        </div>
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">
          Please select an application from the dropdown in the sidebar to view its policies.
        </p>
      </div>
    );
  }

  return <AppPoliciesContent appKey={selectedApp.key} appName={selectedApp.name} />;
}

function AppPoliciesContent({ appKey, appName }) {
  const [activeTab, setActiveTab] = useState('app'); // 'hub' | 'app'
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [listFilter, setListFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const { data: policiesData, isLoading: listLoading } = useQuery({
    queryKey: ['abac', 'appPolicies', appKey, listFilter],
    queryFn: () => abacService.listAppPolicies(
      appKey,
      listFilter !== 'all' ? { status: listFilter } : {}
    ),
    staleTime: 30_000,
  });
  const policies = policiesData?.data?.data ?? policiesData?.data ?? [];

  const filteredPolicies = policies.filter(p =>
    !listSearch ||
    p.name.toLowerCase().includes(listSearch.toLowerCase()) ||
    p.description?.toLowerCase().includes(listSearch.toLowerCase())
  );

  const { data: selectedData } = useQuery({
    queryKey: ['abac', 'appPolicy', appKey, selectedPolicyId],
    queryFn: () => abacService.getAppPolicy(appKey, selectedPolicyId),
    enabled: !!selectedPolicyId,
    staleTime: 10_000,
  });
  const selectedPolicy =
    selectedData?.data?.data ?? selectedData?.data ?? null;

  const { data: appAttrsData } = useQuery({
    queryKey: ['abac', 'appAttributes', appKey],
    queryFn: () => abacService.listAppAttrDefs(appKey),
    staleTime: 60_000,
  });

  const { data: hubAttrsData } = useQuery({
    queryKey: ['abac', 'hubAttributes'],
    queryFn: () => abacService.listHubAttrDefs(),
    staleTime: 60_000,
  });

  const hubDefs = hubAttrsData?.data?.data ?? hubAttrsData?.data ?? [];
  const appDefs = appAttrsData?.data?.data ?? appAttrsData?.data ?? [];
  const attributeDefs = [...hubDefs, ...appDefs];

  const { data: versionsData } = useQuery({
    queryKey: ['abac', 'appPolicyVersions', appKey, selectedPolicyId],
    queryFn: () => abacService.getAppPolicyVersions(appKey, selectedPolicyId),
    enabled: !!selectedPolicyId,
    staleTime: 30_000,
  });
  const versions = versionsData?.data?.data ?? versionsData?.data ?? [];

  return (
    <div className="flex flex-col h-full -m-6">

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-end gap-0 bg-white border-b border-gray-200 px-6 pt-4">
        <button
          type="button"
          onClick={() => setActiveTab('hub')}
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2
            transition-colors
            ${activeTab === 'hub'
              ? 'border-amber-500 text-amber-700 bg-amber-50/60'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          <Globe2 size={14} />
          Hub / Global Config
          <Lock size={11} className="text-amber-400" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('app')}
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2
            transition-colors
            ${activeTab === 'app'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          <Settings size={14} />
          {appName} — App Policies
        </button>
      </div>

      {/* ── Tab: Hub / Global Config (always read-only) ────────────── */}
      {activeTab === 'hub' && (
        <HubGlobalConfigTab appName={appName} />
      )}

      {/* ── Tab: App-Level Policies (editable) ─────────────────────── */}
      {activeTab === 'app' && (
        <div className="flex flex-1 min-h-0">
          <PolicyListPanel
            policies={filteredPolicies}
            loading={listLoading}
            selectedPolicyId={showCreatePanel ? null : selectedPolicyId}
            onSelect={(id) => {
              setSelectedPolicyId(id);
              setShowCreatePanel(false);
            }}
            listFilter={listFilter}
            setListFilter={setListFilter}
            listSearch={listSearch}
            setListSearch={setListSearch}
            onNewPolicy={() => {
              setShowCreatePanel(true);
              setSelectedPolicyId(null);
            }}
            panelTitle={`${appName} Policies`}
            createFirstHint="Create your first app policy"
          />

          {showCreatePanel && (
            <PolicyCreatePanel
              appKey={appKey}
              createTitle="New App Policy"
              attributeDefs={attributeDefs}
              onClose={() => setShowCreatePanel(false)}
              onCreated={(id) => {
                setSelectedPolicyId(id);
                setShowCreatePanel(false);
              }}
            />
          )}

          {!showCreatePanel && selectedPolicyId && selectedPolicy && (
            <PolicyEditorPanel
              appKey={appKey}
              policy={selectedPolicy}
              versions={versions}
              attributeDefs={attributeDefs}
              onDelete={() => {
                setSelectedPolicyId(null);
              }}
            />
          )}

          {!showCreatePanel && !selectedPolicyId && (
            <EmptyEditorState
              onNewPolicy={() => setShowCreatePanel(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
