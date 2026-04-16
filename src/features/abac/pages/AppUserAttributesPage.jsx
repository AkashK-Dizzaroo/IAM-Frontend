import React, { useState, useMemo } from 'react';
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

function normalizeList(res) {
  return res?.data?.data ?? res?.data ?? [];
}

// Renders the appropriate value input based on the attribute definition
function ValueInput({ def, value, onChange }) {
  if (!def) {
    return (
      <Input
        placeholder="Select an attribute first…"
        value={value}
        disabled
      />
    );
  }

  const { dataType, isMultiValued, constraints } = def;
  const allowedValues = constraints?.allowedValues ?? [];

  // Multi-valued: checkbox list of allowed values
  if (isMultiValued && allowedValues.length > 0) {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (v) => {
      const next = selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v];
      onChange(next);
    };
    return (
      <div className="space-y-1.5 rounded-md border border-gray-200 p-3 bg-white">
        {allowedValues.map((v) => (
          <div key={v} className="flex items-center gap-2">
            <Checkbox
              id={`mv-${v}`}
              checked={selected.includes(v)}
              onCheckedChange={() => toggle(v)}
            />
            <Label htmlFor={`mv-${v}`} className="font-mono text-sm cursor-pointer">
              {v}
            </Label>
          </div>
        ))}
        {selected.length > 0 && (
          <p className="text-xs text-gray-400 pt-1">{selected.length} selected</p>
        )}
      </div>
    );
  }

  // Multi-valued but no allowed values (free-form list): comma-separated input
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

  // Single-value enum: dropdown
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

  // Boolean: dropdown
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

  // Number: number input
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
          <p className="text-[10px] text-gray-500">
            Range: {min ?? '—'} to {max ?? '—'}
          </p>
        )}
      </>
    );
  }

  // Default: free text
  return (
    <Input
      placeholder="Enter value…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Renders a value cell in the table nicely
function ValueCell({ value, def }) {
  const isMultiValued = def?.isMultiValued;
  const arr = Array.isArray(value) ? value : null;

  if (arr || isMultiValued) {
    const items = arr ?? (typeof value === 'string' ? value.split(',').map((v) => v.trim()) : [String(value)]);
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((v, i) => (
          <Badge key={i} variant="secondary" className="font-mono text-xs">{String(v)}</Badge>
        ))}
      </div>
    );
  }

  return (
    <span className="font-mono text-xs text-gray-500">
      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
    </span>
  );
}

