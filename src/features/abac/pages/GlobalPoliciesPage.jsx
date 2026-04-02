import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { abacService } from '../api/abacService';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function EffectBadge({ effect }) {
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded-full
      text-[10px] font-semibold uppercase tracking-wide
      ${effect === 'PERMIT'
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700'
      }
    `}>
      {effect}
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

// ---------------------------------------------------------------------------
// Condition tree helpers
// ---------------------------------------------------------------------------

const DEFAULT_CONDITIONS = {
  operator: 'AND',
  conditions: [
    { namespace: 'subject', key: '', op: 'eq', value: '' }
  ]
};

function normalizeConditions(raw) {
  if (!raw || Object.keys(raw).length === 0) {
    return DEFAULT_CONDITIONS;
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

// ---------------------------------------------------------------------------
// ConditionRow
// ---------------------------------------------------------------------------

function ConditionRow({ condition, onChange, onRemove, canRemove, disabled }) {
  const noValue = ['exists', 'not_exists'].includes(condition.op);

  return (
    <div className="
      flex items-center gap-2 p-2.5 rounded-lg
      bg-gray-50 border border-gray-200
      group
    ">
      <select
        disabled={disabled}
        value={condition.namespace}
        onChange={e => onChange('namespace', e.target.value)}
        className="
          text-xs border border-gray-200 rounded px-2 py-1.5
          bg-white text-gray-700 focus:outline-none
          focus:ring-1 focus:ring-primary/30 focus:border-primary
        "
      >
        {NAMESPACES.map(ns => (
          <option key={ns} value={ns}>{ns}</option>
        ))}
      </select>

      <input
        disabled={disabled}
        type="text"
        placeholder="attribute.key"
        value={condition.key}
        onChange={e => onChange('key', e.target.value)}
        className="
          flex-1 min-w-0 text-xs border border-gray-200
          rounded px-2 py-1.5 font-mono
          bg-white text-gray-900 placeholder-gray-400
          focus:outline-none focus:ring-1
          focus:ring-primary/30 focus:border-primary
        "
      />

      <select
        disabled={disabled}
        value={condition.op}
        onChange={e => onChange('op', e.target.value)}
        className="
          text-xs border border-gray-200 rounded px-2 py-1.5
          bg-white text-gray-700 focus:outline-none
          focus:ring-1 focus:ring-primary/30 focus:border-primary
        "
      >
        {OPERATORS.map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>

      {!noValue && (
        <input
          disabled={disabled}
          type="text"
          placeholder="value"
          value={condition.value ?? ''}
          onChange={e => onChange('value', e.target.value)}
          className="
            flex-1 min-w-0 text-xs border border-gray-200
            rounded px-2 py-1.5 font-mono
            bg-white text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-1
            focus:ring-primary/30 focus:border-primary
          "
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || !canRemove}
        className="
          w-6 h-6 flex items-center justify-center
          rounded text-gray-400
          hover:text-red-500 hover:bg-red-50
          disabled:opacity-30 disabled:cursor-not-allowed
          transition-colors flex-shrink-0
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

function ConditionTreeBuilder({ value, onChange, disabled }) {
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
    if (disabled || tree.conditions.length <= 1) return;
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
        {tree.conditions.map((cond, index) => (
          <ConditionRow
            key={index}
            condition={cond}
            disabled={disabled}
            onChange={(field, val) => updateCondition(index, field, val)}
            onRemove={() => removeCondition(index)}
            canRemove={tree.conditions.length > 1}
          />
        ))}
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

// ---------------------------------------------------------------------------
// TargetSection
// ---------------------------------------------------------------------------

function TargetSection({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const target = value ?? {};

  const updateField = (field, val) => {
    if (disabled) return;
    const arr = val.split(',').map(s => s.trim()).filter(Boolean);
    onChange({ ...target, [field]: arr.length ? arr : undefined });
  };

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
        Target (optional)
      </button>
      {open && (
        <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-100">
          <p className="text-xs text-gray-500">
            Restrict which requests this policy evaluates.
            Leave empty to apply to all requests.
          </p>
          {[
            { field: 'subjectTypes',  label: 'Subject Types' },
            { field: 'resourceTypes', label: 'Resource Types' },
            { field: 'actions',       label: 'Actions' },
          ].map(({ field, label }) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs text-gray-500">
                {label}
              </Label>
              <Input
                disabled={disabled}
                placeholder="Comma-separated values..."
                value={(target[field] ?? []).join(', ')}
                onChange={e => updateField(field, e.target.value)}
                className="text-sm font-mono disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObligationsSection
// ---------------------------------------------------------------------------

function ObligationsSection({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (text) => {
    if (disabled) return;
    onChange(text);
    try {
      JSON.parse(text || '[]');
      setError('');
    } catch {
      setError('Invalid JSON');
    }
  };

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
        Obligations (optional)
      </button>
      {open && (
        <div className="mt-3 pl-4 border-l-2 border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            Actions to execute when this policy permits.
            Must be a valid JSON array.
          </p>
          <Textarea
            disabled={disabled}
            value={value}
            onChange={e => handleChange(e.target.value)}
            className={`text-xs font-mono resize-none disabled:bg-gray-50 disabled:cursor-not-allowed ${
              error ? 'border-red-300' : ''
            }`}
            rows={4}
            placeholder='[]'
          />
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

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
  onNewPolicy
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
            Global Policies
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
                : 'Create your first global policy'
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

function PolicyEditorPanel({ policy, versions, onRefetch, onDelete }) {
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
        effect:      policy.effect,
        conditions:  policy.conditions,
        target:      policy.target ?? {},
        obligations: JSON.stringify(policy.obligations ?? [], null, 2),
      });
    }
  }, [policy?.id]);

  const isDirty = form && policy && (
    form.name !== policy.name ||
    form.description !== (policy.description ?? '') ||
    form.priority !== policy.priority ||
    form.effect !== policy.effect ||
    JSON.stringify(form.conditions) !== JSON.stringify(policy.conditions)
  );

  const updateMutation = useMutation({
    mutationFn: (data) =>
      abacService.updateGlobalPolicy(policy.id, data),
    onSuccess: () => {
      toast({ title: 'Policy saved' });
      queryClient.invalidateQueries(['abac', 'globalPolicy', policy.id]);
      queryClient.invalidateQueries(['abac', 'globalPolicies']);
      queryClient.invalidateQueries(['abac', 'globalPolicyVersions', policy.id]);
    },
    onError: (err) => toast({
      title: 'Save failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const statusMutation = useMutation({
    mutationFn: (status) =>
      abacService.setGlobalPolicyStatus(policy.id, status),
    onSuccess: (_, status) => {
      toast({ title: `Policy ${status}` });
      queryClient.invalidateQueries(['abac', 'globalPolicies']);
      queryClient.invalidateQueries(['abac', 'globalPolicy', policy.id]);
    },
    onError: (err) => toast({
      title: 'Status change failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (version) =>
      abacService.rollbackGlobalPolicy(policy.id, version),
    onSuccess: () => {
      toast({ title: 'Rolled back successfully' });
      queryClient.invalidateQueries(['abac', 'globalPolicy', policy.id]);
      queryClient.invalidateQueries(['abac', 'globalPolicies']);
      queryClient.invalidateQueries(['abac', 'globalPolicyVersions', policy.id]);
    },
    onError: (err) => toast({
      title: 'Rollback failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => abacService.deleteGlobalPolicy(policy.id),
    onSuccess: () => {
      toast({ title: 'Policy deleted permanently' });
      queryClient.invalidateQueries(['abac', 'globalPolicies']);
      onDelete?.();
    },
    onError: (err) => toast({
      title: 'Delete failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const handleSave = () => {
    let parsedObligations = [];
    try {
      parsedObligations = JSON.parse(form.obligations || '[]');
    } catch {
      toast({
        title: 'Invalid JSON in obligations',
        variant: 'destructive'
      });
      return;
    }
    updateMutation.mutate({
      name:        form.name,
      description: form.description || undefined,
      priority:    parseInt(form.priority) || 100,
      effect:      form.effect,
      conditions:  form.conditions,
      target:      form.target,
      obligations: parsedObligations,
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
              {isDirty && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setForm({
                    name:        policy.name,
                    description: policy.description ?? '',
                    priority:    policy.priority,
                    effect:      policy.effect,
                    conditions:  policy.conditions,
                    target:      policy.target ?? {},
                    obligations: JSON.stringify(
                      policy.obligations ?? [], null, 2
                    ),
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
                {updateMutation.isPending ? 'Saving...' : 'Save Draft'}
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
                max={999}
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
                {['PERMIT', 'DENY'].map(eff => (
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
                        ? eff === 'PERMIT'
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
            </div>
          </div>

          <Separator className="my-2" />

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Conditions
              </Label>
              <p className="text-xs text-gray-400 mt-0.5">
                When these conditions are true, apply the effect
              </p>
            </div>
            <ConditionTreeBuilder
              value={form.conditions}
              onChange={conditions => setForm(f => ({ ...f, conditions }))}
              disabled={isArchived}
            />
          </div>

          <Separator className="my-2" />

          <TargetSection
            value={form.target}
            onChange={target => setForm(f => ({ ...f, target }))}
            disabled={isArchived}
          />

          <Separator className="my-2" />

          <ObligationsSection
            value={form.obligations}
            onChange={obligations => setForm(f => ({ ...f, obligations }))}
            disabled={isArchived}
          />

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

function PolicyCreatePanel({ onClose, onCreated }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    priority: 100,
    effect: 'DENY',
    conditions: DEFAULT_CONDITIONS,
    target: {},
    obligations: '[]',
  });

  const createMutation = useMutation({
    mutationFn: () => {
      let parsedObligations = [];
      try {
        parsedObligations = JSON.parse(form.obligations || '[]');
      } catch {
        throw new Error('Invalid JSON in obligations');
      }
      return abacService.createGlobalPolicy({
        name:        form.name,
        description: form.description || undefined,
        priority:    parseInt(form.priority) || 100,
        effect:      form.effect,
        conditions:  form.conditions,
        target:      form.target,
        obligations: parsedObligations,
      });
    },
    onSuccess: (res) => {
      toast({ title: 'Policy created as draft' });
      queryClient.invalidateQueries(['abac', 'globalPolicies']);
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
          New Global Policy
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
                type="number" min={1} max={999}
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Effect</Label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {['PERMIT', 'DENY'].map(eff => (
                  <button key={eff} type="button"
                    onClick={() => setForm(f => ({ ...f, effect: eff }))}
                    className={`
                      px-4 py-2 text-sm font-semibold
                      transition-colors
                      ${form.effect === eff
                        ? eff === 'PERMIT'
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
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Conditions
              </Label>
              <p className="text-xs text-gray-400 mt-0.5">
                When these conditions are true, apply the effect
              </p>
            </div>
            <ConditionTreeBuilder
              value={form.conditions}
              onChange={conditions => setForm(f => ({ ...f, conditions }))}
            />
          </div>

          <Separator />

          <TargetSection
            value={form.target}
            onChange={target => setForm(f => ({ ...f, target }))}
          />

          <Separator />

          <ObligationsSection
            value={form.obligations}
            onChange={obligations => setForm(f => ({ ...f, obligations }))}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GlobalPoliciesPage (main export)
// ---------------------------------------------------------------------------

export function GlobalPoliciesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [listFilter, setListFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const { data: policiesData, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ['abac', 'globalPolicies', listFilter],
    queryFn: () => abacService.listGlobalPolicies(
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

  const { data: selectedData, refetch: refetchSelected } = useQuery({
    queryKey: ['abac', 'globalPolicy', selectedPolicyId],
    queryFn: () => abacService.getGlobalPolicy(selectedPolicyId),
    enabled: !!selectedPolicyId,
    staleTime: 10_000,
  });
  const selectedPolicy =
    selectedData?.data?.data ?? selectedData?.data ?? null;

  const { data: versionsData } = useQuery({
    queryKey: ['abac', 'globalPolicyVersions', selectedPolicyId],
    queryFn: () => abacService.getGlobalPolicyVersions(selectedPolicyId),
    enabled: !!selectedPolicyId,
    staleTime: 30_000,
  });
  const versions = versionsData?.data?.data ?? versionsData?.data ?? [];

  return (
    <div className="flex h-full gap-0 -m-6">
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
      />

      {showCreatePanel && (
        <PolicyCreatePanel
          onClose={() => setShowCreatePanel(false)}
          onCreated={(id) => {
            setSelectedPolicyId(id);
            setShowCreatePanel(false);
          }}
        />
      )}

      {!showCreatePanel && selectedPolicyId && selectedPolicy && (
        <PolicyEditorPanel
          policy={selectedPolicy}
          versions={versions}
          onRefetch={() => {
            refetchSelected();
            refetchList();
          }}
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
  );
}
