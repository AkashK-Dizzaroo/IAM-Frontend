import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { abacService } from '@/features/abac/api/abacService';
import { userService } from '@/features/users/api/userService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Pencil, Users, Trash2, AlertCircle } from 'lucide-react';
import { UserForm, validateUserFormFields } from '@/features/users/components/UserForm';

// ─── table cell helpers ───────────────────────────────────────────────────────

function getHubAttr(user, key) {
  const attrs = user.hubUserAttributes || user.hubAttributes || user.hubAttributeValues || [];
  const match = attrs.find((a) => {
    const k = a.attributeKey || a.attribute_key || a.attributeDef?.key || a.key;
    return k === key;
  });
  if (!match) return null;
  const v = match.value;
  if (Array.isArray(v)) return v.join(', ');
  return v != null ? String(v) : null;
}

const USER_STATUS_STYLES = {
  active:            'bg-green-100 text-green-700 border-green-200',
  inactive:          'bg-gray-100 text-gray-500 border-gray-200',
  suspended:         'bg-red-100 text-red-700 border-red-200',
  pending_approval:  'bg-yellow-100 text-yellow-700 border-yellow-200',
};

function UserStatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  const cls = USER_STATUS_STYLES[s] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  const label = s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—';
  return <Badge className={cls}>{label}</Badge>;
}

