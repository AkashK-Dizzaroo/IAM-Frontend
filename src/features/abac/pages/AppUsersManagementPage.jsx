import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { abacService } from '@/features/abac/api/abacService';
import { resourceService } from '@/features/resources';
import { QK } from '@/lib/queryKeys';
import { useAbacScope } from '../contexts/AbacScopeContext';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Pencil, Trash2, Users, UserPlus } from 'lucide-react';
import { AppUserAttributesPanel } from './AppUserAttributesPanel';
import { AssignUserDialog } from './AssignUserDialog';

// ─── constants ────────────────────────────────────────────────────────────────

const RESOURCE_ACCESS_KEYS = ['resource_access', 'study_access', 'studies'];
const FLAG_KEYS = ['can_sign', 'is_investigator', 'is_approver', 'is_admin'];

// ─── helpers ──────────────────────────────────────────────────────────────────

// Returns array of {resource_id, role} objects from any resource access value shape.
function extractResourcePairs(attrs) {
  for (const key of RESOURCE_ACCESS_KEYS) {
    const val = attrs[key];
    if (val == null) continue;
    const items = Array.isArray(val) ? val : [val];
    const pairs = [];
    for (const item of items) {
      if (typeof item === 'string') {
        pairs.push({ resource_id: item, role: null });
      } else if (typeof item === 'object' && item !== null) {
        const id = String(
          item.resource_id ?? item.resourceId ?? item.study_id ?? item.studyId ?? item.id ?? ''
        ).trim();
        const role = String(item.role ?? '').trim() || null;
        if (id) pairs.push({ resource_id: id, role });
      }
    }
    return pairs;
  }
  return [];
}

function extractFlags(attrs) {
  return FLAG_KEYS.filter((k) => attrs[k] === true || attrs[k] === 'true');
}

function formatFlagLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\bis\b/gi, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── resource access cell ─────────────────────────────────────────────────────

