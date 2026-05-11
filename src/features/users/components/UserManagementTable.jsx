import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { userService } from "../api/userService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/**
 * UserManagementTable
 *
 * Displays a paginated, searchable, filterable table of hub users.
 * Supports single-row delete and bulk multi-select delete via a floating
 * action bar. Bulk delete runs individual service calls in parallel via
 * Promise.all and resets selection after completion.
 */
export const UserManagementTable = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user: currentUser } = useAuth();

  // ── Bulk-select state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        organization:
          organizationFilter !== "all" ? organizationFilter : undefined,
      });
      if (response.success) {
        setUsers(response.data || []);
        setPagination(response.pagination || { total: 0, pages: 0 });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [
    currentPage,
    itemsPerPage,
    searchTerm,
    statusFilter,
    organizationFilter,
  ]);

  // Reset selection whenever filters or page change so stale ids are cleared.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, searchTerm, statusFilter, organizationFilter]);

  const uniqueOrganizations = useMemo(() => {
    return [...new Set(users.map((u) => u.organization).filter(Boolean))].sort();
  }, [users]);

  // ── Select-all helpers for the current page ────────────────────────────────
  // Exclude the currently logged-in user from bulk operations.
  const selectableUsers = useMemo(
    () =>
      users
        .filter((u) => u)
        .filter((u) => currentUser?.id !== (u._id || u.id)),
    [users, currentUser]
  );

  const visibleIds = selectableUsers.map((u) => u._id || u.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all on this page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all selectable on this page
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

  // ── Single-row delete ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await userService.deleteUser(userToDelete._id || userToDelete.id);
      toast({ title: "Success", description: "User deleted successfully" });
      setShowDeleteDialog(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => userService.deleteUser(id)));
      toast({
        title: "Users deleted",
        description: `${ids.length} user${ids.length === 1 ? "" : "s"} deleted successfully.`,
      });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      fetchUsers();
    } catch (error) {
      toast({
        title: "Bulk delete failed",
        description: error.message || "One or more deletions failed.",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // ── Misc helpers ───────────────────────────────────────────────────────────
  const getStatusIcon = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "active") return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (s === "pending") return <Clock className="w-4 h-4 text-yellow-600" />;
    if (s === "inactive" || s === "suspended")
      return <XCircle className="w-4 h-4 text-red-600" />;
    return <AlertCircle className="w-4 h-4 text-gray-600" />;
  };

  const getStatusBadgeVariant = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "active") return "bg-green-100 text-green-800";
    if (s === "pending") return "bg-yellow-100 text-yellow-800";
    if (s === "inactive" || s === "suspended") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const getUserName = (user) => {
    if (!user) return "Unknown User";
    if (user.firstName || user.lastName)
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return user.name || user.email || "Unknown User";
  };

  const formatDate = (date) => {
    if (!date) return "Never";
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  // Summary list for the bulk-delete confirmation dialog (max 5 shown).
  const bulkDeletePreviewNames = useMemo(() => {
    const ids = Array.from(selectedIds);
    const matched = users.filter((u) => ids.includes(u._id || u.id));
    return matched.slice(0, 5).map(getUserName);
  }, [selectedIds, users]);

  const bulkDeleteOverflow = selectedIds.size > 5 ? selectedIds.size - 5 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users & Access</h2>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={organizationFilter}
              onValueChange={(v) => {
                setOrganizationFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {uniqueOrganizations.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchUsers} disabled={loading}>
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading && users.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      {/* Select-all checkbox column */}
                      <th className="px-4 py-3 w-10">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all users on this page"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Login
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users
                      .filter((u) => u)
                      .map((user) => {
                        const id = user._id || user.id;
                        const isCurrentUser = currentUser?.id === id;
                        const isSelectable = !isCurrentUser;

                        return (
                          <tr
                            key={id}
                            className="hover:bg-gray-50 group"
                          >
                            {/* Row-level checkbox — hidden until hover or selection is active */}
                            <td className="px-4 py-3 w-10">
                              {isSelectable ? (
                                <Checkbox
                                  checked={selectedIds.has(id)}
                                  onCheckedChange={() => handleRowCheckbox(id)}
                                  aria-label={`Select ${getUserName(user)}`}
                                  className={
                                    selectedIds.size > 0
                                      ? "opacity-100"
                                      : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                                  }
                                />
                              ) : (
                                <div className="w-4 h-4" />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                  <span className="text-xs font-medium text-white">
                                    {getUserName(user)
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900">
                                    {getUserName(user)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(
                                  user.status ||
                                    (user.isActive ? "ACTIVE" : "INACTIVE")
                                )}
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeVariant(
                                    user.status ||
                                      (user.isActive ? "ACTIVE" : "INACTIVE")
                                  )}`}
                                >
                                  {user.status ||
                                    (user.isActive ? "Active" : "Inactive")}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">
                                {formatDate(user.lastLogin)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedUser(user)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                {!isCurrentUser && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="hover:bg-red-50 hover:text-red-600"
                                    onClick={() => {
                                      setUserToDelete(user);
                                      setShowDeleteDialog(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Floating bulk-action bar — sits above pagination, visible when rows are selected */}
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
                    Delete {selectedIds.size}{" "}
                    {selectedIds.size === 1 ? "item" : "items"}
                  </Button>
                </div>
              )}

              {pagination.pages > 1 && (
                <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      pagination.total
                    )}{" "}
                    of {pagination.total} users
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {pagination.pages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(pagination.pages, p + 1)
                        )
                      }
                      disabled={currentPage === pagination.pages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Single-row delete confirmation dialog ── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{getUserName(userToDelete)}</strong>{" "}
              ({userToDelete?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk-delete confirmation dialog ── */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "item" : "items"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This action cannot be undone.</p>
          {bulkDeletePreviewNames.length > 0 && (
            <ul className="mt-2 space-y-1">
              {bulkDeletePreviewNames.map((name, i) => (
                <li key={i} className="text-sm text-gray-700 truncate">
                  • {name}
                </li>
              ))}
              {bulkDeleteOverflow > 0 && (
                <li className="text-sm text-gray-400">
                  +{bulkDeleteOverflow} more
                </li>
              )}
            </ul>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
