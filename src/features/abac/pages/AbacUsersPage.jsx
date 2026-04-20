import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Pencil, Users, Trash2, X, AlertCircle } from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

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

function formatDisplayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

// ─── single attribute field (used in create form) ────────────────────────────

function AttrField({ def, value, onChange, error, onRemove, isOptional }) {
  const dt = normalizeDataType(def);
  const label = def.displayName || def.key;

  const inputEl = (() => {
    if (dt === 'boolean') {
      return (
        <Select value={value !== '' ? String(value) : undefined} onValueChange={onChange}>
          <SelectTrigger className={error ? 'border-red-400 focus:ring-red-300' : ''}>
            <SelectValue placeholder="Select true or false…" />
          </SelectTrigger>
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
          <SelectTrigger className={error ? 'border-red-400 focus:ring-red-300' : ''}>
            <SelectValue placeholder="Select a value…" />
          </SelectTrigger>
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
        <div className={`flex flex-wrap gap-1.5 p-2 rounded-md border ${error ? 'border-red-400' : 'border-gray-200'} bg-white min-h-[38px]`}>
          {def.constraints.allowedValues.map((v) => {
            const selected = Array.isArray(value) && value.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  onChange(
                    selected
                      ? (Array.isArray(value) ? value : []).filter((x) => x !== v)
                      : [...(Array.isArray(value) ? value : []), v]
                  )
                }
                className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                  selected
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-50 text-gray-600 border-gray-300 hover:border-gray-500'
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <Input
        type={dt === 'number' ? 'number' : dt === 'datetime' ? 'datetime-local' : 'text'}
        placeholder={
          dt === 'list' ? 'Comma-separated values' :
          dt === 'datetime' ? 'Date & time' :
          dt === 'number' ? (def.constraints?.min != null && def.constraints?.max != null
            ? `${def.constraints.min} – ${def.constraints.max}`
            : 'Enter number…')
          : `Enter ${label}…`
        }
        value={value}
        min={dt === 'number' ? def.constraints?.min : undefined}
        max={dt === 'number' ? def.constraints?.max : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={error ? 'border-red-400 focus-visible:ring-red-300' : ''}
      />
    );
  })();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">
          {label}
          {!isOptional && <span className="text-red-500 ml-0.5">*</span>}
          <span className="ml-1.5 font-normal font-mono text-[10px] text-gray-400">{def.key}</span>
        </Label>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{def.dataType}</Badge>
          {isOptional && (
            <button
              type="button"
              onClick={onRemove}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Remove this attribute"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {inputEl}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
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

// ─── page ────────────────────────────────────────────────────────────────────

export function AbacUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dialogMode, setDialogMode] = useState(null);
  const [submitted, setSubmitted] = useState(false); // track if form was attempted
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

  const requiredDefs = useMemo(() => attrDefs.filter((d) => d.isRequired && d.namespace === 'subject'), [attrDefs]);
  const optionalDefs = useMemo(() => attrDefs.filter((d) => !(d.isRequired && d.namespace === 'subject')), [attrDefs]);

  // ── form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({ displayName: '', username: '', email: '', isActive: true });

  // attrValues: { [defId]: value } — for both required (always shown) and added optional fields
  const [attrValues, setAttrValues] = useState({});
  // which optional def IDs the user has chosen to add
  const [addedOptionalIds, setAddedOptionalIds] = useState([]);
  // the "add another attribute" dropdown state
  const [addAttrPickerId, setAddAttrPickerId] = useState('');

  // edit-mode add-attr state
  const [editNewAttr, setEditNewAttr] = useState({ attributeDefId: '', value: '' });

  const resetForm = useCallback(() => {
    setFormData({ displayName: '', username: '', email: '', isActive: true });
    setAttrValues({});
    setAddedOptionalIds([]);
    setAddAttrPickerId('');
    setEditNewAttr({ attributeDefId: '', value: '' });
    setSubmitted(false);
  }, []);

  // When required defs load, seed attrValues with empty slots for required fields
  useEffect(() => {
    if (dialogMode === 'create') {
      setAttrValues((prev) => {
        const next = { ...prev };
        requiredDefs.forEach((d) => {
          const id = String(d.id || d._id);
          if (!(id in next)) next[id] = emptyValueFor(d);
        });
        return next;
      });
    }
  }, [requiredDefs, dialogMode]);

  const openCreate = () => {
    resetForm();
    setDialogMode('create');
  };

  const openEdit = (user) => {
    setFormData({ displayName: user.displayName || '', username: user.username || '', email: user.email || '', isActive: user.isActive !== false });
    setAttrValues({});
    setAddedOptionalIds([]);
    setAddAttrPickerId('');
    setEditNewAttr({ attributeDefId: '', value: '' });
    setSubmitted(false);
    setDialogMode(user);
  };

  const closeDialog = () => setDialogMode(null);

  const isOpen = dialogMode !== null;
  const isEditing = isOpen && dialogMode !== 'create';
  const editUserId = isEditing ? (dialogMode.id || dialogMode._id) : null;

  // ── user attrs query (edit mode) ─────────────────────────────────────────
  const { data: userAttrsData, refetch: refetchUserAttrs } = useQuery({
    queryKey: ['abac', 'userAttrs', editUserId],
    queryFn: () => abacService.listHubUserAttrs(editUserId),
    enabled: !!editUserId,
    staleTime: 10_000,
  });
  const userAttrs = userAttrsData?.data?.data ?? userAttrsData?.data ?? [];

  // ── validation (create mode only) ───────────────────────────────────────
  const allShownDefIds = useMemo(
    () => [...requiredDefs.map((d) => String(d.id || d._id)), ...addedOptionalIds],
    [requiredDefs, addedOptionalIds]
  );

  const fieldErrors = useMemo(() => {
    if (!submitted) return {};
    const errors = {};
    // user fields
    if (!formData.displayName.trim()) errors._displayName = 'Display name is required';
    if (!formData.email.trim()) errors._email = 'Email is required';
    // attribute fields
    allShownDefIds.forEach((id) => {
      const def = attrDefs.find((d) => String(d.id || d._id) === id);
      if (!def) return;
      const val = attrValues[id];
      if (isValueEmpty(def, val)) {
        errors[id] = `${def.displayName || def.key} is required`;
      }
    });
    return errors;
  }, [submitted, formData, attrValues, allShownDefIds, attrDefs]);

  const hasErrors = Object.keys(fieldErrors).length > 0;

  // ── mutations ────────────────────────────────────────────────────────────
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
    mutationFn: (data) => abacService.createUser(data),
    onSuccess: async (res) => {
      const newUserId = res?.data?.data?.id ?? res?.data?.id;
      if (newUserId && allShownDefIds.length > 0) {
        const assignments = allShownDefIds
          .map((id) => {
            const def = attrDefs.find((d) => String(d.id || d._id) === id);
            if (!def) return null;
            const raw = attrValues[id];
            if (isValueEmpty(def, raw)) return null;
            try {
              return { attribute_key: def.key, value: parseHubAttrValue(def, raw) };
            } catch { return null; }
          })
          .filter(Boolean);

        if (assignments.length > 0) {
          try {
            await Promise.all(
              assignments.map((a) => abacService.setHubUserAttr(newUserId, a))
            );
            toast({ title: `User created with ${assignments.length} attribute${assignments.length > 1 ? 's' : ''}` });
          } catch {
            toast({ title: 'User created, but some attributes failed to save', variant: 'destructive' });
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
      // compute errors inline (state update is async)
      const errors = {};
      if (!formData.displayName.trim()) errors._displayName = true;
      if (!formData.email.trim()) errors._email = true;
      allShownDefIds.forEach((id) => {
        const def = attrDefs.find((d) => String(d.id || d._id) === id);
        if (def && isValueEmpty(def, attrValues[id])) errors[id] = true;
      });
      if (Object.keys(errors).length > 0) return;
      createMutation.mutate(formData);
    } else {
      const editAttrDef = attrDefs.find((d) => String(d.id || d._id) === String(editNewAttr.attributeDefId));
      if (editAttrDef && !isValueEmpty(editAttrDef, editNewAttr.value)) {
        toast({ title: 'Unsaved attribute', description: 'Click Add before saving, or clear the field.', variant: 'destructive' });
        return;
      }
      updateMutation.mutate({ id: editUserId, data: formData });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  // ── optional attr picker ─────────────────────────────────────────────────
  const availableOptionalDefs = optionalDefs.filter(
    (d) => !addedOptionalIds.includes(String(d.id || d._id))
  );

  const handleAddOptional = (defId) => {
    if (!defId) return;
    const def = attrDefs.find((d) => String(d.id || d._id) === defId);
    if (!def) return;
    setAddedOptionalIds((prev) => [...prev, defId]);
    setAttrValues((prev) => ({ ...prev, [defId]: emptyValueFor(def) }));
    setAddAttrPickerId('');
  };

  const handleRemoveOptional = (defId) => {
    setAddedOptionalIds((prev) => prev.filter((id) => id !== defId));
    setAttrValues((prev) => { const n = { ...prev }; delete n[defId]; return n; });
  };

  // ── edit-mode add attr ───────────────────────────────────────────────────
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

  // ── table helpers ────────────────────────────────────────────────────────
  const formatHubAttrValue = (raw) => {
    if (raw == null) return '';
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'object') return JSON.stringify(raw);
    return String(raw);
  };

  const getUserHubAttrs = (user) => {
    const attrs = user.hubUserAttributes || user.hubAttributes || user.hubAttributeValues || [];
    return attrs.map((a) => {
      const key = a.attributeKey || a.attribute_key || a.attributeDef?.key || a.key || '?';
      return { key, value: formatHubAttrValue(a.value) };
    });
  };

  // ── assigned count for create button label ───────────────────────────────
  const filledAttrCount = allShownDefIds.filter((id) => {
    const def = attrDefs.find((d) => String(d.id || d._id) === id);
    return def && !isValueEmpty(def, attrValues[id]);
  }).length;

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
                <th className="px-4 py-3 font-medium text-gray-600">Hub Attributes</th>
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
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">{initial}</div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{user.displayName || '—'}</div>
                          <div className="text-xs text-gray-500 truncate">{user.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={user.isActive !== false ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}>
                        {user.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {hubAttrs.slice(0, 3).map((attr, idx) => (
                          <span key={idx} className="bg-gray-100 text-gray-700 text-xs font-mono px-2 py-0.5 rounded">{attr.key}: {attr.value}</span>
                        ))}
                        {hubAttrs.length > 3 && <span className="text-xs text-gray-400">+{hubAttrs.length - 3} more</span>}
                        {hubAttrs.length === 0 && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : '—'}
                    </td>
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

            {/* ── user identity fields ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Display Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) => setFormData((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  className={fieldErrors._displayName ? 'border-red-400 focus-visible:ring-red-300' : ''}
                />
                {fieldErrors._displayName && (
                  <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{fieldErrors._displayName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                  className="font-mono"
                  placeholder="e.g. jsmith"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className={fieldErrors._email ? 'border-red-400 focus-visible:ring-red-300' : ''}
                />
                {fieldErrors._email && (
                  <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{fieldErrors._email}</p>
                )}
              </div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center justify-between w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
                  <div>
                    <Label className="text-sm">Status</Label>
                    <p className="text-xs text-gray-500">{formData.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <Switch checked={formData.isActive} onCheckedChange={(val) => setFormData((p) => ({ ...p, isActive: val }))} />
                </div>
              </div>
            </div>

            {/* ── Hub Attributes ── */}
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Hub Attributes</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {!isEditing
                      ? 'Required attributes must be filled. Optionally add more.'
                      : 'Assign or remove identity attribute values for this user.'}
                  </p>
                </div>
                {isEditing && (
                  <Badge variant="outline" className="text-xs text-gray-500">{userAttrs.length} assigned</Badge>
                )}
              </div>

              {/* ── CREATE MODE: structured fields ── */}
              {!isEditing && (
                <>
                  {/* Required attribute fields */}
                  {requiredDefs.length > 0 && (
                    <div className="space-y-4">
                      {requiredDefs.map((def) => {
                        const id = String(def.id || def._id);
                        return (
                          <AttrField
                            key={id}
                            def={def}
                            value={attrValues[id] ?? emptyValueFor(def)}
                            onChange={(v) => setAttrValues((p) => ({ ...p, [id]: v }))}
                            error={fieldErrors[id]}
                            isOptional={false}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Added optional attribute fields */}
                  {addedOptionalIds.length > 0 && (
                    <div className="space-y-4 pt-1">
                      {addedOptionalIds.map((id) => {
                        const def = attrDefs.find((d) => String(d.id || d._id) === id);
                        if (!def) return null;
                        return (
                          <AttrField
                            key={id}
                            def={def}
                            value={attrValues[id] ?? emptyValueFor(def)}
                            onChange={(v) => setAttrValues((p) => ({ ...p, [id]: v }))}
                            error={fieldErrors[id]}
                            isOptional
                            onRemove={() => handleRemoveOptional(id)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Add optional attribute picker */}
                  {availableOptionalDefs.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <Select value={addAttrPickerId} onValueChange={handleAddOptional}>
                        <SelectTrigger className="flex-1 text-sm text-gray-500 border-dashed">
                          <SelectValue placeholder="+ Add optional attribute…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOptionalDefs.map((def) => (
                            <SelectItem key={def.id || def._id} value={String(def.id || def._id)}>
                              {def.displayName ? `${def.displayName} (${def.key})` : def.key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {requiredDefs.length === 0 && addedOptionalIds.length === 0 && (
                    <p className="text-xs text-gray-400">No Hub attribute definitions found. Define them in Hub Attributes first.</p>
                  )}
                </>
              )}

              {/* ── EDIT MODE: live assigned list + add row ── */}
              {isEditing && (
                <>
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

                  {/* Add attribute row */}
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
                </>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0">
            {/* Show total validation error count when submitted and errors exist */}
            {submitted && hasErrors && (
              <p className="text-xs text-red-500 flex items-center gap-1 mr-auto">
                <AlertCircle className="h-3.5 w-3.5" />
                Please fill in all required fields before creating.
              </p>
            )}
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? (createMutation.isPending ? 'Creating…' : 'Saving…')
                : isEditing
                  ? 'Save Changes'
                  : filledAttrCount > 0
                    ? `Create User & Assign ${filledAttrCount} Attribute${filledAttrCount > 1 ? 's' : ''}`
                    : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