function ResourceAccessCell({ pairs, resourceMap }) {
  if (!pairs.length) return <span className="text-gray-300">—</span>;

  return (
    <div className="flex flex-col gap-1">
      {pairs.map(({ resource_id, role }, idx) => {
        const meta = resourceMap[resource_id];
        const name = meta?.name ?? resource_id;
        return (
          <div key={`${resource_id}-${idx}`} className="flex items-start gap-x-2 gap-y-1 flex-wrap">
            <span className="text-xs text-gray-800 font-medium break-words max-w-[85%]">
              {name}
            </span>
            {role && (
              <span className="shrink-0 text-[10px] font-mono text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 leading-none whitespace-nowrap mt-0.5">
                {role}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

/**
 * AppUsersManagementPage
 *
 * Displays users assigned to the selected application with their app-specific
 * attributes. Supports single-user removal and bulk multi-select removal via a
 * floating action bar. The currently logged-in user is excluded from bulk
 * operations. Bulk removal runs individual service calls in parallel via
 * Promise.all and resets selection after completion.
 */
export function AppUsersManagementPage() {
  const { selectedAppKey, selectedAppName } = useAbacScope();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const debounceRef = useRef(null);

  // ── Bulk-select state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const { data: usersData, isLoading, refetch: refetchUsers } = useQuery({
    queryKey: QK.appUsers(selectedAppKey),
    queryFn: () => abacService.listAppUsers(selectedAppKey),
    enabled: !!selectedAppKey,
    staleTime: 30_000,
  });
  const allUsers = usersData?.data?.data ?? usersData?.data ?? [];

  const { data: attrDefsData } = useQuery({
    queryKey: QK.appAttributes(selectedAppKey),
    queryFn: () => abacService.listAppAttrDefs(selectedAppKey),
    enabled: !!selectedAppKey,
    staleTime: 5 * 60_000,
  });
  const attrDefs = attrDefsData?.data?.data ?? attrDefsData?.data ?? [];
  const totalDefs = attrDefs.filter(
    (d) => d.namespace !== 'action' && !(/(_role|^role)$/i.test(d.key) && d.dataType === 'enum')
  ).length;

  // Fetch the application record to get its id for the resource query
  const { data: applicationsData } = useQuery({
    queryKey: QK.appsForStudyAccess,
    queryFn: () => abacService.getApplications(),
    enabled: !!selectedAppKey,
    staleTime: 5 * 60_000,
  });
  const selectedApplication = (applicationsData?.data?.data ?? applicationsData?.data ?? []).find(
    (a) => a?.key === selectedAppKey
  );

  const { data: resourcesData } = useQuery({
    queryKey: QK.studyResources(selectedAppKey, selectedApplication?.id),
    queryFn: () =>
      resourceService.getResources({ applicationId: selectedApplication?.id, limit: 1000, isActive: 'true' }),
    enabled: !!selectedApplication?.id,
    staleTime: 5 * 60_000,
  });

  // id → { name, level, parentId, parentName }
  const resourceMap = useMemo(() => {
    const rawRows = resourcesData?.data ?? resourcesData?.resources ?? [];
    const rows = Array.isArray(rawRows) ? rawRows : [];
    const map = {};
    for (const r of rows) {
      const id = String(r.id ?? r._id ?? '').trim();
      if (!id) continue;
      map[id] = {
        name:       r.name ?? id,
        level:      r.level ?? null,
        parentId:   String(r.parentResource?._id ?? r.parentResource?.id ?? r.parentId ?? '').trim() || null,
        parentName: r.parentResource?.name ?? null,
      };
    }
    return map;
  }, [resourcesData]);

  const deleteMutation = useMutation({
    mutationFn: (userId) => abacService.removeAppUser(selectedAppKey, userId),
    onSuccess: () => {
      toast({ title: 'User removed from application' });
      setShowDeleteDialog(false);
      setUserToDelete(null);
      refetchUsers();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to remove user';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [allUsers, debouncedSearch]);

  // ── Select-all helpers for the visible (filtered) list ────────────────────
  // Exclude the currently logged-in user from bulk operations.
  const selectableUsers = useMemo(
    () =>
      filteredUsers.filter(
        (u) => currentUser?.id !== (u.id || u._id)
      ),
    [filteredUsers, currentUser]
  );

  const visibleIds = selectableUsers.map((u) => u.id || u._id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleRowCheckbox = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => abacService.removeAppUser(selectedAppKey, id)));
      toast({
        title: 'Users removed',
        description: `${ids.length} user${ids.length === 1 ? '' : 's'} removed from ${selectedAppName || selectedAppKey}.`,
      });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      refetchUsers();
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'One or more removals failed.';
      toast({ title: 'Bulk remove failed', description: msg, variant: 'destructive' });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Summary list for the bulk-delete confirmation dialog (max 5 shown).
  const bulkDeletePreviewNames = useMemo(() => {
    const ids = Array.from(selectedIds);
    const matched = allUsers.filter((u) => ids.includes(u.id || u._id));
    return matched.slice(0, 5).map((u) => u.displayName || u.email || u.id);
  }, [selectedIds, allUsers]);

  const bulkDeleteOverflow = selectedIds.size > 5 ? selectedIds.size - 5 : 0;

  if (!selectedAppKey) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <p className="font-medium text-gray-900 mb-1">No Application Selected</p>
        <p className="text-sm text-gray-500">Select an application to manage its users.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {selectedAppName || selectedAppKey} — Users
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage users and their app-specific attributes
          </p>
        </div>
        <Button
          onClick={() => setAssignDialogOpen(true)}
          className="flex items-center gap-1.5"
        >
          <UserPlus className="h-4 w-4" />
          Assign Users
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search users by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty — no users */}
      {!isLoading && allUsers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-lg">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-1">No users assigned</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Users appear here once they have at least one attribute assigned for{' '}
            <span className="font-medium">{selectedAppName || selectedAppKey}</span>.
          </p>
        </div>
      )}

      {/* Empty — search returned nothing */}
      {!isLoading && allUsers.length > 0 && filteredUsers.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg">
          No users match &ldquo;{debouncedSearch}&rdquo;
        </div>
      )}

      {/* Table */}
      {!isLoading && filteredUsers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left uppercase text-xs text-gray-500 tracking-wide">
                {/* Select-all checkbox column */}
                <th className="px-3 py-3 w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all visible users"
                  />
                </th>
                <th className="px-4 py-3 font-medium w-[24%]">User</th>
                <th className="px-4 py-3 font-medium w-[35%]">Resource Access</th>
                <th className="px-4 py-3 font-medium w-[16%]">Flags</th>
                <th className="px-4 py-3 font-medium w-[8%] text-center">Assigned</th>
                <th className="px-4 py-3 font-medium w-[10%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => {
                const userId = user.id || user._id;
                const isCurrentUser = currentUser?.id === userId;
                const isSelectable = !isCurrentUser;
                const initial = (user.displayName || user.email || '?')[0].toUpperCase();
                const attrs = user.appAttributes ?? {};
                const assignedCount = user.appUserAttributes?.length ?? Object.keys(attrs).length;
                const resourcePairs = extractResourcePairs(attrs);
                const flags = extractFlags(attrs);

                return (
                  <tr key={userId} className="hover:bg-gray-50 transition-colors align-top group">
                    {/* Row-level checkbox — hidden until hover or selection is active */}
                    <td className="px-3 py-3 w-10">
                      {isSelectable ? (
                        <Checkbox
                          checked={selectedIds.has(userId)}
                          onCheckedChange={() => handleRowCheckbox(userId)}
                          aria-label={`Select ${user.displayName || user.email}`}
                          className={
                            selectedIds.size > 0
                              ? 'opacity-100'
                              : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                          }
                        />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {user.displayName || user.email || '—'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{user.email || '—'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 break-words">
                      <ResourceAccessCell pairs={resourcePairs} resourceMap={resourceMap} />
                    </td>

                    <td className="px-4 py-3">
                      {flags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {flags.map((k) => (
                            <span key={k} className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
                              <span className="text-green-500">✓</span>
                              {formatFlagLabel(k)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        {assignedCount}/{totalDefs || '?'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 hover:bg-red-50 hover:text-red-600"
                            onClick={() => { setUserToDelete(user); setShowDeleteDialog(true); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Floating bulk-action bar — inside the table card, above the bottom border */}
          {selectedIds.size > 0 && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between rounded-b-lg shadow-sm z-10">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Deselect all
                </button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete {selectedIds.size}{' '}
                {selectedIds.size === 1 ? 'item' : 'items'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Single-row delete confirmation dialog ── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User from Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>{userToDelete?.displayName || userToDelete?.email}</strong>{' '}
              from <strong>{selectedAppName || selectedAppKey}</strong>? This will delete all their
              app-specific attributes. Their hub account will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(userToDelete?.id || userToDelete?._id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk-delete confirmation dialog ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.size}{' '}
              {selectedIds.size === 1 ? 'item' : 'items'}?
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm text-gray-600">This action cannot be undone.</DialogDescription>
          {bulkDeletePreviewNames.length > 0 && (
            <ul className="mt-2 space-y-1">
              {bulkDeletePreviewNames.map((name, i) => (
                <li key={i} className="text-sm text-gray-700 truncate">
                  • {name}
                </li>
              ))}
              {bulkDeleteOverflow > 0 && (
                <li className="text-sm text-gray-400">+{bulkDeleteOverflow} more</li>
              )}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit attributes dialog ── */}
      <AppUserAttributesPanel
        appKey={selectedAppKey}
        user={selectedUser}
        attrDefs={attrDefs}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onAttributeChanged={refetchUsers}
      />

      {/* ── Assign user dialog ── */}
      <AssignUserDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        appKey={selectedAppKey}
        appId={selectedApplication?.id}
        attrDefs={attrDefs}
      />
    </div>
  );
}
