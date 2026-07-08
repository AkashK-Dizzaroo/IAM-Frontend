import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QK } from '@/lib/queryKeys';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { globalPolicyService } from './api/globalPolicyService';
import { hubAttributeService } from '@/features/hub-attributes/api/hubAttributeService';
import { logger } from '@/lib/logger';
import { ChevronDown, Check } from 'lucide-react';

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

// Recursively collect all leaf condition nodes from the tree
function collectLeaves(node) {
  if (!node) return [];
  if ('op' in node) return [node];
  if (Array.isArray(node.conditions)) {
    return node.conditions.flatMap(collectLeaves);
  }
  return [];
}

// Returns an array of error strings; empty array = valid
function validatePolicyForm(form) {
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
// ConditionRow
// ---------------------------------------------------------------------------

const ARRAY_OPS = new Set(['in', 'not_in']);

function ConditionRow({ condition, onChange, onRemove, canRemove, disabled, attributeDefs = [] }) {
  const noValue = ['exists', 'not_exists'].includes(condition.op);
  const isArrayOp = ARRAY_OPS.has(condition.op);

  const filteredAttrs = attributeDefs.filter(attr => attr.namespace === condition.namespace);

  return (
    <div className="
      flex items-center gap-2 p-2.5 rounded-lg
      bg-gray-50 border border-gray-200
      group
    ">
      <select
        disabled={disabled}
        value={condition.namespace}
        onChange={e => {
          onChange('namespace', e.target.value);
          // Optional: clear key if not valid in new namespace? 
          // Usually better to leave it so user can change it if they want.
        }}
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
      )}

      <select
        disabled={disabled}
        value={condition.op}
        onChange={e => {
          const newOp = e.target.value;
          const switchingToArray = ARRAY_OPS.has(newOp) && !isArrayOp;
          const switchingFromArray = !ARRAY_OPS.has(newOp) && isArrayOp;
          if (switchingToArray) {
            const cur = condition.value;
            const arr = cur ? [cur] : [];
            onChange('value', arr);
          } else if (switchingFromArray) {
            onChange('value', Array.isArray(condition.value) ? condition.value.join(', ') : '');
          }
          onChange('op', newOp);
        }}
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

      {!noValue && (() => {
        const attr = filteredAttrs.find(a => a.key === condition.key);
        let constraints = attr?.constraints || {};
        if (typeof constraints === 'string') {
          try { constraints = JSON.parse(constraints); } catch (e) { constraints = {}; }
        }
        
        const allowedValues = constraints.allowedValues;
        const dataType = attr?.dataType;

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
      })()}

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

function ConditionJsonEditor({ tree, onChange, disabled }) {
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
// Action attribute tree (hierarchical popover for action selection)
// ---------------------------------------------------------------------------

function buildActionTree(actionAttrs) {
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

function getLeafValues(attr, childMap) {
  const children = childMap[attr.id] ?? [];
  if (children.length > 0) return children.flatMap(c => getLeafValues(c, childMap));
  let c = attr.constraints || {};
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
  if (Array.isArray(c.allowedValues) && c.allowedValues.length > 0) return c.allowedValues;
  return [attr.key];
}

function ActionTreeNode({ attr, childMap, selectedActions, onChange, disabled, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const children = childMap[attr.id] ?? [];
  const leafValues = getLeafValues(attr, childMap);
  const allSelected = leafValues.length > 0 && leafValues.every(v => selectedActions.includes(v));
  const someSelected = !allSelected && leafValues.some(v => selectedActions.includes(v));

  const toggle = () => {
    if (allSelected) onChange(selectedActions.filter(v => !leafValues.includes(v)));
    else onChange([...new Set([...selectedActions, ...leafValues])]);
  };

  let attrConstraints = attr.constraints || {};
  if (typeof attrConstraints === 'string') { try { attrConstraints = JSON.parse(attrConstraints); } catch { attrConstraints = {}; } }

  if (children.length === 0) {
    const values = Array.isArray(attrConstraints.allowedValues) && attrConstraints.allowedValues.length > 0
      ? attrConstraints.allowedValues : [attr.key];

    if (values.length === 1 && values[0] === attr.key) {
      const checked = selectedActions.includes(attr.key);
      return (
        <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${8 + depth * 16}px` }}>
          <input type="checkbox" checked={checked} disabled={disabled}
            onChange={() => onChange(checked ? selectedActions.filter(v => v !== attr.key) : [...selectedActions, attr.key])}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
          />
          <span className="text-xs text-gray-700">{attr.displayName || attr.key}</span>
        </div>
      );
    }

    return (
      <div style={{ paddingLeft: `${depth * 16}px` }}>
        <div className="flex items-center gap-1 py-0.5 px-1">
          <button type="button" onClick={() => setOpen(o => !o)} className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0 text-[10px]">
            {open ? '▾' : '▸'}
          </button>
          <input type="checkbox" checked={allSelected} disabled={disabled}
            ref={el => { if (el) el.indeterminate = someSelected; }}
            onChange={toggle}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
          />
          <span className="text-xs font-medium text-gray-800">{attr.displayName || attr.key}</span>
        </div>
        {open && values.map(val => {
          const checked = selectedActions.includes(val);
          return (
            <div key={val} className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${24 + depth * 16}px` }}>
              <input type="checkbox" checked={checked} disabled={disabled}
                onChange={() => onChange(checked ? selectedActions.filter(v => v !== val) : [...selectedActions, val])}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              <span className="text-xs text-gray-700">{val}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      <div className="flex items-center gap-1 py-0.5 px-1">
        <button type="button" onClick={() => setOpen(o => !o)} className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0 text-[10px]">
          {open ? '▾' : '▸'}
        </button>
        <input type="checkbox" checked={allSelected} disabled={disabled}
          ref={el => { if (el) el.indeterminate = someSelected; }}
          onChange={toggle}
          className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
        />
        <span className="text-xs font-semibold text-gray-800">{attr.displayName || attr.key}</span>
      </div>
      {open && children.map(child => (
        <ActionTreeNode key={child.id} attr={child} childMap={childMap}
          selectedActions={selectedActions} onChange={onChange} disabled={disabled} depth={depth + 1}
        />
      ))}
    </div>
  );
}

function HierarchicalActionPopover({ actionAttrs, selectedActions, onChange, disabled }) {
  // Global policies: only show values from root action attributes (those without a parentId)
  const rootAttrs = actionAttrs.filter(a => !a.parentId);
  const displayAttrs = rootAttrs.length > 0 ? rootAttrs : actionAttrs;

  const allValues = displayAttrs.flatMap(attr => {
    let c = attr.constraints || {};
    if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
    return Array.isArray(c.allowedValues) && c.allowedValues.length > 0 ? c.allowedValues : [attr.key];
  });

  if (allValues.length === 0) {
    return (
      <input disabled={disabled} type="text" placeholder="actions…"
        value={selectedActions.join(', ')}
        onChange={e => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
        className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-2 py-1.5 font-mono bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
      />
    );
  }

  const count = selectedActions.length;
  const label = count === 0 ? 'Allowed actions…' : `${count} action${count !== 1 ? 's' : ''} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled}
          className="flex items-center gap-1.5 min-w-[140px] px-2 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex-1 text-left truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 max-h-64 overflow-y-auto" align="start">
        {allValues.length > 1 && (() => {
          const allSelected = allValues.every(v => selectedActions.includes(v));
          const someSelected = !allSelected && allValues.some(v => selectedActions.includes(v));
          return (
            <div className="flex items-center gap-2 py-0.5 px-1 border-b border-gray-100 mb-1 pb-1.5">
              <input type="checkbox" checked={allSelected} disabled={disabled}
                ref={el => { if (el) el.indeterminate = someSelected; }}
                onChange={() => onChange(allSelected ? [] : [...allValues])}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              <span className="text-xs font-medium text-gray-700">Select all</span>
            </div>
          );
        })()}
        {allValues.map(val => {
          const checked = selectedActions.includes(val);
          return (
            <div key={val} className="flex items-center gap-2 py-0.5 px-1">
              <input type="checkbox" checked={checked} disabled={disabled}
                onChange={() => onChange(checked ? selectedActions.filter(v => v !== val) : [...selectedActions, val])}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              <span className="text-xs text-gray-700">{val}</span>
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// PolicyConditionBuilder — unified builder (replaces tabs)
// ---------------------------------------------------------------------------

function ConditionGroupRenderer({ tree, onChange, disabled, attributeDefs, depth = 0 }) {
  const updateOperator = (op) => { if (!disabled) onChange({ ...tree, operator: op }); };
  const updateChild = (i, newNode) => onChange({ ...tree, conditions: tree.conditions.map((c, idx) => idx === i ? newNode : c) });
  const removeChild = (i) => onChange({ ...tree, conditions: tree.conditions.filter((_, idx) => idx !== i) });

  const addLeaf = () => onChange({ ...tree, conditions: [...tree.conditions, { namespace: 'subject', key: '', op: 'eq', value: '' }] });

  return (
    <div className={depth > 0 ? 'border-l-2 border-gray-200 pl-3 ml-2 mt-1' : ''}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {['AND', 'OR'].map(op => (
            <button key={op} type="button" disabled={disabled} onClick={() => updateOperator(op)}
              className={`px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${tree.operator === op ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >{op}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {tree.operator === 'AND' ? 'all conditions must match' : 'any condition must match'}
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
            <ConditionRow key={i} condition={child}
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

function PolicyConditionBuilder({ value, onChange, disabled, attributeDefs }) {
  const tree = normalizeConditions(value);
  return (
    <div className="space-y-3">
      <ConditionGroupRenderer tree={tree} onChange={onChange} disabled={disabled}
        attributeDefs={attributeDefs} depth={0}
      />
      <ConditionJsonEditor tree={tree} onChange={onChange} disabled={disabled} />
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

function PolicyEditorPanel({ policy, versions, onDelete, attributeDefs }) {
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
      globalPolicyService.update(policy.id, data),
    onSuccess: () => {
      toast({ title: 'Policy saved' });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicy(policy.id) });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicies() });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicyVersions(policy.id) });
    },
    onError: (err) => toast({
      title: 'Save failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const statusMutation = useMutation({
    mutationFn: (status) =>
      globalPolicyService.setStatus(policy.id, status),
    onSuccess: (_, status) => {
      toast({ title: `Policy ${status}` });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicies() });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicy(policy.id) });
    },
    onError: (err) => toast({
      title: 'Status change failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (version) =>
      globalPolicyService.rollback(policy.id, version),
    onSuccess: () => {
      toast({ title: 'Rolled back successfully' });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicy(policy.id) });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicies() });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicyVersions(policy.id) });
    },
    onError: (err) => toast({
      title: 'Rollback failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => globalPolicyService.delete(policy.id),
    onSuccess: () => {
      toast({ title: 'Policy deleted permanently' });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicies() });
      onDelete?.();
    },
    onError: (err) => toast({
      title: 'Delete failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const handleSave = () => {
    logger.info('Submit Policy clicked', {
      action: 'SUBMIT_POLICY',
      scope: 'GLOBAL',
      mode: 'edit',
      policyId: policy.id,
      name: form?.name,
      effect: form?.effect,
      priority: form?.priority,
    });

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
      priority:    Number.parseInt(form.priority) || 10,
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
            maxLength={255}
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
            </div>
          </div>

          <Separator className="my-2" />

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Conditions</Label>
              <p className="text-xs text-gray-400 mt-0.5">Leave empty to apply the effect to all requests.</p>
            </div>
            <PolicyConditionBuilder
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

function PolicyCreatePanel({ onClose, onCreated, attributeDefs }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    priority: 10,
    effect: 'DENY',
    conditions: DEFAULT_CONDITIONS,
  });
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const isFormDirty = form.name.trim() !== '' || form.description.trim() !== '' || form.conditions.conditions.length > 0;

  const handleCancel = () => {
    if (isFormDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  };

  const createMutation = useMutation({
    mutationFn: () => {
      return globalPolicyService.create({
        name:        form.name,
        description: form.description || undefined,
        priority:    Number.parseInt(form.priority) || 10,
        effect:      form.effect,
        conditions:  form.conditions,
      });
    },
    onSuccess: (res) => {
      toast({ title: 'Policy created as draft' });
      queryClient.invalidateQueries({ queryKey: QK.globalPolicies() });
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
    <>
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <div className="
        px-6 py-4 bg-white border-b border-gray-100
        flex items-center justify-between flex-shrink-0
      ">
        <h2 className="font-semibold text-gray-900">
          New Global Policy
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              logger.info('Submit Policy clicked', {
                action: 'SUBMIT_POLICY',
                scope: 'GLOBAL',
                mode: 'create',
                name: form.name,
                effect: form.effect,
                priority: form.priority,
              });
              createMutation.mutate();
            }}
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
              maxLength={255}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            {form.name.length > 200 && (
              <p className="text-xs text-amber-500">{255 - form.name.length} characters remaining</p>
            )}
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
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              />
              <p className="text-[11px] text-gray-400">
                Lower = evaluated first
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Effect</Label>
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
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Conditions</Label>
              <p className="text-xs text-gray-400 mt-0.5">Leave empty to apply the effect to all requests.</p>
            </div>
            <PolicyConditionBuilder
              value={form.conditions}
              onChange={conditions => setForm(f => ({ ...f, conditions }))}
              attributeDefs={attributeDefs}
            />
          </div>


        </div>
      </div>
    </div>

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

// ---------------------------------------------------------------------------
// GlobalPoliciesPage (main export)
// ---------------------------------------------------------------------------

export function GlobalPoliciesPage() {
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [listFilter, setListFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const { data: policiesData, isLoading: listLoading } = useQuery({
    queryKey: QK.globalPolicies(listFilter),
    queryFn: () => globalPolicyService.list(
      listFilter !== 'all' ? { status: listFilter } : {}
    ),
  });

  const { data: hubAttrsData } = useQuery({
    queryKey: QK.hubAttributes,
    queryFn: () => hubAttributeService.list(),
    enabled: showCreatePanel || !!selectedPolicyId,
  });
  const attributeDefs = hubAttrsData?.data?.data ?? hubAttrsData?.data ?? [];
  const policies = policiesData?.data?.data ?? policiesData?.data ?? [];

  const filteredPolicies = policies.filter(p =>
    !listSearch ||
    p.name.toLowerCase().includes(listSearch.toLowerCase()) ||
    p.description?.toLowerCase().includes(listSearch.toLowerCase())
  );

  const { data: selectedData } = useQuery({
    queryKey: QK.globalPolicy(selectedPolicyId),
    queryFn: () => globalPolicyService.get(selectedPolicyId),
    enabled: !!selectedPolicyId,
    staleTime: 10_000,
  });
  const selectedPolicy =
    selectedData?.data?.data ?? selectedData?.data ?? null;

  const { data: versionsData } = useQuery({
    queryKey: QK.globalPolicyVersions(selectedPolicyId),
    queryFn: () => globalPolicyService.getVersions(selectedPolicyId),
    enabled: !!selectedPolicyId,
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
          attributeDefs={attributeDefs}
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
  );
}
