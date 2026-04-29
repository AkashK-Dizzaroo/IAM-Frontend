import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { abacService } from '@/features/abac/api/abacService';
import { resourceService } from '@/features/resources';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Trash2, Loader2, UserPlus, ChevronRight } from 'lucide-react';

// ─── user search combobox ─────────────────────────────────────────────────────

function UserSearchCombobox({ selectedUser, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const { data, isFetching } = useQuery({
    queryKey: ['abac', 'users', 'search', query],
    queryFn: () => abacService.listUsers({ search: query, limit: 20, status: 'active' }),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });
  const users = data?.data?.data ?? data?.data ?? [];

  useEffect(() => {
    function handleClick(e) {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (user) => {
    onSelect(user);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      {selectedUser ? (
        <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
              {(selectedUser.displayName || selectedUser.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedUser.displayName || selectedUser.username}
              </p>
              <p className="text-xs text-gray-500 truncate">{selectedUser.email}</p>
            </div>
          </div>
          <Button
            type="button" variant="ghost" size="sm"
            className="h-7 px-2 text-xs text-gray-400 hover:text-red-500 shrink-0"
            onClick={() => onSelect(null)}
          >
            Change
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => query.length >= 1 && setOpen(true)}
              className="pl-9"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
          {open && users.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
            >
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(u); }}
                >
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {(u.displayName || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {u.displayName || u.username}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {open && query.length >= 1 && !isFetching && users.length === 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400">
              No users found for &ldquo;{query}&rdquo;
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── resource tree picker ─────────────────────────────────────────────────────
// Builds a tree from flat resource list (L2 parents + L3 children) and renders
// it as a nested selectable structure matching the ResourceAccessDisplay style.

function buildResourceTree(resources) {
  const byId = {};
  for (const r of resources) {
    byId[r.id ?? r._id] = { ...r, children: [] };
  }
  const roots = [];
  for (const r of resources) {
    const id = r.id ?? r._id;
    const parentId = r.parentResource?._id ?? r.parentResource?.id ?? r.parentId ?? null;
    if (parentId && byId[parentId]) {
      byId[parentId].children.push(byId[id]);
    } else {
      roots.push(byId[id]);
    }
  }
  return roots;
}

function ResourceTreeSelect({ resources, selectedResourceId, onSelect }) {
  const tree = useMemo(() => buildResourceTree(resources), [resources]);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggle = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (resources.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-2">No resources available for this application.</p>
    );
  }

  const renderNode = (node, depth = 0) => {
    const id = node.id ?? node._id;
    const isSelected = selectedResourceId === id;
    const hasChildren = node.children?.length > 0;
    const isExpanded = expandedIds.has(id);

    return (
      <div key={id}>
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer select-none transition-colors group
            ${isSelected
              ? 'bg-primary/10 border border-primary/30'
              : 'hover:bg-gray-50 border border-transparent'
            }`}
          style={{ marginLeft: depth * 16 }}
          onClick={() => onSelect(isSelected ? '' : id)}
        >
          {/* Expand toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(id); }}
              className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5 -ml-0.5 rounded"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* Selection indicator */}
          <span
            className={`h-3 w-3 rounded-full shrink-0 border-2 transition-colors ${
              isSelected ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-primary/50'
            }`}
          />

          <span className={`text-sm truncate ${isSelected ? 'font-medium text-primary' : 'text-gray-800'}`}>
            {node.name}
          </span>
          {node.level && (
            <span className="shrink-0 text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded px-1">
              L{node.level}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-1.5 max-h-48 overflow-y-auto space-y-0.5">
      {tree.map((node) => renderNode(node))}
    </div>
  );
}

// ─── attribute input ──────────────────────────────────────────────────────────

function AttrInput({ def, value, onChange }) {
  const constraints = def.constraints ?? {};

  if (def.dataType === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Switch id={`asgn-attr-${def.id}`} checked={Boolean(value)} onCheckedChange={onChange} />
        <Label htmlFor={`asgn-attr-${def.id}`} className="text-sm cursor-pointer">
          {value ? 'Yes' : 'No'}
        </Label>
      </div>
    );
  }

  if (def.dataType === 'enum' && Array.isArray(constraints.allowedValues)) {
    return (
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a value…" />
        </SelectTrigger>
        <SelectContent>
          {constraints.allowedValues.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={def.dataType === 'number' ? 'number' : 'text'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${def.displayName}…`}
    />
  );
}

// ─── resource + role row ──────────────────────────────────────────────────────

function ResourceRoleRow({ index, row, resources, roleOptions, onChange, onRemove, canRemove }) {
  const [treeOpen, setTreeOpen] = useState(false);
  const rowRef = useRef(null);
  const selectedResource = resources.find((r) => (r.id ?? r._id) === row.resourceId);

  // Close tree when clicking outside the row
  useEffect(() => {
    function handleClick(e) {
      if (!rowRef.current?.contains(e.target)) setTreeOpen(false);
    }
    if (treeOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [treeOpen]);

  return (
    <div ref={rowRef} className="space-y-1.5">
      {/* Resource trigger + Role dropdown + Remove — same row */}
      <div className="flex items-center gap-2">
        {/* Resource picker trigger */}
        <button
          type="button"
          onClick={() => setTreeOpen((o) => !o)}
          className={`flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors min-w-0
            ${selectedResource
              ? 'bg-white border-gray-200 text-gray-900'
              : 'bg-white border-dashed border-gray-300 text-gray-400'
            }`}
        >
          {selectedResource ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-gray-900 truncate">{selectedResource.name}</span>
              {selectedResource.level && (
                <span className="shrink-0 text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded px-1">
                  L{selectedResource.level}
                </span>
              )}
            </span>
          ) : (
            <span className="truncate">Select resource…</span>
          )}
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${treeOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Role dropdown — values sourced from action-namespace attr def allowedValues */}
        <div className="w-44 shrink-0">
          <Select value={row.role || ''} onValueChange={(v) => onChange(index, { role: v })}>
            <SelectTrigger className={`bg-white ${!row.role ? 'text-gray-400' : ''}`}>
              <SelectValue placeholder="Select role… *" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
              {roleOptions.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">No roles defined</div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Remove button */}
        <button
          type="button"
          disabled={!canRemove}
          onClick={() => onRemove(index)}
          className="shrink-0 p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tree panel — drops inline below the row when open */}
      {treeOpen && (
        <ResourceTreeSelect
          resources={resources}
          selectedResourceId={row.resourceId || ''}
          onSelect={(id) => { onChange(index, { resourceId: id }); setTreeOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── main dialog ──────────────────────────────────────────────────────────────

const EMPTY_ROW = { resourceId: '', role: '' };

export function AssignUserDialog({ open, onClose, appKey, appId, attrDefs }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUser, setSelectedUser] = useState(null);
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [attrValues, setAttrValues] = useState({});

  useEffect(() => {
    if (!open) {
      setSelectedUser(null);
      setRows([{ ...EMPTY_ROW }]);
      setAttrValues({});
    }
  }, [open]);

  // Resources for this app
  const { data: resourcesData } = useQuery({
    queryKey: ['abac', 'studyResources', appKey, appId],
    queryFn: () => resourceService.getResources({ applicationId: appId, limit: 1000, isActive: 'true' }),
    enabled: !!appId && open,
    staleTime: 60_000,
  });
  const resources = useMemo(() => {
    const raw = resourcesData?.data ?? resourcesData?.resources ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [resourcesData]);

  // Role options — find the first attr def whose key ends with _role and has allowedValues
  // (e.g. tmf_role enum with ['study_monitor', 'principal_investigator', …]).
  // This covers both action-namespace and subject-namespace role defs.
  const roleDef = useMemo(
    () => attrDefs.find(
      (d) => /(_role|^role)$/i.test(d.key) && Array.isArray(d.constraints?.allowedValues) && d.constraints.allowedValues.length > 0
    ),
    [attrDefs]
  );
  const roleOptions = roleDef?.constraints?.allowedValues ?? [];

  // Additional attributes: exclude resource/study access (handled by rows),
  // action namespace, and whichever def is powering the role dropdown above.
  const otherDefs = useMemo(
    () => attrDefs.filter(
      (d) =>
        d.namespace !== 'action' &&
        !['resource_access', 'study_access'].includes(d.key) &&
        d.id !== roleDef?.id
    ),
    [attrDefs, roleDef]
  );

  const updateRow = (idx, patch) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);

  const mutation = useMutation({
    mutationFn: (payload) => abacService.assignAppUser(appKey, payload),
    onSuccess: () => {
      toast({
        title: 'User assigned',
        description: `${selectedUser?.displayName || selectedUser?.email} has been assigned and notified by email.`,
      });
      queryClient.invalidateQueries({ queryKey: ['abac', 'appUsers', appKey] });
      onClose();
    },
    onError: (err) =>
      toast({
        title: 'Assignment failed',
        description: err?.response?.data?.error ?? err.message,
        variant: 'destructive',
      }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    // Only include rows that have both resource and role selected
    const validAssignments = rows.filter((r) => r.resourceId && r.role);

    const attributePayload = {};
    for (const def of otherDefs) {
      const val = attrValues[def.id];
      if (val !== undefined && val !== '' && val !== null) {
        attributePayload[def.key] = val;
      }
    }

    mutation.mutate({
      userId: selectedUser.id,
      assignments: validAssignments,
      attributes: attributePayload,
    });
  };

  // At least one row must have a resource + role selected, or there are attributes to assign
  const hasValidRow = rows.some((r) => r.resourceId && r.role);
  const hasAttributes = Object.values(attrValues).some((v) => v !== undefined && v !== '' && v !== null);
  const canSubmit = !!selectedUser && (hasValidRow || hasAttributes) && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary shrink-0" />
            <DialogTitle className="text-base font-semibold">Assign User</DialogTitle>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 ml-7">
            Directly grant a user resource access and attributes. They will receive an email notification.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

            {/* ── User picker ── */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                User <span className="text-red-500">*</span>
              </Label>
              <UserSearchCombobox selectedUser={selectedUser} onSelect={setSelectedUser} />
            </div>

            {/* ── Resource + Role assignments ── */}
            <div className="space-y-2">
              <div>
                <Label className="text-sm font-medium">Resource Access</Label>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select resources and the role for each. Role is required per row.
                </p>
              </div>

              {/* Column headers */}
              <div className="flex items-center gap-2 px-0.5">
                <span className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Resource</span>
                <span className="w-44 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Role <span className="text-red-500">*</span>
                </span>
                <span className="w-7 shrink-0" />
              </div>

              <div className="space-y-2">
                {rows.map((row, idx) => (
                  <ResourceRoleRow
                    key={idx}
                    index={idx}
                    row={row}
                    resources={resources}
                    roleOptions={roleOptions}
                    onChange={updateRow}
                    onRemove={removeRow}
                    canRemove={rows.length > 1}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium py-1 px-1 rounded transition-colors hover:bg-indigo-50"
              >
                <Plus className="w-4 h-4" />
                Add resource
              </button>
            </div>

            {/* ── Additional attributes ── */}
            {otherDefs.length > 0 && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Additional Attributes</Label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Application-specific attributes for this user.
                  </p>
                </div>
                {otherDefs.map((def) => (
                  <div key={def.id} className="space-y-1">
                    <Label htmlFor={`asgn-attr-${def.id}`} className="text-sm">
                      {def.displayName}
                      {def.isRequired && <span className="text-red-500 ml-1">*</span>}
                      <span className="ml-1.5 text-[10px] font-mono text-gray-400">
                        ({def.dataType})
                      </span>
                    </Label>
                    {def.description && (
                      <p className="text-xs text-gray-400">{def.description}</p>
                    )}
                    <AttrInput
                      def={def}
                      value={attrValues[def.id]}
                      onChange={(val) => setAttrValues((prev) => ({ ...prev, [def.id]: val }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Assign &amp; Notify
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