function formatLastLogin(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function isHubOwner(user) {
  const hubRolesAttr = (user.hubUserAttributes ?? []).find((a) => {
    const k = a.attributeKey || a.attribute_key || a.attributeDef?.key || a.key;
    return k === 'hub_roles';
  });
  if (!hubRolesAttr) return false;
  const v = hubRolesAttr.value;
  const roles = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
  return roles.includes('HUB_OWNER');
}

function getAssignedApps(user, allApps) {
  if (isHubOwner(user)) return allApps;
  const reqs = user.accessRequests ?? [];
  const owned = user.applicationOwners ?? [];
  
  const reqNames = reqs.map((r) => r.application?.name || r.application?.appCode).filter(Boolean);
  const ownedNames = owned.map((o) => o.application?.name || o.application?.appCode).filter(Boolean);
  
  // Combine and deduplicate
  return Array.from(new Set([...reqNames, ...ownedNames]));
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeDataType(def) {
  return (def?.dataType ?? '').toLowerCase();
}

function emptyValueFor(def) {
  const dt = normalizeDataType(def);
  if (dt === 'list' && def?.constraints?.allowedValues?.length) return [];
  return '';
}

function isValueEmpty(def, value) {
  const dt = normalizeDataType(def);
  if (dt === 'boolean') return value !== 'true' && value !== 'false' && value !== true && value !== false;
  if (Array.isArray(value)) return value.length === 0;
  return value === '' || value === null || value === undefined;
}

function parseHubAttrValue(def, raw) {
  const dt = normalizeDataType(def);
  if (Array.isArray(raw)) return raw;
  const trimmed = typeof raw === 'string' ? raw.trim() : String(raw);
  if (dt === 'number') {
    const n = Number(trimmed);
    if (Number.isNaN(n)) throw new Error('Enter a valid number');
    return n;
  }
  if (dt === 'boolean') {
    if (raw === true || trimmed === 'true' || trimmed === '1') return true;
    if (raw === false || trimmed === 'false' || trimmed === '0') return false;
    throw new Error('Choose true or false');
  }
  if (dt === 'list') {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* use comma split */ }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (dt === 'datetime') {
    if (!trimmed || Number.isNaN(Date.parse(trimmed))) throw new Error('Enter a valid date/time (ISO format)');
    return trimmed;
  }
  return trimmed;
}

function apiErrorDescription(err) {
  const d = err?.response?.data;
  const raw = d?.message ?? d?.error ?? err?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  if (raw != null && typeof raw === 'object') return JSON.stringify(raw);
  return String(raw ?? 'Unknown error');
}

// ─── inline value input for edit mode ────────────────────────────────────────

function EditAttrValueInput({ def, value, onChange }) {
  const dt = normalizeDataType(def);
  if (dt === 'boolean') {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="flex-1"><SelectValue placeholder="Choose true or false" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (dt === 'enum' && def?.constraints?.allowedValues?.length) {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="flex-1"><SelectValue placeholder="Choose a value" /></SelectTrigger>
        <SelectContent>
          {def.constraints.allowedValues.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (dt === 'list' && def?.constraints?.allowedValues?.length) {
    return (
      <div className="flex-1 flex flex-wrap gap-1.5">
        {def.constraints.allowedValues.map((v) => {
          const selected = Array.isArray(value) && value.includes(v);
          return (
            <button key={v} type="button"
              onClick={() => onChange(selected ? (Array.isArray(value) ? value : []).filter((x) => x !== v) : [...(Array.isArray(value) ? value : []), v])}
              className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${selected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}
            >{v}</button>
          );
        })}
      </div>
    );
  }
  return (
    <Input
      type={dt === 'number' ? 'number' : dt === 'datetime' ? 'datetime-local' : 'text'}
      placeholder={dt === 'list' ? 'JSON array or comma-separated' : dt === 'datetime' ? 'Date & time' : 'Value'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1"
    />
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function AbacUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dialogMode, setDialogMode] = useState(null);
  const [submitted, setSubmitted] = useState(false);
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

  const { data: appsData } = useQuery({
    queryKey: ['abac', 'applications'],
    queryFn: abacService.getApplications,
    staleTime: 5 * 60_000,
  });
  const allAppNames = (appsData?.data?.data ?? appsData?.data ?? []).map(
    (a) => a.name || a.appCode
  ).filter(Boolean);


  // ── create form state (managed by UserForm via onChange) ──────────────────
  const createFormRef = useRef({ fields: {}, attrValues: {} });

  const handleCreateFormChange = useCallback((fields, attrValues) => {
    createFormRef.current = { fields, attrValues };
  }, []);

  // ── edit form state ───────────────────────────────────────────────────────
  const [editFormData, setEditFormData] = useState({ displayName: '', username: '', email: '' });
  const [editNewAttr, setEditNewAttr] = useState({ attributeDefId: '', value: '' });

  const resetCreate = useCallback(() => {
    createFormRef.current = { fields: {}, attrValues: {} };
    setSubmitted(false);
  }, []);

  const openCreate = () => {
    resetCreate();
    setDialogMode('create');
  };

  const openEdit = (user) => {
    setEditFormData({
      displayName: user.displayName || '',
      username: user.username || '',
      email: user.email || '',
    });
    setEditNewAttr({ attributeDefId: '', value: '' });
    setSubmitted(false);
    setDialogMode(user);
  };

  const closeDialog = useCallback(() => {
    setDialogMode(null);
    resetCreate();
  }, [resetCreate]);

  const isOpen = dialogMode !== null;
  const isEditing = isOpen && dialogMode !== 'create';
  const editUserId = isEditing ? (dialogMode.id || dialogMode._id) : null;

  // ── user attrs query (edit mode) ──────────────────────────────────────────
  const { data: userAttrsData, refetch: refetchUserAttrs } = useQuery({
    queryKey: ['abac', 'userAttrs', editUserId],
    queryFn: () => abacService.listHubUserAttrs(editUserId),
    enabled: !!editUserId,
    staleTime: 10_000,
  });
  const userAttrs = userAttrsData?.data?.data ?? userAttrsData?.data ?? [];

  // ── mutations ─────────────────────────────────────────────────────────────
  const setAttrMutation = useMutation({
    mutationFn: ({ userId, data }) => abacService.setHubUserAttr(userId, data),
    onSuccess: () => {
      refetchUserAttrs();
      refetch();
      setEditNewAttr({ attributeDefId: '', value: '' });
    },
    onError: (err) =>
      toast({ title: 'Could not save attribute', description: apiErrorDescription(err), variant: 'destructive' }),
  });

  const deleteAttrMutation = useMutation({
    mutationFn: ({ userId, attributeKey }) => abacService.deleteHubUserAttr(userId, attributeKey),
    onSuccess: () => { toast({ title: 'Attribute removed' }); refetchUserAttrs(); refetch(); },
    onError: (err) => toast({ title: 'Error', description: apiErrorDescription(err), variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: ({ payload }) => userService.createUser(payload),
    onSuccess: async (res, { attrValuesSnapshot, attrDefsSnapshot }) => {
      // userService.createUser returns response.data (axios-unwrapped body):
      // { success: true, data: { id, email, ... } }
      const newUserId = res?.data?.id ?? res?.data?.data?.id;
      const attrDef_ids = Object.keys(attrValuesSnapshot);

      if (newUserId && attrDef_ids.length > 0) {
        const assignments = attrDef_ids
          .map((id) => {
            // Use the snapshot taken at submit time so stale query data can't empty this out
            const def = attrDefsSnapshot.find((d) => String(d.id || d._id) === id);
            if (!def) return null;
            const raw = attrValuesSnapshot[id];
            if (isValueEmpty(def, raw)) return null;
            try {
              return { attribute_key: def.key, value: parseHubAttrValue(def, raw) };
            } catch { return null; }
          })
          .filter(Boolean);

        if (assignments.length > 0) {
          // allSettled so one failing attribute doesn't abandon the rest
          const results = await Promise.allSettled(
            assignments.map((a) => abacService.setHubUserAttr(newUserId, a))
          );
          const failed = results.filter((r) => r.status === 'rejected');
          if (failed.length === 0) {
            toast({ title: `User created with ${assignments.length} attribute${assignments.length > 1 ? 's' : ''}` });
          } else {
            const reasons = failed.map((r) => apiErrorDescription(r.reason)).join('; ');
            toast({
              title: `User created — ${failed.length} attribute${failed.length > 1 ? 's' : ''} failed to save`,
              description: reasons,
              variant: 'destructive',
            });
          }
        } else {
          toast({ title: 'User created' });
        }
      } else {
        toast({ title: 'User created' });
      }
      refetch();
      closeDialog();
    },
    onError: (err) =>
      toast({ title: 'Error', description: apiErrorDescription(err), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => abacService.updateUser(id, data),
    onSuccess: () => { toast({ title: 'User updated' }); refetch(); closeDialog(); },
    onError: (err) => toast({ title: 'Error', description: apiErrorDescription(err), variant: 'destructive' }),
  });

  const handleSave = () => {
    if (!isEditing) {
      setSubmitted(true);
      const { fields, attrValues } = createFormRef.current;

      // validate core fields
      const coreErrors = validateUserFormFields(fields);
      // validate attr fields
      const attrErrors = {};
      Object.keys(attrValues).forEach((id) => {
        const def = attrDefs.find((d) => String(d.id || d._id) === id);
        if (def && isValueEmpty(def, attrValues[id])) attrErrors[id] = true;
      });

      if (Object.keys(coreErrors).length > 0 || Object.keys(attrErrors).length > 0) return;

      // Find the organization value from hub attributes so the backend writes it
      // to user metadata (same as self-registration) — not just as a hub attribute.
      const orgDef = attrDefs.find((d) => d.key === 'organization');
      const orgValue = orgDef ? attrValues[String(orgDef.id || orgDef._id)] : undefined;

      const payload = {
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        address: fields.address,
        password: fields.password,
        status: 'ACTIVE',
        ...(orgValue && { organization: String(orgValue) }),
      };
      // Snapshot both attrValues and attrDefs at submit time so onSuccess always
      // has the correct data regardless of query refetches or ref resets.
      createMutation.mutate({
        payload,
        attrValuesSnapshot: { ...attrValues },
        attrDefsSnapshot: [...attrDefs],
      });
    } else {
      const editAttrDef = attrDefs.find((d) => String(d.id || d._id) === String(editNewAttr.attributeDefId));
      if (editAttrDef && !isValueEmpty(editAttrDef, editNewAttr.value)) {
        toast({ title: 'Unsaved attribute', description: 'Click Add before saving, or clear the field.', variant: 'destructive' });
        return;
      }
      updateMutation.mutate({ id: editUserId, data: editFormData });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  // ── edit-mode add attr ────────────────────────────────────────────────────
  const editSelectedDef = attrDefs.find((d) => String(d.id || d._id) === String(editNewAttr.attributeDefId));
  const editSelectedDt = normalizeDataType(editSelectedDef);
  const editAddDisabled =
    !editNewAttr.attributeDefId ||
    (editSelectedDt === 'boolean'
      ? editNewAttr.value !== 'true' && editNewAttr.value !== 'false'
      : Array.isArray(editNewAttr.value) ? editNewAttr.value.length === 0
      : String(editNewAttr.value).trim() === '');

  const handleEditAddAttr = () => {
    if (!editNewAttr.attributeDefId) return;
    const def = attrDefs.find((d) => String(d.id || d._id) === String(editNewAttr.attributeDefId));
    let value;
    try { value = parseHubAttrValue(def, editNewAttr.value); }
    catch (e) { toast({ title: 'Invalid value', description: e.message, variant: 'destructive' }); return; }
    setAttrMutation.mutate({ userId: editUserId, data: { attribute_key: def.key, value } });
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage users and their Hub attribute values</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />New User</Button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {!isLoading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4"><Users className="h-8 w-8 text-gray-400" /></div>
          <h3 className="text-base font-medium text-gray-900 mb-1">No users yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create a user to assign Hub attributes</p>
          <Button onClick={openCreate}><Plus className="h-4 w-4" />New User</Button>
        </div>
      )}

      {!isLoading && users.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">User</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Organization</th>
                <th className="px-4 py-3 font-medium text-gray-600">HUB Role</th>
                <th className="px-4 py-3 font-medium text-gray-600">Assigned Applications</th>
                <th className="px-4 py-3 font-medium text-gray-600">Last Login</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const initial = (user.displayName || user.email || '?')[0].toUpperCase();
                const userStatus = getHubAttr(user, 'user_status');
                const org = getHubAttr(user, 'organization');
                const clearance = getHubAttr(user, 'hub_roles');
                const lastLogin = user.lastLogin ?? user.last_login ?? user.metadata?.lastLoginAt ?? user.metadata?.lastLogin ?? null;
                const assignedApps = getAssignedApps(user, allAppNames);
                return (
                  <tr key={user.id || user._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">{initial}</div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{user.displayName || '—'}</div>
                          <div className="text-xs text-gray-500 truncate">{user.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <UserStatusBadge status={userStatus} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{org ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{clearance ?? '—'}</td>
                    <td className="px-4 py-3">
                      {assignedApps.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedApps.map((name) => (
                            <span key={name} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No access</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatLastLogin(lastLogin)}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(user)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Dialog ── */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-gray-100 shrink-0">
            <DialogTitle className="text-base font-semibold text-gray-900">
              {!isEditing ? 'New User' : `Edit User — ${dialogMode?.displayName || dialogMode?.email || ''}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ── CREATE: unified UserForm with isAdminMode ── */}
            {!isEditing && (
              <UserForm
                isAdminMode
                attrDefs={attrDefs}
                submitted={submitted}
                onChange={handleCreateFormChange}
              />
            )}

            {/* ── EDIT: legacy identity fields + hub attribute management ── */}
            {isEditing && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Display Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={editFormData.displayName}
                      onChange={(e) => setEditFormData((p) => ({ ...p, displayName: e.target.value }))}
                      placeholder="e.g. Jane Smith"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Username</Label>
                    <Input
                      value={editFormData.username}
                      onChange={(e) => setEditFormData((p) => ({ ...p, username: e.target.value }))}
                      className="font-mono"
                      placeholder="e.g. jsmith"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="jane@example.com"
                  />
                </div>

                {/* Hub Attributes — edit mode */}
                <div className="border-t border-gray-100 pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Hub Attributes</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Assign or remove identity attribute values for this user.</p>
                    </div>
                    <Badge variant="outline" className="text-xs text-gray-500">{userAttrs.length} assigned</Badge>
                  </div>

                  {userAttrs.length > 0 && (
                    <div className="space-y-2">
                      {userAttrs.map((attr) => {
                        const key = attr.attributeKey || attr.attribute_key || attr.attributeDef?.key || attr.key || '?';
                        return (
                          <div key={attr.id || key} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="shrink-0 font-mono text-xs">{key}</Badge>
                              <span className="text-sm font-mono text-gray-700 truncate">{String(attr.value ?? '')}</span>
                            </div>
                            <Button
                              variant="ghost" size="sm"
                              className="text-gray-400 hover:text-red-500 shrink-0 h-7 w-7 p-0"
                              onClick={() => deleteAttrMutation.mutate({ userId: editUserId, attributeKey: key })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {userAttrs.length === 0 && (
                    <p className="text-xs text-gray-400">No attributes assigned yet.</p>
                  )}

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <Label className="text-xs font-medium text-gray-700">Add Attribute</Label>
                    <Select
                      value={editNewAttr.attributeDefId}
                      onValueChange={(val) => {
                        const def = attrDefs.find((d) => String(d.id || d._id) === String(val));
                        const dt = normalizeDataType(def);
                        setEditNewAttr({ attributeDefId: val, value: dt === 'list' && def?.constraints?.allowedValues?.length ? [] : '' });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select attribute definition…" /></SelectTrigger>
                      <SelectContent>
                        {attrDefs.map((def) => (
                          <SelectItem key={def.id || def._id} value={String(def.id || def._id)}>
                            {def.displayName ? `${def.displayName} (${def.key})` : def.key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editNewAttr.attributeDefId && (
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <EditAttrValueInput
                            def={editSelectedDef}
                            value={editNewAttr.value}
                            onChange={(v) => setEditNewAttr((p) => ({ ...p, value: v }))}
                          />
                        </div>
                        <Button
                          variant="outline" size="sm"
                          onClick={handleEditAddAttr}
                          disabled={editAddDisabled || setAttrMutation.isPending}
                          className="shrink-0"
                        >
                          {setAttrMutation.isPending ? 'Adding…' : 'Add'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0">
            {submitted && !isEditing && (() => {
              const { fields, attrValues } = createFormRef.current;
              const hasFieldErrors = Object.keys(validateUserFormFields(fields)).length > 0;
              const hasAttrErrors = Object.keys(attrValues).some((id) => {
                const def = attrDefs.find((d) => String(d.id || d._id) === id);
                return def && isValueEmpty(def, attrValues[id]);
              });
              return (hasFieldErrors || hasAttrErrors) ? (
                <p className="text-xs text-red-500 flex items-center gap-1 mr-auto">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Please fill in all required fields before creating.
                </p>
              ) : null;
            })()}
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? (createMutation.isPending ? 'Creating…' : 'Saving…')
                : isEditing
                  ? 'Save Changes'
                  : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
