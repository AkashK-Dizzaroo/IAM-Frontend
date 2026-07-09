import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QK } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { appPolicyService } from './api/appPolicyService';
import { appAttributeService } from '@/features/app-attributes/api/appAttributeService';
import { globalPolicyService } from '@/features/global-policies/api/globalPolicyService';
import { hubAttributeService } from '@/features/hub-attributes/api/hubAttributeService';
import { useAbacScope } from '@/features/scope';
import { Lock, Globe2, ChevronDown, ChevronRight, Info, Tag, Settings, Check } from 'lucide-react';
import {
  EffectBadge,
  StatusBadge,
  MultiValueDropdown,
  DEFAULT_CONDITIONS,
  normalizeConditions,
  validatePolicyForm,
  NAMESPACES,
  OPERATORS,
  ARRAY_OPS,
  ConditionGroupRenderer,
  ConditionJsonEditor,
  buildActionTree,
  VersionHistory,
  EmptyEditorState,
  PolicyListPanel,
} from '@/features/policy-shared/PolicyConditionShared';

// ---------------------------------------------------------------------------
// ConditionRow
// ---------------------------------------------------------------------------

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
        <Select
          disabled={disabled}
          value={condition.key || ''}
          onValueChange={val => onChange('key', val)}
        >
          <SelectTrigger className="flex-1 min-w-0 h-[30px] text-xs font-mono border-gray-200 focus:ring-primary/30">
            <SelectValue placeholder="Select attribute..." />
          </SelectTrigger>
          <SelectContent>
            {(() => {
              const buildTree = (list) => {
                const sorted = [...list].sort((a, b) =>
                  (a.displayName || a.key).localeCompare(b.displayName || b.key)
                );
                const processed = new Set();
                const result = [];
                const addWithChildren = (node, level) => {
                  if (processed.has(node.id)) return;
                  processed.add(node.id);
                  result.push({ ...node, level });
                  sorted.filter(c => c.parentId === node.id).forEach(c => addWithChildren(c, level + 1));
                };
                sorted.filter(a => !a.parentId).forEach(r => addWithChildren(r, 0));
                sorted.filter(a => !processed.has(a.id)).forEach(u => addWithChildren(u, 0));
                return result;
              };

              const renderItem = (attr) => (
                <SelectItem
                  key={attr.key}
                  value={attr.key}
                  textValue={attr.displayName || attr.key}
                  className="text-xs font-mono"
                  style={{ paddingLeft: `${0.5 + attr.level * 1.25}rem` }}
                >
                  {attr.level > 0 && <span className="text-gray-400 mr-1">&#x2514;</span>}
                  {attr.displayName || attr.key}
                </SelectItem>
              );

              const hubAttrs = filteredAttrs.filter(a => a._source === 'hub');
              const appAttrs = filteredAttrs.filter(a => a._source !== 'hub');

              if (hubAttrs.length > 0 && appAttrs.length > 0) {
                return (
                  <>
                    <SelectGroup>
                      <SelectLabel className="text-[10px] text-gray-400 uppercase tracking-wider">Hub Attributes</SelectLabel>
                      {buildTree(hubAttrs).map(renderItem)}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-[10px] text-gray-400 uppercase tracking-wider">App Attributes</SelectLabel>
                      {buildTree(appAttrs).map(renderItem)}
                    </SelectGroup>
                  </>
                );
              }
              return buildTree(filteredAttrs).map(renderItem);
            })()}
          </SelectContent>
        </Select>
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

// Used by TabTreeNode below to resolve a parent tab's "select all children" toggle.
function getDescendantKeys(attr, childMap) {
  const children = childMap[attr.id] ?? [];
  if (children.length === 0) return [attr.key];
  return children.flatMap(c => getDescendantKeys(c, childMap));
}

// ---------------------------------------------------------------------------
// ActionTabSelector — hierarchical tree-view dropdown for action_tab attrs
// ---------------------------------------------------------------------------

function TabTreeNode({ attr, childMap, selectedActions, onChange, disabled, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const children = childMap[attr.id] ?? [];

  if (children.length === 0) {
    const checked = selectedActions.includes(attr.key);
    const toggleLeaf = () => {
      if (disabled) return;
      onChange(checked ? selectedActions.filter(k => k !== attr.key) : [...selectedActions, attr.key]);
    };
    return (
      <div
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        className={`flex items-center gap-2.5 py-1.5 rounded-md cursor-pointer group transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/5'}`}
        style={{ paddingLeft: `${12 + depth * 20}px`, paddingRight: '12px' }}
        onClick={toggleLeaf}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleLeaf();
          }
        }}
      >
        <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border-gray-300 bg-white group-hover:border-primary/50'}`}>
          {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
        </div>
        <span className={`text-xs transition-colors ${checked ? 'text-gray-900 font-medium' : 'text-gray-600 group-hover:text-gray-800'}`}>
          {attr.displayName || attr.key}
        </span>
      </div>
    );
  }

  // Parent node — its own key (the module/tab itself) is independent from its
  // child stages, so it gets its own checkbox plus a separate "all children" toggle.
  const descendantKeys = getDescendantKeys(attr, childMap);
  const parentChecked = selectedActions.includes(attr.key);
  const allChildrenSelected = descendantKeys.length > 0 && descendantKeys.every(k => selectedActions.includes(k));
  const someChildrenSelected = !allChildrenSelected && descendantKeys.some(k => selectedActions.includes(k));

  const toggleParent = () => {
    if (disabled) return;
    onChange(parentChecked ? selectedActions.filter(k => k !== attr.key) : [...selectedActions, attr.key]);
  };

  const toggleAllChildren = () => {
    if (disabled) return;
    if (allChildrenSelected) onChange(selectedActions.filter(k => !descendantKeys.includes(k)));
    else onChange([...new Set([...selectedActions, ...descendantKeys])]);
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 group"
        style={{ paddingLeft: `${12 + depth * 20}px`, paddingRight: '12px' }}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 shrink-0 transition-colors"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        </button>
        <div
          title="Select this module"
          role="checkbox"
          aria-checked={parentChecked}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${parentChecked ? 'bg-primary border-primary' : 'border-gray-300 bg-white hover:border-primary/50'}`}
          onClick={toggleParent}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleParent();
            }
          }}
        >
          {parentChecked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
        </div>
        <span className={`text-xs font-semibold flex-1 ${parentChecked ? 'text-gray-900' : 'text-gray-800'}`}>{attr.displayName || attr.key}</span>
        <button
          type="button"
          title="Select all child stages"
          disabled={disabled}
          onClick={toggleAllChildren}
          className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            allChildrenSelected ? 'text-primary bg-primary/10' : someChildrenSelected ? 'text-primary' : 'text-gray-400 hover:text-primary hover:bg-primary/5'
          }`}
        >
          <div className={`h-3 w-3 rounded-sm border flex items-center justify-center shrink-0 ${allChildrenSelected ? 'bg-primary border-primary' : someChildrenSelected ? 'border-primary' : 'border-gray-300'}`}>
            {allChildrenSelected && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
            {someChildrenSelected && <div className="h-1 w-1 rounded-sm bg-primary" />}
          </div>
          All
        </button>
      </div>
      {open && (
        <div className="border-l border-gray-100 ml-[20px]">
          {children.map(child => (
            <TabTreeNode key={child.id} attr={child} childMap={childMap}
              selectedActions={selectedActions} onChange={onChange} disabled={disabled} depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionTabSelector({ actionAttrs, selectedActions, onChange, disabled }) {
  const tabAttrIds = new Set(
    actionAttrs.filter(attr => {
      let c = attr.constraints || {};
      if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
      return !!c.action_tab;
    }).map(a => a.id)
  );

  const tabAttrSet = new Set(tabAttrIds);
  const addAncestors = (attr) => {
    if (attr.parentId && !tabAttrSet.has(attr.parentId)) {
      const parent = actionAttrs.find(a => a.id === attr.parentId);
      if (parent) { tabAttrSet.add(parent.id); addAncestors(parent); }
    }
  };
  actionAttrs.filter(a => tabAttrIds.has(a.id)).forEach(addAncestors);

  const tabAttrs = actionAttrs.filter(a => tabAttrSet.has(a.id));
  if (tabAttrs.length === 0) return null;

  const { roots, childMap } = buildActionTree(tabAttrs);
  // Selectable keys = every action_tab attribute's own key (parents AND leaves) —
  // a parent can be selected on its own (as a matrix tab whose cells are its
  // children) independently of selecting its children as their own tabs.
  const allLeafKeys = [...new Set(actionAttrs.filter(a => tabAttrIds.has(a.id)).map(a => a.key))];
  const allSelected = allLeafKeys.length > 0 && allLeafKeys.every(k => selectedActions.includes(k));
  const count = selectedActions.filter(k => allLeafKeys.includes(k)).length;

  const label = count === 0
    ? 'Select application tabs…'
    : count === allLeafKeys.length
      ? 'All tabs selected'
      : `${count} tab${count !== 1 ? 's' : ''} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-2 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Settings className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="flex-1 text-left text-xs text-gray-700">{label}</span>
          {count > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary shrink-0">
              {count}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 shadow-xl border border-gray-200 rounded-xl overflow-hidden"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
        sideOffset={4}
      >
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Application Tabs</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(allSelected ? [] : [...allLeafKeys])}
            className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="py-1.5 max-h-64 overflow-y-auto">
          {roots.map(root => (
            <TabTreeNode
              key={root.id}
              attr={root}
              childMap={childMap}
              selectedActions={selectedActions}
              onChange={onChange}
              disabled={disabled}
              depth={0}
            />
          ))}
        </div>
        {count > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">{count} of {allLeafKeys.length} selected</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// PolicyTabRoleMatrix — role × tab permission matrix
// ---------------------------------------------------------------------------

function getTabCellValues(tabAttr, allActionAttrs) {
  let c = tabAttr.constraints || {};
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
  if (Array.isArray(c.allowedValues) && c.allowedValues.length > 0) {
    return c.allowedValues.map(v => ({ key: String(v), label: String(v) }));
  }
  const children = allActionAttrs.filter(a => a.parentId === tabAttr.id);
  if (children.length > 0) {
    return children.map(ch => ({ key: ch.key, label: ch.displayName || ch.key }));
  }
  return null; // boolean (no values)
}

// Walks a conditions tree and returns the subset of allTabKeys referenced by
// any `action` namespace leaf — used to detect which tabs a saved policy's
// role-tab matrix covers, since `actions`/`target` aren't persisted separately.
function extractTabKeysFromConditions(conditions, allTabKeys) {
  const found = new Set();
  const walk = (node) => {
    if (!node) return;
    if ('op' in node) {
      if (node.namespace === 'action' && allTabKeys.includes(node.key)) found.add(node.key);
      return;
    }
    if (Array.isArray(node.conditions)) node.conditions.forEach(walk);
  };
  walk(conditions);
  return allTabKeys.filter(k => found.has(k));
}

// matrix[role][tabKey] = Set<string>
// Reads BOTH shapes:
//   new (compact): AND[ role=X, OR[ tabCond, tabCond, ... ] ]   or  AND[ role=X, tabCond ]
//   legacy (flat): AND[ role=X, tabCond ]  repeated as siblings inside an outer OR
function parseMatrixFromConditions(conditions, roleKey, tabKeys) {
  const matrix = {};

  const addCell = (role, tabLeaf) => {
    if (!matrix[role]) matrix[role] = {};
    if (tabLeaf.op === 'in' && Array.isArray(tabLeaf.value)) {
      matrix[role][tabLeaf.key] = new Set(tabLeaf.value.map(String));
    } else {
      matrix[role][tabLeaf.key] = new Set([String(tabLeaf.value)]);
    }
  };

  const isTabLeaf = (c) => 'op' in c && c.namespace === 'action' && tabKeys.includes(c.key);

  // A per-role group: AND[ role=X, <tabCond | OR[tabCond, ...]> ]
  const processRoleGroup = (node) => {
    if (!node || node.operator !== 'AND' || !Array.isArray(node.conditions)) return false;
    const roleLeaf = node.conditions.find(c => 'op' in c && c.namespace === 'subject' && c.key === roleKey);
    if (!roleLeaf) return false;
    const role = String(roleLeaf.value);

    const rest = node.conditions.filter(c => c !== roleLeaf);
    for (const child of rest) {
      if (isTabLeaf(child)) {
        addCell(role, child);
      } else if (child.operator === 'OR' && Array.isArray(child.conditions)) {
        child.conditions.forEach(c => { if (isTabLeaf(c)) addCell(role, c); });
      }
    }
    return true;
  };

  const processNode = (node) => {
    if (!node) return;
    if (processRoleGroup(node)) return;
    if (Array.isArray(node.conditions)) node.conditions.forEach(processNode);
  };

  if (conditions?.operator) processNode(conditions);
  return matrix;
}

// Builds the compact per-role shape:
//   AND[ role=X, tabCond ]                       — role with a single tab
//   AND[ role=X, OR[ tabCond, tabCond, ... ] ]   — role with multiple tabs
// Multiple roles are wrapped in an outer OR.
function buildConditionsFromMatrix(matrix, roleKey, roleOptions, tabKeys, tabCellValuesMap) {
  const groups = [];
  roleOptions.forEach(role => {
    const tabConds = [];
    tabKeys.forEach(tabKey => {
      const selected = matrix[role]?.[tabKey];
      if (!selected || selected.size === 0) return;
      const cellValues = tabCellValuesMap[tabKey];
      tabConds.push(
        cellValues
          ? { namespace: 'action', key: tabKey, op: 'in', value: [...selected] }
          : { namespace: 'action', key: tabKey, op: 'eq', value: 'true' }
      );
    });
    if (tabConds.length === 0) return;

    const tabPart = tabConds.length === 1 ? tabConds[0] : { operator: 'OR', conditions: tabConds };
    groups.push({
      operator: 'AND',
      conditions: [
        { namespace: 'subject', key: roleKey, op: 'eq', value: role },
        tabPart,
      ],
    });
  });

  if (groups.length === 0) return { operator: 'AND', conditions: [] };
  if (groups.length === 1) return groups[0];
  return { operator: 'OR', conditions: groups };
}

// Returns true if a node is a per-role matrix group: AND[ role=X, <tabCond | OR[tabCond,...]> ]
function isMatrixPairNode(node, roleKey, tabKeys) {
  if (!node || node.operator !== 'AND' || !Array.isArray(node.conditions)) return false;
  const hasRole = node.conditions.some(c => 'op' in c && c.namespace === 'subject' && c.key === roleKey);
  if (!hasRole) return false;
  const isTabLeaf = (c) => 'op' in c && c.namespace === 'action' && tabKeys.includes(c.key);
  return node.conditions.some(c => {
    if (isTabLeaf(c)) return true;
    return c.operator === 'OR' && Array.isArray(c.conditions) && c.conditions.some(isTabLeaf);
  });
}

// Returns true if a node is the OR wrapper containing only matrix per-role groups.
function isMatrixOrNode(node, roleKey, tabKeys) {
  if (!node || node.operator !== 'OR' || !Array.isArray(node.conditions)) return false;
  return node.conditions.length > 0 && node.conditions.every(n => isMatrixPairNode(n, roleKey, tabKeys));
}

// Splits a stored conditions tree into { matrix, extra } sub-trees.
// Expected shape on disk: AND[ ...common conditions..., OR[ <per-role group>, ... ] ]
// or, for a single role, AND[ ...common conditions..., <per-role group> ]
function partitionConditions(conditions, roleKey, tabKeys) {
  if (!conditions || !conditions.operator) return { matrix: DEFAULT_CONDITIONS, extra: DEFAULT_CONDITIONS };

  // Top-level AND — look for the embedded matrix OR node
  if (conditions.operator === 'AND' && Array.isArray(conditions.conditions)) {
    const matrixIdx = conditions.conditions.findIndex(n => isMatrixOrNode(n, roleKey, tabKeys));
    if (matrixIdx !== -1) {
      const matrixOrNode = conditions.conditions[matrixIdx];
      const extraNodes   = conditions.conditions.filter((_, i) => i !== matrixIdx);
      const extra =
        extraNodes.length === 0 ? DEFAULT_CONDITIONS :
        extraNodes.length === 1 ? extraNodes[0] :
        { operator: 'AND', conditions: extraNodes };
      return { matrix: matrixOrNode, extra };
    }
    // Single per-role group at top-level AND (no OR wrapper — single role only)
    const pairIdx = conditions.conditions.findIndex(n => isMatrixPairNode(n, roleKey, tabKeys));
    if (pairIdx !== -1 && conditions.conditions.length === 1) {
      return { matrix: conditions.conditions[0], extra: DEFAULT_CONDITIONS };
    }
    if (pairIdx !== -1) {
      const matrixNode  = conditions.conditions[pairIdx];
      const extraNodes  = conditions.conditions.filter((_, i) => i !== pairIdx);
      const extra =
        extraNodes.length === 0 ? DEFAULT_CONDITIONS :
        extraNodes.length === 1 ? extraNodes[0] :
        { operator: 'AND', conditions: extraNodes };
      return { matrix: matrixNode, extra };
    }
    // Legacy whole-tree IS itself a single pair node (operator AND with role+tab directly)
    if (isMatrixPairNode(conditions, roleKey, tabKeys)) {
      return { matrix: conditions, extra: DEFAULT_CONDITIONS };
    }
    // AND with no matrix inside — all extra
    return { matrix: DEFAULT_CONDITIONS, extra: conditions };
  }

  // Legacy: flat OR of pairs (old format before this change)
  if (conditions.operator === 'OR' && Array.isArray(conditions.conditions)) {
    const matrixPairs = conditions.conditions.filter(n =>  isMatrixPairNode(n, roleKey, tabKeys));
    const extraNodes  = conditions.conditions.filter(n => !isMatrixPairNode(n, roleKey, tabKeys));
    const matrix =
      matrixPairs.length === 0 ? DEFAULT_CONDITIONS :
      matrixPairs.length === 1 ? matrixPairs[0] :
      { operator: 'OR', conditions: matrixPairs };
    const extra =
      extraNodes.length === 0 ? DEFAULT_CONDITIONS :
      extraNodes.length === 1 ? extraNodes[0] :
      { operator: 'OR', conditions: extraNodes };
    return { matrix, extra };
  }

  // Single leaf or unrecognised — treat as extra
  return { matrix: DEFAULT_CONDITIONS, extra: conditions };
}

// Merges the matrix-managed and builder-managed condition trees before saving.
// Structure: AND[ ...common conditions..., <matrix node> ]
// where <matrix node> is either a single per-role group or an OR of per-role groups.
function mergeFormConditions(matrixConds, extraConds) {
  // Normalize the matrix tree to its node form (single group, OR-of-groups, or none)
  const matrixNode = (() => {
    if (!matrixConds) return null;
    if (matrixConds.operator === 'OR' && Array.isArray(matrixConds.conditions) && matrixConds.conditions.length > 0)
      return matrixConds.conditions.length === 1 ? matrixConds.conditions[0] : matrixConds;
    if (matrixConds.operator === 'AND' && Array.isArray(matrixConds.conditions) && matrixConds.conditions.length > 0)
      return matrixConds; // single per-role group
    return null;
  })();

  // Flatten extra common conditions into a node array
  const extraNodes = (() => {
    if (!extraConds) return [];
    if ('op' in extraConds) return [extraConds]; // single leaf
    if (!Array.isArray(extraConds.conditions) || extraConds.conditions.length === 0) return [];
    if (extraConds.operator === 'AND') return extraConds.conditions; // spread AND children
    return [extraConds]; // OR block stays intact as one child
  })();

  const hasMatrix = !!matrixNode;
  const hasExtra  = extraNodes.length > 0;

  if (!hasMatrix && !hasExtra) return DEFAULT_CONDITIONS;

  // Only common conditions, no matrix
  if (!hasMatrix) {
    return extraNodes.length === 1 ? extraNodes[0] : { operator: 'AND', conditions: extraNodes };
  }

  // Only matrix, no common conditions
  if (!hasExtra) return { operator: 'AND', conditions: [matrixNode] };

  // Both: AND[ ...common..., <matrix node> ]
  return { operator: 'AND', conditions: [...extraNodes, matrixNode] };
}

function PolicyTabRoleMatrix({ selectedTabKeys, tabAttrs, allActionAttrs, roleDef, roleOptions, conditions, onChange, disabled }) {
  const tabCellValuesMap = {};
  selectedTabKeys.forEach(tabKey => {
    const attr = tabAttrs.find(a => a.key === tabKey);
    if (attr) tabCellValuesMap[tabKey] = getTabCellValues(attr, allActionAttrs);
  });

  const [matrix, setMatrix] = useState(() =>
    parseMatrixFromConditions(conditions, roleDef.key, selectedTabKeys)
  );

  useEffect(() => {
    setMatrix(parseMatrixFromConditions(conditions, roleDef.key, selectedTabKeys));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleDef.key, selectedTabKeys.join(',')]);

  const commit = (next) => {
    setMatrix(next);
    onChange(buildConditionsFromMatrix(next, roleDef.key, roleOptions, selectedTabKeys, tabCellValuesMap));
  };

  const toggleValue = (role, tabKey, value) => {
    if (disabled) return;
    const roleData = { ...(matrix[role] ?? {}) };
    const current = new Set(roleData[tabKey] ?? []);
    if (current.has(value)) current.delete(value); else current.add(value);
    commit({ ...matrix, [role]: { ...roleData, [tabKey]: current } });
  };

  const toggleAllInCell = (role, tabKey) => {
    if (disabled) return;
    const cellValues = tabCellValuesMap[tabKey];
    const roleData = { ...(matrix[role] ?? {}) };
    if (cellValues) {
      const current = roleData[tabKey] ?? new Set();
      const allChecked = cellValues.every(v => current.has(v.key));
      roleData[tabKey] = allChecked ? new Set() : new Set(cellValues.map(v => v.key));
    } else {
      const current = roleData[tabKey] ?? new Set();
      roleData[tabKey] = current.has('true') ? new Set() : new Set(['true']);
    }
    commit({ ...matrix, [role]: roleData });
  };

  const toggleRow = (role) => {
    if (disabled) return;
    const roleData = matrix[role] ?? {};
    const allFull = selectedTabKeys.every(tabKey => {
      const cellValues = tabCellValuesMap[tabKey];
      const cur = roleData[tabKey] ?? new Set();
      return cellValues ? cellValues.every(v => cur.has(v.key)) : cur.has('true');
    });
    const newRoleData = {};
    selectedTabKeys.forEach(tabKey => {
      const cellValues = tabCellValuesMap[tabKey];
      newRoleData[tabKey] = allFull ? new Set() : (cellValues ? new Set(cellValues.map(v => v.key)) : new Set(['true']));
    });
    commit({ ...matrix, [role]: newRoleData });
  };

  const toggleCol = (tabKey) => {
    if (disabled) return;
    const cellValues = tabCellValuesMap[tabKey];
    const allFull = roleOptions.every(r => {
      const cur = (matrix[r] ?? {})[tabKey] ?? new Set();
      return cellValues ? cellValues.every(v => cur.has(v.key)) : cur.has('true');
    });
    const next = { ...matrix };
    roleOptions.forEach(r => {
      const roleData = { ...(next[r] ?? {}) };
      roleData[tabKey] = allFull ? new Set() : (cellValues ? new Set(cellValues.map(v => v.key)) : new Set(['true']));
      next[r] = roleData;
    });
    commit(next);
  };

  const totalPerms = roleOptions.reduce((acc, r) =>
    acc + selectedTabKeys.reduce((a2, tk) => a2 + ((matrix[r]?.[tk]?.size) ?? 0), 0), 0);

  const [expandedRows, setExpandedRows] = useState(() => new Set(roleOptions));
  const allExpanded = roleOptions.every(r => expandedRows.has(r));

  const toggleExpand = (role) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  };
  const toggleExpandAll = () => {
    setExpandedRows(allExpanded ? new Set() : new Set(roleOptions));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Role × Tab Permissions</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Select which actions each role may perform within each tab.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalPerms > 0 && (
            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {totalPerms} permission{totalPerms !== 1 ? 's' : ''}
            </span>
          )}
          <button
            type="button"
            onClick={toggleExpandAll}
            className="text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
          >
            <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${allExpanded ? 'rotate-90' : ''}`} />
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px] w-44 border-r border-gray-200">
                Role
              </th>
              {selectedTabKeys.map(tabKey => {
                const attr = tabAttrs.find(a => a.key === tabKey);
                const cellValues = tabCellValuesMap[tabKey];
                const allChecked = roleOptions.length > 0 && roleOptions.every(r => {
                  const cur = (matrix[r] ?? {})[tabKey] ?? new Set();
                  return cellValues ? cellValues.every(v => cur.has(v.key)) : cur.has('true');
                });
                const someChecked = !allChecked && roleOptions.some(r => ((matrix[r] ?? {})[tabKey]?.size ?? 0) > 0);
                return (
                  <th key={tabKey} className="px-4 py-3 min-w-[160px] border-r border-gray-200 last:border-r-0 align-top">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                        {attr?.displayName || tabKey}
                      </span>
                      <div
                        title={allChecked ? 'Deselect all' : 'Select all'}
                        role="checkbox"
                        aria-checked={allChecked}
                        aria-disabled={disabled || undefined}
                        tabIndex={disabled ? -1 : 0}
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                          disabled ? 'opacity-40 cursor-not-allowed' :
                          allChecked ? 'bg-primary border-primary' : 'border-gray-300 hover:border-primary/50'
                        }`}
                        onClick={() => !disabled && toggleCol(tabKey)}
                        onKeyDown={(e) => {
                          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggleCol(tabKey);
                          }
                        }}
                      >
                        {allChecked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                        {someChecked && <div className="h-1.5 w-1.5 rounded-sm bg-primary" />}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {roleOptions.map((role, ri) => {
              const roleData = matrix[role] ?? {};
              const isExpanded = expandedRows.has(role);
              const allInRow = selectedTabKeys.every(tabKey => {
                const cellValues = tabCellValuesMap[tabKey];
                const cur = roleData[tabKey] ?? new Set();
                return cellValues ? cellValues.every(v => cur.has(v.key)) : cur.has('true');
              });
              const someInRow = !allInRow && selectedTabKeys.some(tabKey => ((roleData[tabKey]?.size) ?? 0) > 0);
              const rowPermCount = selectedTabKeys.reduce((a, tk) => a + ((roleData[tk]?.size) ?? 0), 0);

              return (
                <tr key={role} className={`border-b border-gray-100 last:border-b-0 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  {/* Role cell */}
                  <td className="px-3 py-2.5 border-r border-gray-200 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(role)}
                        className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 shrink-0 transition-colors rounded hover:bg-gray-100"
                        title={isExpanded ? 'Collapse row' : 'Expand row'}
                      >
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <div
                        role="checkbox"
                        aria-checked={allInRow}
                        aria-disabled={disabled || undefined}
                        tabIndex={disabled ? -1 : 0}
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          disabled ? 'opacity-40 cursor-not-allowed' :
                          allInRow ? 'bg-primary border-primary' : 'border-gray-300 hover:border-primary/50'
                        }`}
                        onClick={() => !disabled && toggleRow(role)}
                        onKeyDown={(e) => {
                          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggleRow(role);
                          }
                        }}
                      >
                        {allInRow && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                        {someInRow && <div className="h-1.5 w-1.5 rounded-sm bg-primary" />}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-gray-800 block">{role}</span>
                        {!isExpanded && rowPermCount > 0 && (
                          <span className="text-[10px] text-primary font-medium">
                            {rowPermCount} permission{rowPermCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {!isExpanded && rowPermCount === 0 && (
                          <span className="text-[10px] text-gray-400">No permissions set</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Tab cells */}
                  {selectedTabKeys.map(tabKey => {
                    const cellValues = tabCellValuesMap[tabKey];
                    const current = roleData[tabKey] ?? new Set();

                    if (!isExpanded) {
                      // Collapsed: show compact summary chips
                      const selected = cellValues
                        ? cellValues.filter(v => current.has(v.key))
                        : (current.has('true') ? [{ key: 'true', label: '✓' }] : []);
                      return (
                        // NOSONAR: pointer-only shortcut; the row's chevron button already
                        // provides a fully keyboard-accessible way to toggle the same expand state
                        <td
                          key={tabKey}
                          className="px-3 py-2.5 border-r border-gray-100 last:border-r-0 align-middle cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleExpand(role)}
                        >
                          {selected.length === 0 ? (
                            <span className="text-[10px] text-gray-300 italic">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {selected.map(({ key: k, label: l }) => (
                                <span key={k} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                                  {l}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    }

                    // Expanded: full checkbox list
                    if (!cellValues) {
                      const checked = current.has('true');
                      return (
                        <td key={tabKey} className="px-4 py-3 text-center border-r border-gray-100 last:border-r-0 align-top">
                          <div
                            role="checkbox"
                            aria-checked={checked}
                            aria-disabled={disabled || undefined}
                            tabIndex={disabled ? -1 : 0}
                            className={`h-5 w-5 rounded border-2 inline-flex items-center justify-center transition-all cursor-pointer mx-auto ${
                              disabled ? 'opacity-40 cursor-not-allowed' :
                              checked ? 'bg-primary border-primary shadow-sm' : 'border-gray-300 hover:border-primary/60 hover:bg-primary/5'
                            }`}
                            onClick={() => toggleValue(role, tabKey, 'true')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleValue(role, tabKey, 'true');
                              }
                            }}
                          >
                            {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                        </td>
                      );
                    }

                    const allValChecked = cellValues.every(v => current.has(v.key));
                    const someValChecked = !allValChecked && cellValues.some(v => current.has(v.key));
                    return (
                      <td key={tabKey} className="px-3 py-2.5 border-r border-gray-100 last:border-r-0 align-top">
                        <div
                          role="checkbox"
                          aria-checked={allValChecked}
                          aria-disabled={disabled || undefined}
                          tabIndex={disabled ? -1 : 0}
                          className={`flex items-center gap-1.5 mb-2 pb-1.5 border-b border-gray-100 cursor-pointer group ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                          onClick={() => !disabled && toggleAllInCell(role, tabKey)}
                          onKeyDown={(e) => {
                            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              toggleAllInCell(role, tabKey);
                            }
                          }}
                        >
                          <div className={`h-3.5 w-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            allValChecked ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-primary/50'
                          }`}>
                            {allValChecked && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                            {someValChecked && <div className="h-1 w-1 rounded-sm bg-primary" />}
                          </div>
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide group-hover:text-gray-600">All</span>
                        </div>
                        <div className="space-y-1.5">
                          {cellValues.map(({ key: valKey, label }) => {
                            const checked = current.has(valKey);
                            return (
                              <div
                                key={valKey}
                                role="checkbox"
                                aria-checked={checked}
                                aria-disabled={disabled || undefined}
                                tabIndex={disabled ? -1 : 0}
                                className={`flex items-center gap-1.5 rounded px-1 py-0.5 cursor-pointer group transition-colors ${
                                  disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary/5'
                                }`}
                                onClick={() => !disabled && toggleValue(role, tabKey, valKey)}
                                onKeyDown={(e) => {
                                  if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    toggleValue(role, tabKey, valKey);
                                  }
                                }}
                              >
                                <div className={`h-3.5 w-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  checked ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-primary/50'
                                }`}>
                                  {checked && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                                </div>
                                <span className={`text-[11px] transition-colors select-none ${
                                  checked ? 'text-gray-900 font-medium' : 'text-gray-500 group-hover:text-gray-700'
                                }`}>
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PolicyConditionBuilder — unified builder (replaces tabs)
// ---------------------------------------------------------------------------

function PolicyConditionBuilder({ value, onChange, disabled, attributeDefs }) {
  const tree = normalizeConditions(value);
  // Root of the common-conditions tree is always AND'd with the role/stage/action
  // matrix (and with itself), so lock the root operator to AND. Users can still
  // nest OR groups as children for "any of these" sub-conditions.
  const rootTree = { ...tree, operator: 'AND' };
  const handleChange = (newTree) => onChange({ ...newTree, operator: 'AND' });
  return (
    <div className="space-y-3">
      <ConditionGroupRenderer tree={rootTree} onChange={handleChange} disabled={disabled}
        attributeDefs={attributeDefs} depth={0} lockOperator ConditionRowComponent={ConditionRow}
      />
      <ConditionJsonEditor tree={rootTree} onChange={handleChange} disabled={disabled} />
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

  // This panel is only mounted by the parent once the attribute defs the
  // role-tab matrix depends on have loaded, so the form initializes a single
  // time with the matrix layout already resolved — the plain (non-matrix)
  // layout never flashes on first open.
  useEffect(() => {
    if (!policy) return;

    // Determine whether the stored conditions contain matrix nodes so we can
    // split them into separate state fields — one for the matrix, one for the
    // condition builder — keeping the two UIs independent.
    const subjectAttrs = attributeDefs.filter(a => a.namespace === 'subject');
    const roleDef = subjectAttrs.find(a => {
      let c = a.constraints || {};
      if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
      return /(_role|^role)$/i.test(a.key) && Array.isArray(c.allowedValues) && c.allowedValues.length > 0;
    });
    const actionAttrs = attributeDefs.filter(a => a.namespace === 'action');
    const tabAttrs = actionAttrs.filter(a => {
      let c = a.constraints || {};
      if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
      return !!c.action_tab;
    });
    const allTabKeys = tabAttrs.map(a => a.key);
    const storedTabKeys = (policy.actions ?? []).filter(k => allTabKeys.includes(k));
    // `actions` isn't persisted on the policy, so also detect tabs referenced
    // directly inside the saved conditions tree (e.g. published policies).
    const conditionTabKeys = extractTabKeysFromConditions(policy.conditions, allTabKeys);
    const selectedTabKeys = [...new Set([...storedTabKeys, ...conditionTabKeys])];

    let matrixConditions = DEFAULT_CONDITIONS;
    let extraConditions  = policy.conditions ?? DEFAULT_CONDITIONS;

    if (roleDef && selectedTabKeys.length > 0) {
      const split = partitionConditions(policy.conditions ?? DEFAULT_CONDITIONS, roleDef.key, selectedTabKeys);
      matrixConditions = split.matrix;
      extraConditions  = split.extra;
    }

    setForm({
      name:             policy.name,
      description:      policy.description ?? '',
      priority:         policy.priority,
      effect:           policy.effect === 'PERMIT' ? 'ALLOW' : policy.effect,
      conditions:       extraConditions,
      matrixConditions,
      actions:          selectedTabKeys,
    });
  }, [policy?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = form && policy && (
    form.name !== policy.name ||
    form.description !== (policy.description ?? '') ||
    form.priority !== policy.priority ||
    form.effect !== (policy.effect === 'PERMIT' ? 'ALLOW' : policy.effect) ||
    JSON.stringify(mergeFormConditions(form.matrixConditions, form.conditions)) !== JSON.stringify(policy.conditions)
  );

  const updateMutation = useMutation({
    mutationFn: (data) =>
      appPolicyService.update(appKey, policy.id, data),
    onSuccess: () => {
      toast({ title: 'Policy saved' });
      queryClient.invalidateQueries({ queryKey: QK.appPolicy(policy.id) });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appPolicies', appKey] });
      queryClient.invalidateQueries({ queryKey: QK.appPolicyVersions(appKey, policy.id) });
    },
    onError: (err) => toast({
      title: 'Save failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const statusMutation = useMutation({
    mutationFn: (status) =>
      appPolicyService.setStatus(appKey, policy.id, status),
    onSuccess: (_, status) => {
      toast({ title: `Policy ${status}` });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appPolicies', appKey] });
      queryClient.invalidateQueries({ queryKey: QK.appPolicy(policy.id) });
    },
    onError: (err) => toast({
      title: 'Status change failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (version) =>
      appPolicyService.rollback(appKey, policy.id, version),
    onSuccess: () => {
      toast({ title: 'Rolled back successfully' });
      queryClient.invalidateQueries({ queryKey: QK.appPolicy(policy.id) });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appPolicies', appKey] });
      queryClient.invalidateQueries({ queryKey: QK.appPolicyVersions(appKey, policy.id) });
    },
    onError: (err) => toast({
      title: 'Rollback failed',
      description: err.message,
      variant: 'destructive'
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => appPolicyService.delete(appKey, policy.id),
    onSuccess: () => {
      toast({ title: 'Policy deleted permanently' });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appPolicies', appKey] });
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
      priority:    Number.parseInt(form.priority) || 10,
      effect:      form.effect,
      conditions:  mergeFormConditions(form.matrixConditions, form.conditions),
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

          {(() => {
            const actionAttrs = attributeDefs.filter(a => a.namespace === 'action');
            const hasTabAttrs = actionAttrs.some(a => { let c = a.constraints || {}; if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } } return !!c.action_tab; });
            if (!hasTabAttrs) return null;
            return (
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Application Tabs</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Select which tabs this policy applies to</p>
                  </div>
                </div>
                <ActionTabSelector
                  actionAttrs={actionAttrs}
                  selectedActions={form.actions ?? []}
                  onChange={actions => setForm(f => ({ ...f, actions }))}
                  disabled={isArchived}
                />
              </div>
            );
          })()}

          <Separator className="my-2" />

          {(() => {
            const subjectAttrs = attributeDefs.filter(a => a.namespace === 'subject');
            const roleDef = subjectAttrs.find(a => {
              let c = a.constraints || {};
              if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
              return /(_role|^role)$/i.test(a.key) && Array.isArray(c.allowedValues) && c.allowedValues.length > 0;
            });
            const actionAttrs = attributeDefs.filter(a => a.namespace === 'action');
            const tabAttrs = actionAttrs.filter(a => { let c = a.constraints || {}; if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } } return !!c.action_tab; });
            const selectedTabKeys = (form.actions ?? []).filter(k => tabAttrs.some(a => a.key === k));
            let roleOptions = [];
            if (roleDef) {
              let c = roleDef.constraints || {};
              if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
              roleOptions = c.allowedValues ?? [];
            }
            const showMatrix = selectedTabKeys.length > 0 && roleDef && roleOptions.length > 0;

            const merged = mergeFormConditions(form.matrixConditions, form.conditions);

            return (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wider">
                      {showMatrix ? 'Additional Conditions' : 'Conditions'}
                    </Label>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {showMatrix
                        ? 'Extra attribute conditions applied on top of the role-tab matrix below.'
                        : 'Leave empty to apply the effect to all requests.'}
                    </p>
                  </div>
                  <PolicyConditionBuilder
                    value={form.conditions}
                    onChange={conditions => setForm(f => ({ ...f, conditions }))}
                    disabled={isArchived}
                    attributeDefs={attributeDefs}
                  />
                </div>

                {showMatrix && (
                  <>
                    <PolicyTabRoleMatrix
                      key={`${policy.id}-${selectedTabKeys.join(',')}`}
                      selectedTabKeys={selectedTabKeys}
                      tabAttrs={tabAttrs}
                      allActionAttrs={actionAttrs}
                      roleDef={roleDef}
                      roleOptions={roleOptions}
                      conditions={form.matrixConditions}
                      onChange={matrixConditions => setForm(f => ({ ...f, matrixConditions }))}
                      disabled={isArchived}
                    />
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-gray-500 uppercase tracking-wider">Merged Conditions</Label>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Final condition sent to the engine — combination of the matrix and any additional conditions above.
                        </p>
                      </div>
                      <ConditionJsonEditor
                        tree={normalizeConditions(merged)}
                        onChange={newTree => {
                          const split = partitionConditions(newTree, roleDef.key, selectedTabKeys);
                          setForm(f => ({ ...f, matrixConditions: split.matrix, conditions: split.extra }));
                        }}
                        disabled={isArchived}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })()}

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
    name:             '',
    description:      '',
    priority:         10,
    effect:           'ALLOW',
    conditions:       DEFAULT_CONDITIONS,
    matrixConditions: DEFAULT_CONDITIONS,
    actions:          [],
  });
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const isFormDirty = (
    form.name.trim() !== '' ||
    form.description.trim() !== '' ||
    form.conditions.conditions?.length > 0 ||
    form.matrixConditions.conditions?.length > 0
  );

  const handleCancel = () => {
    if (isFormDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  };

  const createMutation = useMutation({
    mutationFn: () => {
      return appPolicyService.create(appKey, {
        name:        form.name,
        description: form.description || undefined,
        priority:    Number.parseInt(form.priority) || 10,
        effect:      form.effect,
        conditions:  mergeFormConditions(form.matrixConditions, form.conditions),
      });
    },
    onSuccess: (res) => {
      toast({ title: 'Policy created as draft' });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appPolicies', appKey] });
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
          {createTitle}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
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

          {(() => {
            const actionAttrs = attributeDefs.filter(a => a.namespace === 'action');
            const hasTabAttrs = actionAttrs.some(a => { let c = a.constraints || {}; if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } } return !!c.action_tab; });
            if (!hasTabAttrs) return null;
            return (
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Application Tabs</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Select which tabs this policy applies to</p>
                  </div>
                </div>
                <ActionTabSelector
                  actionAttrs={actionAttrs}
                  selectedActions={form.actions ?? []}
                  onChange={actions => setForm(f => ({ ...f, actions }))}
                />
              </div>
            );
          })()}

          <Separator />

          {(() => {
            const subjectAttrs = attributeDefs.filter(a => a.namespace === 'subject');
            const roleDef = subjectAttrs.find(a => {
              let c = a.constraints || {};
              if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
              return /(_role|^role)$/i.test(a.key) && Array.isArray(c.allowedValues) && c.allowedValues.length > 0;
            });
            const actionAttrs = attributeDefs.filter(a => a.namespace === 'action');
            const tabAttrs = actionAttrs.filter(a => { let c = a.constraints || {}; if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } } return !!c.action_tab; });
            const selectedTabKeys = (form.actions ?? []).filter(k => tabAttrs.some(a => a.key === k));
            let roleOptions = [];
            if (roleDef) {
              let c = roleDef.constraints || {};
              if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
              roleOptions = c.allowedValues ?? [];
            }
            const showMatrix = selectedTabKeys.length > 0 && roleDef && roleOptions.length > 0;

            const merged = mergeFormConditions(form.matrixConditions, form.conditions);

            return (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wider">
                      {showMatrix ? 'Additional Conditions' : 'Conditions'}
                    </Label>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {showMatrix
                        ? 'Extra attribute conditions applied on top of the role-tab matrix below.'
                        : 'Leave empty to apply the effect to all requests.'}
                    </p>
                  </div>
                  <PolicyConditionBuilder
                    value={form.conditions}
                    onChange={conditions => setForm(f => ({ ...f, conditions }))}
                    attributeDefs={attributeDefs}
                  />
                </div>

                {showMatrix && (
                  <>
                    <PolicyTabRoleMatrix
                      key={selectedTabKeys.join(',')}
                      selectedTabKeys={selectedTabKeys}
                      tabAttrs={tabAttrs}
                      allActionAttrs={actionAttrs}
                      roleDef={roleDef}
                      roleOptions={roleOptions}
                      conditions={form.matrixConditions}
                      onChange={matrixConditions => setForm(f => ({ ...f, matrixConditions }))}
                    />
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-gray-500 uppercase tracking-wider">Merged Conditions</Label>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Final condition sent to the engine — combination of the matrix and any additional conditions above.
                        </p>
                      </div>
                      <ConditionJsonEditor
                        tree={normalizeConditions(merged)}
                        onChange={newTree => {
                          const split = partitionConditions(newTree, roleDef.key, selectedTabKeys);
                          setForm(f => ({ ...f, matrixConditions: split.matrix, conditions: split.extra }));
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })()}


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
// HubGlobalConfigTab — always read-only view of hub-level settings
// ---------------------------------------------------------------------------

function HubGlobalConfigTab({ appName }) {
  const [expandedId, setExpandedId] = useState(null);

  const { data: globalPoliciesData, isLoading: policiesLoading } = useQuery({
    queryKey: QK.globalPolicies('active'),
    queryFn: () => globalPolicyService.list({ status: 'active' }),
  });
  const globalPolicies = globalPoliciesData?.data?.data ?? globalPoliciesData?.data ?? [];

  const { data: hubAttrsData, isLoading: attrsLoading } = useQuery({
    queryKey: QK.hubAttributes,
    queryFn: () => hubAttributeService.list(),
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
    queryKey: QK.appPolicies(appKey, listFilter),
    queryFn: () => appPolicyService.list(
      appKey,
      listFilter !== 'all' ? { status: listFilter } : {}
    ),
  });
  const policies = policiesData?.data?.data ?? policiesData?.data ?? [];

  const filteredPolicies = policies.filter(p =>
    !listSearch ||
    p.name.toLowerCase().includes(listSearch.toLowerCase()) ||
    p.description?.toLowerCase().includes(listSearch.toLowerCase())
  );

  const { data: selectedData } = useQuery({
    queryKey: QK.appPolicy(selectedPolicyId),
    queryFn: () => appPolicyService.get(appKey, selectedPolicyId),
    enabled: !!selectedPolicyId,
    staleTime: 10_000,
  });
  const selectedPolicy =
    selectedData?.data?.data ?? selectedData?.data ?? null;

  const attrsEnabled = showCreatePanel || !!selectedPolicyId;

  const { data: appAttrsData, isFetched: appAttrsFetched } = useQuery({
    queryKey: QK.appAttributes(appKey),
    queryFn: () => appAttributeService.list(appKey),
    enabled: attrsEnabled,
  });

  const { data: hubAttrsData, isFetched: hubAttrsFetched } = useQuery({
    queryKey: QK.hubAttributes,
    queryFn: () => hubAttributeService.list(),
    enabled: attrsEnabled,
  });

  const hubDefs = (hubAttrsData?.data?.data ?? hubAttrsData?.data ?? []).map(a => ({ ...a, _source: 'hub' }));
  const appDefs = (appAttrsData?.data?.data ?? appAttrsData?.data ?? []).map(a => ({ ...a, _source: 'app' }));
  const attributeDefs = [...hubDefs, ...appDefs];
  // True until both attribute-def queries have resolved at least once. The
  // role-tab matrix depends on these defs, so the editor must wait for them
  // before rendering the condition section — otherwise the plain (non-matrix)
  // builder flashes for a second before the matrix appears.
  const attrsLoading = attrsEnabled && !(appAttrsFetched && hubAttrsFetched);

  const { data: versionsData } = useQuery({
    queryKey: QK.appPolicyVersions(appKey, selectedPolicyId),
    queryFn: () => appPolicyService.getVersions(appKey, selectedPolicyId),
    enabled: !!selectedPolicyId,
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

          {/* Wait for the attribute defs the role-tab matrix needs before
              mounting the editor, so it renders the matrix layout directly
              instead of briefly showing the plain (non-matrix) layout. */}
          {!showCreatePanel && selectedPolicyId && (!selectedPolicy || attrsLoading) && (
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 p-6">
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-gray-200 animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {!showCreatePanel && selectedPolicyId && selectedPolicy && !attrsLoading && (
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
