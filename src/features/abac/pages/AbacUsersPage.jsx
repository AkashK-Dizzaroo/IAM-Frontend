import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { abacService } from '@/features/abac/api/abacService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Search, Plus, Pencil, X, Users, Trash2 } from 'lucide-react';

function normalizeDataType(def) {
  return (def?.dataType ?? '').toLowerCase();
}

/** Backend may return dataType in mixed case; normalize before branching. */
function parseHubAttrValue(def, raw) {
  const dt = normalizeDataType(def);
  if (Array.isArray(raw)) return raw;
  const trimmed = typeof raw === 'string' ? raw.trim() : String(raw);

  if (dt === 'number') {
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      throw new Error('Enter a valid number');
    }
    return n;
  }
  if (dt === 'boolean') {
    const lower = trimmed.toLowerCase();
    if (lower === 'true' || trimmed === '1') return true;
    if (lower === 'false' || trimmed === '0') return false;
    throw new Error('Choose true or false');
  }
  if (dt === 'list') {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* use comma split */
    }
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (dt === 'datetime') {
    if (!trimmed || Number.isNaN(Date.parse(trimmed))) {
      throw new Error('Enter a valid date/time (ISO format)');
    }
    return trimmed;
  }
  // string, enum
  return trimmed;
}

/** Radix Select stringifies values; coerce numeric string IDs for APIs that expect numbers. UUIDs stay strings (Number(uuid) is NaN). */
function coerceAttributeDefId(raw) {
  if (raw === '' || raw == null) return raw;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

function apiErrorDescription(err) {
  const d = err?.response?.data;
  const raw = d?.message ?? d?.error ?? err?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  if (raw != null && typeof raw === 'object') return JSON.stringify(raw);
  return String(raw ?? 'Unknown error');
}

/** True when the user has selected an attribute and entered a value that would enable "Add" but not submitted it yet. */
function hubAttrRowReadyToAdd(state, def) {
  if (!state.attributeDefId) return false;
  const dt = normalizeDataType(def);
  if (dt === 'boolean') {
    return state.value === 'true' || state.value === 'false';
  }
  if (Array.isArray(state.value)) return state.value.length > 0;
  return String(state.value).trim() !== '';
}

export function AbacUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [slideOver, setSlideOver] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['abac', 'users', debouncedSearch],
    queryFn: () => abacService.listUsers({ search: debouncedSearch, limit: 50 }),
    staleTime: 30_000,
  });
  const users = data?.data?.data ?? data?.data ?? [];

  const { data: attrDefsData } = useQuery({
    queryKey: ['abac', 'hubAttrDefs'],
    queryFn: abacService.listHubAttrDefs,
    staleTime: 5 * 60_000,
  });
  const attrDefs = attrDefsData?.data?.data ?? attrDefsData?.data ?? [];

  // --- Form state ---
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    email: '',
    isActive: true,
  });
  const [newAttr, setNewAttr] = useState({ attributeDefId: '', value: '' });

  const resetForm = useCallback(() => {
    setFormData({ displayName: '', username: '', email: '', isActive: true });
    setNewAttr({ attributeDefId: '', value: '' });
  }, []);

  const openCreate = () => {
    resetForm();
    setSlideOver('create');
  };

  const openEdit = (user) => {
    setFormData({
      displayName: user.displayName || '',
      username: user.username || '',
      email: user.email || '',
      isActive: user.isActive !== false,
    });
    setNewAttr({ attributeDefId: '', value: '' });
    setSlideOver(user);
  };

  const closePanel = () => setSlideOver(null);

  // --- User attributes for editing ---
  const editUserId = slideOver && slideOver !== 'create' ? (slideOver.id || slideOver._id) : null;

  const { data: userAttrsData, refetch: refetchUserAttrs } = useQuery({
    queryKey: ['abac', 'userAttrs', editUserId],
    queryFn: () => abacService.listHubUserAttrs(editUserId),
    enabled: !!editUserId,
    staleTime: 10_000,
  });
  const userAttrs = userAttrsData?.data?.data ?? userAttrsData?.data ?? [];

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (data) => abacService.createUser(data),
    onSuccess: () => {
      toast({ title: 'User created' });
      refetch();
      closePanel();
    },
    onError: (err) =>
      toast({
        title: 'Error',
        description: apiErrorDescription(err),
        variant: 'destructive',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => abacService.updateUser(id, data),
    onSuccess: () => {
      toast({ title: 'User updated' });
      refetch();
      closePanel();
    },
    onError: (err) =>
      toast({
        title: 'Error',
        description: apiErrorDescription(err),
        variant: 'destructive',
      }),
  });

  const setAttrMutation = useMutation({
    mutationFn: ({ userId, data }) => abacService.setHubUserAttr(userId, data),
    onSuccess: () => {
      toast({
        title: 'Hub attribute saved',
        duration: 5000,
      });
      refetchUserAttrs();
      refetch();
      setNewAttr({ attributeDefId: '', value: '' });
    },
    onError: (err) =>
      toast({
        title: 'Could not save attribute',
        description: apiErrorDescription(err),
        variant: 'destructive',
      }),
  });

  const deleteAttrMutation = useMutation({
    mutationFn: ({ userId, attrDefId }) => abacService.deleteHubUserAttr(userId, attrDefId),
    onSuccess: () => {
      toast({ title: 'Attribute removed' });
      refetchUserAttrs();
      refetch();
    },
    onError: (err) =>
      toast({
        title: 'Error',
        description: apiErrorDescription(err),
        variant: 'destructive',
      }),
  });

  const handleSave = () => {
    if (slideOver !== 'create') {
      const defForPending = attrDefs.find(
        (d) => String(d.id || d._id) === String(newAttr.attributeDefId)
      );
      if (hubAttrRowReadyToAdd(newAttr, defForPending)) {
        toast({
          title: 'Unsaved attribute',
          description:
            'Click Add next to the attribute value before saving the user, or clear the fields.',
          variant: 'destructive',
        });
        return;
      }
    }
    if (slideOver === 'create') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: editUserId, data: formData });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  const handleAddAttr = () => {
    if (!newAttr.attributeDefId || newAttr.value === '') return;
    const def = attrDefs.find(
      (d) => String(d.id || d._id) === String(newAttr.attributeDefId)
    );
    let value;
    try {
      value = parseHubAttrValue(def, newAttr.value);
    } catch (e) {
      toast({
        title: 'Invalid value',
        description: e.message,
        variant: 'destructive',
      });
      return;
    }
    setAttrMutation.mutate({
      userId: editUserId,
      data: {
        attributeDefId: coerceAttributeDefId(newAttr.attributeDefId),
        value,
      },
    });
  };

  const getAttrInputType = () => {
    const def = attrDefs.find(
      (d) => String(d.id || d._id) === String(newAttr.attributeDefId)
    );
    const dt = normalizeDataType(def);
    if (dt === 'number') return 'number';
    if (dt === 'datetime') return 'datetime-local';
    return 'text';
  };

  const selectedAttrDef = attrDefs.find(
    (d) => String(d.id || d._id) === String(newAttr.attributeDefId)
  );
  const selectedAttrDataType = normalizeDataType(selectedAttrDef);

  // Build a flat list of hub attributes for display in the table.
  // API (Prisma) returns `hubUserAttributes` with nested `attributeDef`; legacy keys kept as fallbacks.
  const formatHubAttrValue = (raw) => {
    if (raw === null || raw === undefined) return '';
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'object') return JSON.stringify(raw);
    return String(raw);
  };

  const getUserHubAttrs = (user) => {
    const attrs =
      user.hubUserAttributes ||
      user.hubAttributes ||
      user.hubAttributeValues ||
      [];
    return attrs.map((a) => {
      const key =
        a.attributeDef?.key || a.key || a.attributeDefId || '?';
      return { key, value: formatHubAttrValue(a.value) };
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage users and their Hub attribute values
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New User
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">
            No users yet
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Create a user to assign Hub attributes
          </p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New User
          </Button>
        </div>
      )}

      {/* Table */}
      {!isLoading && users.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">User</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Hub Attributes
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const hubAttrs = getUserHubAttrs(user);
                const initial = (user.displayName || user.email || '?')[0].toUpperCase();
                return (
                  <tr key={user.id || user._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {user.displayName || '—'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {user.email || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          user.isActive !== false
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }
                      >
                        {user.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {hubAttrs.slice(0, 3).map((attr, idx) => (
                          <span
                            key={idx}
                            className="bg-gray-100 text-gray-700 text-xs font-mono px-2 py-0.5 rounded"
                          >
                            {attr.key}: {attr.value}
                          </span>
                        ))}
                        {hubAttrs.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{hubAttrs.length - 3} more
                          </span>
                        )}
                        {hubAttrs.length === 0 && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {user.createdAt
                        ? formatDistanceToNow(new Date(user.createdAt), {
                            addSuffix: true,
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over panel */}
      {slideOver !== null && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={closePanel}
          />
          <div className="fixed right-0 top-0 h-full w-[440px] z-50 bg-white border-l border-gray-200 shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-base">
                {slideOver === 'create' ? 'New User' : 'Edit User'}
              </h2>
              <Button variant="ghost" size="sm" onClick={closePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, displayName: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, username: e.target.value }))
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(val) =>
                      setFormData((p) => ({ ...p, isActive: val }))
                    }
                  />
                </div>
              </div>

              {/* Hub Attributes section — only when editing */}
              {slideOver !== 'create' && editUserId && (
                <>
                  <div className="border-t border-gray-100 pt-4 mt-4">
                    <h3 className="text-sm font-medium text-gray-900">
                      Hub Attributes
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 mb-3">
                      Assign identity attribute values to this user
                    </p>

                    {userAttrs.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {userAttrs.map((attr) => {
                          const key =
                            attr.attributeDef?.key ||
                            attr.key ||
                            attr.attributeDefId ||
                            '?';
                          const attrDefId =
                            attr.attributeDefId ||
                            attr.attributeDef?.id ||
                            attr.attributeDef?._id;
                          return (
                            <div
                              key={attrDefId}
                              className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge
                                  variant="outline"
                                  className="shrink-0 font-mono text-xs"
                                >
                                  {key}
                                </Badge>
                                <span className="text-sm font-mono text-gray-700 truncate">
                                  {String(attr.value ?? '')}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-red-500 shrink-0"
                                onClick={() =>
                                  deleteAttrMutation.mutate({
                                    userId: editUserId,
                                    attrDefId,
                                  })
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add attribute */}
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">
                        Add Attribute
                      </Label>
                      <Select
                        value={newAttr.attributeDefId}
                        onValueChange={(val) => {
                          const def = attrDefs.find(
                            (d) => String(d.id || d._id) === String(val)
                          );
                          const dt = normalizeDataType(def);
                          const emptyValue =
                            dt === 'list' && def?.constraints?.allowedValues?.length
                              ? []
                              : '';
                          setNewAttr({ attributeDefId: val, value: emptyValue });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select attribute..." />
                        </SelectTrigger>
                        <SelectContent>
                          {attrDefs.map((def) => (
                            <SelectItem
                              key={def.id || def._id}
                              value={def.id || def._id}
                            >
                              {def.key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        {selectedAttrDataType === 'boolean' ? (
                          <Select
                            value={newAttr.value || undefined}
                            onValueChange={(val) =>
                              setNewAttr((p) => ({ ...p, value: val }))
                            }
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Choose true or false" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">true</SelectItem>
                              <SelectItem value="false">false</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : selectedAttrDataType === 'enum' &&
                          selectedAttrDef?.constraints?.allowedValues?.length ? (
                          <Select
                            value={newAttr.value || undefined}
                            onValueChange={(val) =>
                              setNewAttr((p) => ({ ...p, value: val }))
                            }
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Choose a value" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedAttrDef.constraints.allowedValues.map((v) => (
                                <SelectItem key={v} value={v}>
                                  {v}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : selectedAttrDataType === 'list' &&
                          selectedAttrDef?.constraints?.allowedValues?.length ? (
                          <div className="flex-1 flex flex-wrap gap-1.5">
                            {selectedAttrDef.constraints.allowedValues.map((v) => {
                              const selected = Array.isArray(newAttr.value) && newAttr.value.includes(v);
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() =>
                                    setNewAttr((p) => {
                                      const cur = Array.isArray(p.value) ? p.value : [];
                                      return {
                                        ...p,
                                        value: selected
                                          ? cur.filter((x) => x !== v)
                                          : [...cur, v],
                                      };
                                    })
                                  }
                                  className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${
                                    selected
                                      ? 'bg-gray-900 text-white border-gray-900'
                                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                                  }`}
                                >
                                  {v}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <Input
                            type={getAttrInputType()}
                            placeholder={
                              selectedAttrDataType === 'list'
                                ? 'JSON array or comma-separated values'
                                : selectedAttrDataType === 'datetime'
                                  ? 'Date & time'
                                  : 'Value'
                            }
                            value={newAttr.value}
                            onChange={(e) =>
                              setNewAttr((p) => ({
                                ...p,
                                value: e.target.value,
                              }))
                            }
                            className="flex-1"
                          />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddAttr}
                          disabled={
                            !newAttr.attributeDefId ||
                            (selectedAttrDataType === 'boolean'
                              ? newAttr.value !== 'true' &&
                                newAttr.value !== 'false'
                              : Array.isArray(newAttr.value)
                                ? newAttr.value.length === 0
                                : String(newAttr.value).trim() === '') ||
                            setAttrMutation.isPending
                          }
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={closePanel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
