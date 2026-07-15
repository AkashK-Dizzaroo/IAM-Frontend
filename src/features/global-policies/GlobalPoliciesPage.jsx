import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QK } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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

  return (
    <div className="
      flex items-center gap-2 p-3 rounded-md
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
          h-10 text-sm border border-input rounded-md px-3
          bg-white text-gray-700 focus:outline-none
          focus:ring-2 focus:ring-ring/40 focus:border-primary
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
            flex-1 min-w-0 h-10 text-sm border border-input
            rounded-md px-3 font-mono
            bg-white text-gray-900
            focus:outline-none focus:ring-2
            focus:ring-ring/40 focus:border-primary
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
            flex-1 min-w-0 h-10 text-sm border border-input
            rounded-md px-3 font-mono
            bg-white text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2
            focus:ring-ring/40 focus:border-primary
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
          h-10 text-sm border border-input rounded-md px-3
          bg-white text-gray-700 focus:outline-none
          focus:ring-2 focus:ring-ring/40 focus:border-primary
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
                flex-1 min-w-0 h-10 text-sm border border-input
                rounded-md px-3
                bg-white text-gray-900
                focus:outline-none focus:ring-2
                focus:ring-ring/40 focus:border-primary
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
                flex-1 min-w-0 h-10 text-sm border border-input
                rounded-md px-3
                bg-white text-gray-900
                focus:outline-none focus:ring-2
                focus:ring-ring/40 focus:border-primary
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
              flex-1 min-w-0 h-10 text-sm border border-input
              rounded-md px-3 font-mono
              bg-white text-gray-900 placeholder-gray-400
              focus:outline-none focus:ring-2
              focus:ring-ring/40 focus:border-primary
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
// PolicyConditionBuilder — unified builder (replaces tabs)
// ---------------------------------------------------------------------------

function PolicyConditionBuilder({ value, onChange, disabled, attributeDefs }) {
  const tree = normalizeConditions(value);
  return (
    <div className="space-y-3">
      <ConditionGroupRenderer tree={tree} onChange={onChange} disabled={disabled}
        attributeDefs={attributeDefs} depth={0} ConditionRowComponent={ConditionRow}
      />
      <ConditionJsonEditor tree={tree} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PolicyPriorityEffectFields — shared by PolicyEditorPanel and PolicyCreatePanel
// ---------------------------------------------------------------------------

function PolicyPriorityEffectFields({ priority, onPriorityChange, effect, onEffectChange, disabled }) {
  return (
    <div className="flex items-start gap-6">
      <div className="space-y-1.5 w-32">
        <Label className="text-xs text-gray-500 uppercase tracking-wider">
          Priority
        </Label>
        <Input
          type="number"
          min={1}
          max={1000}
          value={priority}
          disabled={disabled}
          onChange={e => onPriorityChange(e.target.value)}
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
        <div className="flex w-fit rounded-md border border-gray-200 overflow-hidden">
          {['ALLOW', 'DENY'].map(eff => (
            <button
              key={eff}
              type="button"
              disabled={disabled}
              onClick={() => onEffectChange(eff)}
              className={`
                inline-flex w-24 items-center justify-center py-2 text-sm font-semibold
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${effect === eff
                  ? eff === 'ALLOW'
                    ? 'bg-success text-success-foreground'
                    : 'bg-destructive text-destructive-foreground'
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
              {isDirty && policy.status === 'active' && (
                <div className="text-xs text-warning bg-warning-soft border border-warning/30 rounded-md px-3 py-1.5 mr-1">
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
              className="bg-success hover:bg-success/90 text-success-foreground"
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
              className="text-warning border-warning/30 hover:bg-warning-soft"
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
                className="text-destructive border-destructive/30 hover:bg-destructive-soft"
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
                className="text-success border-success/30 hover:bg-success-soft"
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

          <PolicyPriorityEffectFields
            priority={form.priority}
            onPriorityChange={(value) => setForm(f => ({ ...f, priority: value }))}
            effect={form.effect}
            onEffectChange={(eff) => setForm(f => ({ ...f, effect: eff }))}
            disabled={isArchived}
          />

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

          <PolicyPriorityEffectFields
            priority={form.priority}
            onPriorityChange={(value) => setForm(f => ({ ...f, priority: value }))}
            effect={form.effect}
            onEffectChange={(eff) => setForm(f => ({ ...f, effect: eff }))}
          />

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
