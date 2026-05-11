import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/apiClient';
import { abacService } from '@/features/abac/api/abacService';
import { useAuth } from '@/features/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AppWindow, Pencil, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { IconPickerField } from '@/components/ui/IconPickerField';

const STRATEGIES = [
  {
    value: 'deny_overrides',
    label: 'Deny Overrides',
    description: 'Any DENY policy wins — most restrictive',
  },
  {
    value: 'permit_overrides',
    label: 'Permit Overrides',
    description: 'Any PERMIT policy wins — most permissive',
  },
  {
    value: 'first_applicable',
    label: 'First Applicable',
    description: 'First matching policy decides the outcome',
  },
];

function normalizeList(axiosRes) {
  const body = axiosRes?.data;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

export function AbacApplicationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveRoles } = useAuth();
  const isHubOwner = effectiveRoles.isHubOwner;

  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState({
    name: '',
    key: '',
    description: '',
    baseUrl: '',
    isVisibleInHub: true,
    isActive: true,
    iconKey: 'shield',
    features: '',
    combiningStrategy: 'deny_overrides',
  });

  // Owner selection state
  const [selectedOwners, setSelectedOwners] = useState([]);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerResults, setOwnerResults] = useState([]);
  const [ownerSearchLoading, setOwnerSearchLoading] = useState(false);
  const ownerDebounceRef = useRef(null);

  const searchOwners = useCallback(async (q) => {
    setOwnerSearchLoading(true);
    try {
      const res = await apiClient.get(`/users?search=${encodeURIComponent(q || '')}&limit=20`);
      const users = res?.data?.data ?? [];
      setOwnerResults(
        users
          .map((u) => ({ _id: u._id || u.id, email: u.email, firstName: u.firstName ?? '', lastName: u.lastName ?? '' }))
          .filter((u) => !selectedOwners.some((o) => o._id === u._id))
      );
    } catch {
      setOwnerResults([]);
    } finally {
      setOwnerSearchLoading(false);
    }
  }, [selectedOwners]);

  useEffect(() => {
    if (ownerDebounceRef.current) clearTimeout(ownerDebounceRef.current);
    ownerDebounceRef.current = setTimeout(() => searchOwners(ownerSearch), 300);
    return () => clearTimeout(ownerDebounceRef.current);
  }, [ownerSearch, searchOwners]);

  const addOwner = (user) => {
    if (selectedOwners.some((o) => o._id === user._id)) return;
    setSelectedOwners((prev) => [...prev, user]);
    setOwnerSearch('');
    setOwnerResults([]);
  };

  const removeOwner = (id) => setSelectedOwners((prev) => prev.filter((o) => o._id !== id));

  const { data: mongoRes, isLoading, refetch } = useQuery({
    queryKey: ['applications'],
    queryFn: () => apiClient.get('/applications'),
    staleTime: 30_000,
  });

  const { data: abacRes } = useQuery({
    queryKey: ['abac', 'applications'],
    queryFn: abacService.getApplications,
    staleTime: 30_000,
  });

  const apps = useMemo(() => normalizeList(mongoRes), [mongoRes]);
  const abacApps = useMemo(() => normalizeList(abacRes), [abacRes]);

  const mergedApps = useMemo(() => {
    return apps.map((app) => {
      const abacApp = abacApps.find(
        (a) => a.key === app.key
      );
      return {
        ...app,
        combiningStrategy:
          app.combiningStrategy ??
          abacApp?.combiningStrategy ??
          'deny_overrides',
      };
    });
  }, [apps, abacApps]);

  const closePanel = () => setPanel(null);

  const openCreate = () => {
    setForm({
      name: '',
      key: '',
      description: '',
      baseUrl: '',
      isVisibleInHub: true,
      isActive: true,
      iconKey: 'shield',
      features: '',
      combiningStrategy: 'deny_overrides',
    });
    setSelectedOwners([]);
    setOwnerSearch('');
    setOwnerResults([]);
    setPanel('create');
  };

  const openEdit = (app) => {
    setForm({
      name: app.name ?? '',
      key: app.key ?? '',
      description: app.description ?? '',
      baseUrl: app.baseUrl ?? '',
      isVisibleInHub: app.isVisibleInHub !== false,
      isActive: app.isActive !== false,
      iconKey: app.iconKey ?? 'shield',
      features: Array.isArray(app.features)
        ? app.features.join(', ')
        : '',
      combiningStrategy: app.combiningStrategy ?? 'deny_overrides',
    });
    setSelectedOwners(
      Array.isArray(app.owners)
        ? app.owners.map((o) => ({
            _id: o._id || o.id,
            email: o.email,
            firstName: o.firstName || o.displayName?.split(' ')[0] || '',
            lastName: o.lastName || o.displayName?.split(' ').slice(1).join(' ') || '',
          }))
        : []
    );
    setOwnerSearch('');
    setOwnerResults([]);
    setPanel(app);
  };

  const createMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/applications', payload),
    onSuccess: () => {
      toast({ title: 'Application registered' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['abac', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['abac', 'users'] });
      refetch();
      closePanel();
    },
    onError: (err) =>
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        variant: 'destructive',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      apiClient.patch(`/applications/${id}`, payload),
    onSuccess: () => {
      toast({ title: 'Application updated' });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['abac', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['abac', 'users'] });
      refetch();
      closePanel();
    },
    onError: (err) =>
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        variant: 'destructive',
      }),
  });

  const handleSubmit = () => {
    if (!form.name?.trim()) {
      toast({
        title: 'Validation',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }
    if (form.name.trim().length > 255) {
      toast({
        title: 'Validation',
        description: 'Name must be 255 characters or fewer',
        variant: 'destructive',
      });
      return;
    }
    if (form.baseUrl?.trim() && !/^https?:\/\/.+/.test(form.baseUrl.trim())) {
      toast({
        title: 'Validation',
        description: 'Base URL must start with http:// or https://',
        variant: 'destructive',
      });
      return;
    }
    if (panel === 'create') {
      const code = form.key.trim();
      if (!code) {
        toast({
          title: 'Validation',
          description: 'App key is required',
          variant: 'destructive',
        });
        return;
      }
      if (!/^[a-z0-9_]+$/.test(code)) {
        toast({
          title: 'Validation',
          description: 'App key may only contain lowercase letters, numbers, and underscores',
          variant: 'destructive',
        });
        return;
      }
      createMutation.mutate({
        name: form.name.trim(),
        key: code.toLowerCase(),
        description: form.description?.trim() || undefined,
        baseUrl: form.baseUrl?.trim() || '',
        isVisibleInHub: form.isVisibleInHub,
        isActive: form.isActive,
        iconKey: form.iconKey || null,
        features: form.features
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
        combiningStrategy: form.combiningStrategy,
        ownerIds: selectedOwners.map((o) => o._id),
      });
    } else if (panel && panel !== 'create') {
      const id = panel._id || panel.id;
      updateMutation.mutate({
        id,
        payload: {
          name: form.name.trim(),
          description: form.description?.trim() || undefined,
          baseUrl: form.baseUrl?.trim() || '',
          isVisibleInHub: form.isVisibleInHub,
          isActive: form.isActive,
          iconKey: form.iconKey || null,
          features: form.features
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean),
          combiningStrategy: form.combiningStrategy,
          ownerIds: selectedOwners.map((o) => o._id),
        },
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  const renderStatusBadge = (isActive) => {
    if (isActive) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          active
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200">
        inactive
      </Badge>
    );
  };

  const strategyBadge = (strategy) => {
    const s = strategy || 'deny_overrides';
    if (s === 'deny_overrides') {
      return (
        <Badge variant="destructive" className="font-normal">
          deny_overrides
        </Badge>
      );
    }
    if (s === 'permit_overrides') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 font-normal">
          permit_overrides
        </Badge>
      );
    }
    return (
      <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 font-normal">
        first_applicable
      </Badge>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage registered applications and their ABAC configuration
          </p>
        </div>
        {isHubOwner && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Register Application
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {!isLoading && mergedApps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <AppWindow className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">
            No applications registered
          </h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm">
            Register your first application to start defining ABAC policies
          </p>
          {isHubOwner && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Register Application
            </Button>
          )}
        </div>
      )}

      {!isLoading && mergedApps.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Application</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Visible in Hub
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Combining strategy
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">Owners</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mergedApps.map((app) => (
                <tr key={app._id || app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{app.name}</div>
                    <div className="font-mono text-xs text-gray-500">
                      {app.key}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {renderStatusBadge(app.isActive !== false)}
                  </td>
                  <td className="px-4 py-3">
                    {app.isVisibleInHub !== false ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-800 border-emerald-200"
                      >
                        yes
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-600">
                        no
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {strategyBadge(app.combiningStrategy)}
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    {Array.isArray(app.owners) && app.owners.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {app.owners.map((o) => {
                          const name = (o.displayName || `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim()) || o.email;
                          return (
                            <span
                              key={o._id || o.id}
                              title={o.email}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-100"
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isHubOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(app)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={panel !== null} onOpenChange={(o) => { if (!o) closePanel(); }}>
        <DialogContent className="max-w-xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {panel === 'create' ? 'Register Application' : 'Edit Application'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Basic info
                </h3>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>App key</Label>
                    <Input
                      value={form.key}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                        }))
                      }
                      className="font-mono"
                      disabled={panel !== 'create'}
                      placeholder="my_app"
                    />
                    {panel === 'create' ? (
                      <p className="text-xs text-gray-500">
                        Lowercase letters, numbers, and underscores only — cannot be changed after creation
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Cannot be changed after creation
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, description: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Base URL</Label>
                    <Input
                      type="url"
                      value={form.baseUrl}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, baseUrl: e.target.value }))
                      }
                      placeholder="https://"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-900">
                  Hub display settings
                </h3>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Visible in Hub</Label>
                    <Switch
                      checked={form.isVisibleInHub}
                      onCheckedChange={(v) =>
                        setForm((p) => ({ ...p, isVisibleInHub: v }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Active</Label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Inactive applications are hidden from normal use
                      </p>
                    </div>
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(v) =>
                        setForm((p) => ({ ...p, isActive: v }))
                      }
                    />
                  </div>
                  <IconPickerField
                    label="Icon"
                    value={form.iconKey}
                    onChange={(key) => setForm((p) => ({ ...p, iconKey: key }))}
                  />
                  <div className="space-y-1.5">
                    <Label>Features</Label>
                    <Input
                      value={form.features}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, features: e.target.value }))
                      }
                      placeholder="Data Collection, CRF Design"
                    />
                    <p className="text-xs text-gray-500">
                      Comma-separated, e.g. Data Collection, CRF Design
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-900">App Owners</h3>
                <p className="text-xs text-gray-500 mt-0.5 mb-3">
                  Owners receive access request approval emails for this application.
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Search by email or name..."
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    onFocus={() => { if (!ownerSearch.trim()) searchOwners(''); }}
                  />
                  {ownerSearchLoading && (
                    <p className="text-xs text-gray-500">Searching...</p>
                  )}
                  {ownerResults.length > 0 && (
                    <ul className="border border-gray-200 rounded-md divide-y max-h-36 overflow-y-auto">
                      {ownerResults.map((u) => (
                        <li
                          key={u._id}
                          className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                          onClick={() => addOwner(u)}
                          onKeyDown={(e) => e.key === 'Enter' && addOwner(u)}
                          role="button"
                          tabIndex={0}
                        >
                          {u.email}{u.firstName || u.lastName ? ` – ${u.firstName} ${u.lastName}`.trimEnd() : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedOwners.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedOwners.map((o) => (
                        <span
                          key={o._id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-800 text-xs border border-blue-100"
                        >
                          {`${o.firstName} ${o.lastName}`.trim() || o.email}
                          <button
                            type="button"
                            onClick={() => removeOwner(o._id)}
                            className="ml-1 text-blue-400 hover:text-red-500"
                            aria-label="Remove owner"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-900">
                  ABAC policy configuration
                </h3>
                <div className="mt-3 space-y-2">
                  {STRATEGIES.map((opt) => {
                    const selected = form.combiningStrategy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            combiningStrategy: opt.value,
                          }))
                        }
                        className={`
                          w-full text-left border rounded-lg p-3 cursor-pointer transition-colors
                          ${selected
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        <div className="font-medium text-gray-900 text-sm">
                          {opt.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {opt.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                  This setting controls how multiple app policies are combined
                  during ABAC evaluation. Global policies always use
                  deny_overrides regardless of this setting.
                </div>
              </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={closePanel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {panel === 'create' ? 'Register' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
