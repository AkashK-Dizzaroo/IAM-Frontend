import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function normalizeList(res) {
  return res?.data?.data ?? res?.data ?? [];
}

export function AppUserAttributesPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [form, setForm] = useState({ attributeDefId: '', value: '' });

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['abac', 'users', 'appUserAttrsPicker'],
    queryFn: () => abacService.listUsers({ limit: 200 }),
  });
  const users = normalizeList(usersData);

  const { data: attrDefsData } = useQuery({
    queryKey: ['abac', 'appAttributes', selectedAppKey],
    queryFn: () => abacService.listAppAttrDefs(selectedAppKey),
    enabled: !!selectedAppKey,
  });
  const attributeDefs = normalizeList(attrDefsData);

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
      abacService.deleteAppUserAttr(
        selectedAppKey,
        selectedUserId,
        attributeDefId
      ),
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

  const handleAssign = () => {
    let parsedValue = form.value;
    const def = attributeDefs.find((d) => d.id === form.attributeDefId);
    if (
      def &&
      (def.dataType === 'number' ||
        def.dataType === 'boolean' ||
        def.dataType === 'list')
    ) {
      try {
        parsedValue = JSON.parse(form.value);
      } catch {
        /* backend validates */
      }
    }
    assignMutation.mutate({
      attributeDefId: form.attributeDefId,
      value: parsedValue,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {selectedAppName || selectedAppKey} User Attributes
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign app-specific attributes to users to be evaluated in app policies.
        </p>
      </div>

      <div className="w-full max-w-md space-y-2">
        <Label>Select User</Label>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger>
            <SelectValue
              placeholder={loadingUsers ? 'Loading users…' : 'Select a user…'}
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
      </div>

      {selectedUserId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start border-t border-gray-100 pt-8">
          <div className="md:col-span-1 p-5 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
            <h3 className="font-medium text-gray-900">Assign New Attribute</h3>
            <div className="space-y-1.5">
              <Label>Attribute</Label>
              <Select
                value={form.attributeDefId}
                onValueChange={(v) => setForm({ ...form, attributeDefId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select attribute…" />
                </SelectTrigger>
                <SelectContent>
                  {attributeDefs.map((def) => (
                    <SelectItem key={def.id} value={def.id}>
                      {def.displayName} ({def.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input
                placeholder="Enter value…"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
              <p className="text-[10px] text-gray-500">
                For lists/booleans, use valid JSON.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleAssign}
              disabled={
                !form.attributeDefId ||
                form.value === '' ||
                assignMutation.isPending
              }
            >
              {assignMutation.isPending ? 'Assigning…' : 'Assign Attribute'}
            </Button>
          </div>

          <div className="md:col-span-2">
            <h3 className="font-medium text-gray-900 mb-4">Current Attributes</h3>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 font-medium">Attribute Key</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingUserAttrs ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : userAttributes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No app attributes assigned.
                      </td>
                    </tr>
                  ) : (
                    userAttributes.map((attr) => (
                      <tr key={attr.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">
                          {attr.attributeDef?.key ?? 'Unknown'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {typeof attr.value === 'object'
                            ? JSON.stringify(attr.value)
                            : String(attr.value)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() =>
                              removeMutation.mutate(attr.attributeDefId)
                            }
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
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