export function AppUserAttributesPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [form, setForm] = useState({ attributeDefId: '', value: '' });
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(true);

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['abac', 'users', 'appUserAttrsPicker'],
    queryFn: () => abacService.listUsers({ limit: 200 }),
  });
  const allUsers = normalizeList(usersData);

  // Fetch users assigned to this specific app so we can scope the picker
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
    ? allUsers.filter(u => assignedUserIds.has(String(u.id)))
    : allUsers;

  const { data: attrDefsData } = useQuery({
    queryKey: ['abac', 'appAttributes', selectedAppKey],
    queryFn: () => abacService.listAppAttrDefs(selectedAppKey),
    enabled: !!selectedAppKey,
  });
  const attributeDefs = normalizeList(attrDefsData);

  // Derive which attribute keys are referenced by active policies
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

  const assignMutation = useMutation({
    mutationFn: (data) =>
      abacService.setAppUserAttr(selectedAppKey, selectedUserId, data),
    onSuccess: () => {
      toast({ title: 'Attribute assigned successfully' });
      queryClient.invalidateQueries({
        queryKey: ['abac', 'appUserAttributes', selectedAppKey, selectedUserId],
      });
      setForm({ attributeDefId: '', value: '' });
    },
    onError: (err) =>
      toast({
        title: 'Failed to assign',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (attributeDefId) =>
      abacService.deleteAppUserAttr(selectedAppKey, selectedUserId, attributeDefId),
    onSuccess: () => {
      toast({ title: 'Attribute removed' });
      queryClient.invalidateQueries({
        queryKey: ['abac', 'appUserAttributes', selectedAppKey, selectedUserId],
      });
    },
    onError: (err) =>
      toast({
        title: 'Failed to remove',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
  });

  if (!selectedAppKey) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">
          Select an application to manage user attributes.
        </p>
      </div>
    );
  }

  const selectedDef = attributeDefs.find((d) => d.id === form.attributeDefId) ?? null;

  const handleAttrDefChange = (defId) => {
    // Reset value appropriately when switching attribute
    const def = attributeDefs.find((d) => d.id === defId);
    const emptyValue = def?.isMultiValued ? [] : '';
    setForm({ attributeDefId: defId, value: emptyValue });
  };

  const isValueEmpty = () => {
    if (Array.isArray(form.value)) return form.value.length === 0;
    return form.value === '' || form.value === null || form.value === undefined;
  };

  const handleAssign = () => {
    assignMutation.mutate({
      attributeDefId: form.attributeDefId,
      value: form.value,
    });
  };

  // Build a def lookup map for the table
  const defById = Object.fromEntries(attributeDefs.map((d) => [d.id, d]));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {selectedAppName || selectedAppKey} — User Attributes
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign app-specific attributes to users to be evaluated in app policies.
        </p>
      </div>

      <div className="w-full max-w-md space-y-2">
        <div className="flex items-center justify-between">
          <Label>Select User</Label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyAssigned}
              onChange={e => {
                setShowOnlyAssigned(e.target.checked);
                setSelectedUserId('');
              }}
              className="rounded"
            />
            Show only users assigned to this app
          </label>
        </div>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger>
            <SelectValue
              placeholder={loadingUsers ? 'Loading users…' : users.length === 0 ? 'No users found' : 'Select a user…'}
            />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.displayName || u.email || u.username || u.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showOnlyAssigned && users.length === 0 && !loadingUsers && (
          <p className="text-xs text-gray-400">No users assigned to this app yet.</p>
        )}
      </div>

      {selectedUserId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start border-t border-gray-100 pt-8">

          {/* Assign panel */}
          <div className="md:col-span-1 p-5 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
            <h3 className="font-medium text-gray-900">Assign Attribute</h3>

            <div className="space-y-1.5">
              <Label>Attribute</Label>
              <Select
                value={form.attributeDefId}
                onValueChange={handleAttrDefChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select attribute…" />
                </SelectTrigger>
                <SelectContent>
                  {attributeDefs.map((def) => {
                    const isReferenced = referencedKeys.has(def.key);
                    return (
                      <SelectItem key={def.id} value={def.id}>
                        <span className="flex items-center gap-2">
                          {def.displayName} ({def.key})
                          {isReferenced && (
                            <span className="text-[10px] text-green-700 font-semibold">● policy</span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Show type + multi-valued hint + policy coverage status */}
              {selectedDef && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="text-xs capitalize">
                    {selectedDef.dataType}
                  </Badge>
                  {selectedDef.isMultiValued && (
                    <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                      multi-valued
                    </Badge>
                  )}
                  {selectedDef.isRequired && (
                    <Badge variant="outline" className="text-xs text-red-700 border-red-300">
                      required
                    </Badge>
                  )}
                  {referencedKeys.has(selectedDef.key) ? (
                    <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                      ✓ referenced in active policy
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-gray-400 border-gray-200">
                      not in any active policy
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Value</Label>
              <ValueInput
                def={selectedDef}
                value={form.value}
                onChange={(v) => setForm((f) => ({ ...f, value: v }))}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAssign}
              disabled={!form.attributeDefId || isValueEmpty() || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Assigning…' : 'Assign Attribute'}
            </Button>
          </div>

          {/* Current attributes table */}
          <div className="md:col-span-2">
            <h3 className="font-medium text-gray-900 mb-4">Current Attributes</h3>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 font-medium">Attribute</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingUserAttrs ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        Loading…
                      </td>
                    </tr>
                  ) : userAttributes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No app attributes assigned.
                      </td>
                    </tr>
                  ) : (
                    userAttributes.map((attr) => {
                      const def = defById[attr.attributeDefId];
                      const key = attr.attributeDef?.key ?? attr.attribute_name ?? def?.key ?? 'Unknown';
                      const displayName = attr.attributeDef?.displayName ?? def?.displayName;
                      return (
                        <tr key={attr.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {displayName && (
                              <p className="text-sm font-medium text-gray-900">{displayName}</p>
                            )}
                            <p className="font-mono text-xs text-gray-400">{key}</p>
                          </td>
                          <td className="px-4 py-3">
                            {def ? (
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className="text-xs capitalize w-fit">
                                  {def.dataType}
                                </Badge>
                                {def.isMultiValued && (
                                  <Badge variant="outline" className="text-xs text-purple-700 border-purple-300 w-fit">
                                    multi
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ValueCell value={attr.value} def={def} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => removeMutation.mutate(attr.attributeDefId)}
                              disabled={removeMutation.isPending}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
