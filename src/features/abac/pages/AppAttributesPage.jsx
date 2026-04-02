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

export function AppAttributesPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const selectedApp = selectedAppKey
    ? { key: selectedAppKey, name: selectedAppName ?? selectedAppKey }
    : null;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    namespace: 'subject',
    key: '',
    displayName: '',
    dataType: 'string',
    isRequired: false,
  });

  if (!selectedApp) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to manage its attributes.</p>
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ['abac', 'appAttributes', selectedApp.key],
    queryFn: () => abacService.listAppAttrDefs(selectedApp.key),
    enabled: !!selectedApp.key,
  });
  const attributes = data?.data?.data ?? data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (newAttr) => abacService.createAppAttrDef(selectedApp.key, newAttr),
    onSuccess: () => {
      toast({ title: 'Attribute created' });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appAttributes', selectedApp.key] });
      setIsCreating(false);
      setForm({
        namespace: 'subject',
        key: '',
        displayName: '',
        dataType: 'string',
        isRequired: false,
      });
    },
    onError: (err) =>
      toast({
        title: 'Failed to create',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => abacService.deleteAppAttrDef(selectedApp.key, id),
    onSuccess: () => {
      toast({ title: 'Attribute deleted' });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appAttributes', selectedApp.key] });
    },
    onError: (err) =>
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const handleSave = () => {
    createMutation.mutate({
      namespace: form.namespace,
      key: form.key.trim(),
      displayName: form.displayName.trim(),
      dataType: form.dataType,
      isRequired: form.isRequired,
      constraints: {},
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{selectedApp.name} Attributes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define attributes that are specific to this application. These cannot conflict with Hub Attributes.
          </p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? 'Cancel' : '+ New Attribute'}
        </Button>
      </div>

      {isCreating && (
        <div className="p-5 bg-gray-50 border border-gray-100 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                placeholder="e.g. Project ID"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Key (no spaces)</Label>
              <Input
                placeholder="e.g. project_id"
                className="font-mono text-sm"
                value={form.key}
                onChange={(e) =>
                  setForm({
                    ...form,
                    key: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Namespace</Label>
              <Select value={form.namespace} onValueChange={(v) => setForm({ ...form, namespace: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subject">Subject (User)</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                  <SelectItem value="environment">Environment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data Type</Label>
              <Select value={form.dataType} onValueChange={(v) => setForm({ ...form, dataType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || !form.key || !form.displayName}
            >
              Save Attribute
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 font-medium">Display Name</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Namespace</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : attributes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No app attributes defined yet.
                </td>
              </tr>
            ) : (
              attributes.map((attr) => (
                <tr key={attr.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{attr.displayName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{attr.key}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                      {attr.namespace}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{attr.dataType}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Delete this attribute definition? User data associated with it may be lost.'
                          )
                        ) {
                          deleteMutation.mutate(attr.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
