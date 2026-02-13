import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { userService } from "../api/userService";
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

export const UserManagementTable = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

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

  const uniqueOrganizations = useMemo(() => {
    return [...new Set(users.map((u) => u.organization).filter(Boolean))].sort();
  }, [users]);

  const handleDelete = async () => {
    if (!userToDelete) return;
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
    }
  };

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
                      .map((user) => (
                        <tr
                          key={user._id || user.id}
                          className="hover:bg-gray-50"
                        >
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setUserToDelete(user);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
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

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {getUserName(userToDelete)}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
