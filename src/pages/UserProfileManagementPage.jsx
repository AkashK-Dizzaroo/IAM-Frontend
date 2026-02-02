import { useState, useMemo, memo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import userService from '@/services/user.service';
import applicationService from '@/services/application.service';
import roleService from '@/services/role.service';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString();
};

// Memoized status computation
const computeStatus = (assignment) => {
  if (!assignment.isActive) return { label: 'Inactive', variant: 'inactive' };
  if (assignment.validUntil && new Date(assignment.validUntil) < new Date()) {
    return { label: 'Expired', variant: 'expired' };
  }
  return { label: 'Active', variant: 'active' };
};

// Memoized table row component
const AssignmentRow = memo(({ assignment }) => {
  const userName = useMemo(() => {
    return [assignment.user?.firstName, assignment.user?.lastName]
      .filter(Boolean)
      .join(' ') || assignment.user?.email || '—';
  }, [assignment.user]);

  const resourceName = useMemo(() => {
    return assignment.resource?.name || assignment.resource?.resourceExternalId || 'App-wide';
  }, [assignment.resource]);

  const approver = useMemo(() => {
    return assignment.assignedBy?.email || '—';
  }, [assignment.assignedBy]);

  const status = useMemo(() => computeStatus(assignment), [assignment]);

  const startDate = useMemo(() => {
    return formatDate(assignment.validFrom || assignment.createdAt);
  }, [assignment.validFrom, assignment.createdAt]);

  const endDate = useMemo(() => {
    return formatDate(assignment.validUntil);
  }, [assignment.validUntil]);

  const getStatusBadge = (statusVariant) => {
    switch (statusVariant) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
            {status.label}
          </Badge>
        );
      case 'inactive':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
            {status.label}
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
            {status.label}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.label}</Badge>;
    }
  };

  return (
    <tr key={assignment._id}>
      <td className="px-4 py-3 text-sm text-gray-900">{userName}</td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {assignment.application?.name || assignment.application?.appCode || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{resourceName}</td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {assignment.role?.name || assignment.role?.roleCode || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{approver}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{startDate}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{endDate}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{getStatusBadge(status.variant)}</td>
    </tr>
  );
});

AssignmentRow.displayName = 'AssignmentRow';

const UserProfileManagementPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.globalRole === 'ADMIN';

  // Pagination and filter state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');

  // Dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  // Fetch applications for filter
  const { data: filterApplicationsData } = useQuery({
    queryKey: ['applications-filter'],
    queryFn: async () => {
      try {
        const response = await applicationService.getApplications();
        return response?.data || [];
      } catch (error) {
        console.error('Failed to fetch applications for filter:', error);
        return [];
      }
    },
  });

  // Fetch all resources for filter
  const { data: filterResourcesData } = useQuery({
    queryKey: ['resources-filter'],
    queryFn: async () => {
      try {
        // Get all assignments first to extract unique resources
      const response = await userService.getAllAssignments({ limit: 100 });
        const assignments = response?.data || [];
        
        // Extract unique resources
        const resourcesMap = new Map();
        assignments.forEach((assignment) => {
          if (assignment.resource && assignment.resource._id) {
            resourcesMap.set(assignment.resource._id, assignment.resource);
          }
        });
        
        return Array.from(resourcesMap.values());
      } catch (error) {
        console.error('Failed to fetch resources for filter:', error);
        return [];
      }
    },
  });

  const filterApplications = filterApplicationsData || [];
  const filterResources = filterResourcesData || [];

  // Fetch assignments with pagination using React Query
  const {
    data: assignmentsData,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ['assignments', currentPage, itemsPerPage, searchTerm, applicationFilter, resourceFilter, statusFilter, sortBy],
    queryFn: async ({ signal }) => {
      // Fetch ALL assignments for client-side filtering to work correctly
      const response = await userService.getAllAssignments({
        page: 1,
        limit: 100,  // Fetch max allowed by backend
        signal,
      });
      
      let filteredData = response?.data || [];

      // Client-side filtering for search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = filteredData.filter((assignment) => {
          const userName = [assignment.user?.firstName, assignment.user?.lastName]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const email = assignment.user?.email?.toLowerCase() || '';
          const appName = assignment.application?.name?.toLowerCase() || '';
          return userName.includes(term) || email.includes(term) || appName.includes(term);
        });
      }

      // Client-side filtering for application
      if (applicationFilter && applicationFilter !== 'all') {
        filteredData = filteredData.filter((assignment) => 
          (assignment.application?._id || assignment.application?.id) === applicationFilter
        );
      }

      // Client-side filtering for resource
      if (resourceFilter && resourceFilter !== 'all') {
        if (resourceFilter === 'app-wide') {
          // Show only app-wide assignments (no resource)
          filteredData = filteredData.filter((assignment) => !assignment.resource);
        } else {
          // Show assignments for specific resource
          filteredData = filteredData.filter((assignment) => 
            (assignment.resource?._id || assignment.resource?.id) === resourceFilter
          );
        }
      }

      // Client-side filtering for status
      if (statusFilter && statusFilter !== 'all') {
        filteredData = filteredData.filter((assignment) => {
          const status = computeStatus(assignment);
          return status.variant === statusFilter;
        });
      }

      // Client-side sorting
      filteredData.sort((a, b) => {
        switch (sortBy) {
          case 'userName':
            const nameA = [a.user?.firstName, a.user?.lastName].filter(Boolean).join(' ') || a.user?.email || '';
            const nameB = [b.user?.firstName, b.user?.lastName].filter(Boolean).join(' ') || b.user?.email || '';
            return nameA.localeCompare(nameB);
          case 'application':
            const appA = a.application?.name || '';
            const appB = b.application?.name || '';
            return appA.localeCompare(appB);
          case 'createdAt':
          default:
            return new Date(b.createdAt) - new Date(a.createdAt);
        }
      });
      
      // Transform data to view-ready format
      const formattedAssignments = filteredData.map((assignment) => ({
        ...assignment,
        userName: [assignment.user?.firstName, assignment.user?.lastName]
          .filter(Boolean)
          .join(' ') || assignment.user?.email || '—',
        resourceName: assignment.resource?.name || assignment.resource?.resourceExternalId || 'App-wide',
        approver: assignment.assignedBy?.email || '—',
        startDate: formatDate(assignment.validFrom || assignment.createdAt),
        endDate: formatDate(assignment.validUntil),
        status: computeStatus(assignment),
      }));
      
      // Calculate pagination for filtered results
      const total = formattedAssignments.length;
      const pages = Math.ceil(total / itemsPerPage);
      const startIdx = (currentPage - 1) * itemsPerPage;
      const endIdx = startIdx + itemsPerPage;
      const paginatedData = formattedAssignments.slice(startIdx, endIdx);
      
      return {
        assignments: paginatedData,
        pagination: { page: currentPage, limit: itemsPerPage, total, pages },
      };
    },
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, applicationFilter, resourceFilter, statusFilter, sortBy, itemsPerPage]);

  const assignments = assignmentsData?.assignments || [];
  const pagination = assignmentsData?.pagination || { page: 1, limit: itemsPerPage, total: 0, pages: 0 };

  // Fetch users for dialog
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await userService.getUsers({ limit: 1000 });
      return response?.data || [];
    },
    enabled: showAssignDialog,
  });

  // Fetch applications for dialog
  const { data: applicationsData } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const response = await applicationService.getApplications();
      return response?.data || [];
    },
    enabled: showAssignDialog,
  });

  // Fetch roles for selected application
  const { data: rolesData } = useQuery({
    queryKey: ['roles', selectedApplicationId],
    queryFn: async () => {
      if (!selectedApplicationId) return [];
      const response = await roleService.getRolesByApplication(selectedApplicationId);
      return response?.data || [];
    },
    enabled: showAssignDialog && !!selectedApplicationId,
  });

  // Fetch resources for selected application
  const { data: resourcesData } = useQuery({
    queryKey: ['resources', selectedApplicationId],
    queryFn: async () => {
      if (!selectedApplicationId) return [];
      try {
        const response = await api.get(`/resources/application/${selectedApplicationId}`);
        return response?.data?.data || [];
      } catch (error) {
        // If resources endpoint doesn't exist or fails, return empty array
        console.warn('Failed to fetch resources:', error);
        return [];
      }
    },
    enabled: showAssignDialog && !!selectedApplicationId,
  });

  const users = usersData || [];
  const applications = applicationsData || [];
  const roles = rolesData || [];
  const resources = resourcesData || [];

  // Reset dialog when application changes
  useEffect(() => {
    if (selectedApplicationId) {
      setSelectedRoleId('');
      setSelectedResourceId('');
    }
  }, [selectedApplicationId]);

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (assignmentData) => {
      return await userService.assignUserToApplication(selectedUserId, assignmentData);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Assignment created successfully',
      });
      setShowAssignDialog(false);
      // Reset form
      setSelectedUserId('');
      setSelectedApplicationId('');
      setSelectedRoleId('');
      setSelectedResourceId('');
      setValidFrom('');
      setValidUntil('');
      // Invalidate assignments query to refetch
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create assignment',
        variant: 'destructive',
      });
    },
  });

  const handleCreateAssignment = () => {
    if (!selectedUserId || !selectedApplicationId || !selectedRoleId) {
      toast({
        title: 'Validation Error',
        description: 'Please select user, application, and role',
        variant: 'destructive',
      });
      return;
    }

    const assignmentData = {
      applicationId: selectedApplicationId,
      roleId: selectedRoleId,
    };

    if (selectedResourceId) {
      assignmentData.resourceId = selectedResourceId;
    }

    if (validFrom) {
      assignmentData.validFrom = new Date(validFrom).toISOString();
    }

    if (validUntil) {
      assignmentData.validUntil = new Date(validUntil).toISOString();
    }

    createAssignmentMutation.mutate(assignmentData);
  };

  const getUserName = (user) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email || 'Unknown User';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">User Profile Management</h2>
        <p className="text-gray-600">Assignments across applications, resources, and roles.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAssignDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Assignment
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="space-y-4">
          {/* Search and Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search users by name, email, or organization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={applicationFilter} onValueChange={setApplicationFilter}>
              <SelectTrigger>
                <SelectValue>
                  {applicationFilter === 'all' 
                    ? 'All Applications' 
                    : filterApplications.find(app => (app._id || app.id) === applicationFilter)?.name || 'All Applications'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Applications</SelectItem>
                {filterApplications.map((app) => (
                  <SelectItem key={app._id || app.id} value={app._id || app.id}>
                    {app.name} ({app.appCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue>
                  {statusFilter === 'all' ? 'All Statuses' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger>
                <SelectValue>
                  {resourceFilter === 'all' 
                    ? 'All Resources' 
                    : resourceFilter === 'app-wide'
                    ? 'App-wide Only'
                    : filterResources.find(res => (res._id || res.id) === resourceFilter)?.name || 'All Resources'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="app-wide">App-wide Only</SelectItem>
                {filterResources.map((resource) => (
                  <SelectItem key={resource._id || resource.id} value={resource._id || resource.id}>
                    {resource.name || resource.resourceExternalId || 'Unknown Resource'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show, Sort, and Pagination Info Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show:</span>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(value) => setItemsPerPage(Number(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Created Date</SelectItem>
                    <SelectItem value="userName">User Name</SelectItem>
                    <SelectItem value="application">Application</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAssignments()}
                disabled={assignmentsLoading}
              >
                <RefreshCw className={`w-4 h-4 ${assignmentsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="text-sm text-gray-600">
              Showing {pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} assignments
            </div>
          </div>
        </div>
      </div>

      {assignmentsError && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3">
          {assignmentsError?.message || 'Failed to load assignments'}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Application</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Approved By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Start date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">End date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assignmentsLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Loading assignments...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    No assignments found
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <AssignmentRow key={assignment._id} assignment={assignment} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page === 1 || assignmentsLoading}
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={pagination.page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={assignmentsLoading}
                    className={pagination.page === pageNum ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={pagination.page === pagination.pages || assignmentsLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Assignment</DialogTitle>
            <DialogDescription>
              Create a new assignment for a user to an application with a role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">User *</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user._id || user.id} value={user._id || user.id}>
                      {getUserName(user)} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Application *</label>
              <Select value={selectedApplicationId} onValueChange={setSelectedApplicationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an application" />
                </SelectTrigger>
                <SelectContent>
                  {applications.map((app) => (
                    <SelectItem key={app._id || app.id} value={app._id || app.id}>
                      {app.name} ({app.appCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Role *</label>
              <Select
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
                disabled={!selectedApplicationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedApplicationId ? 'Select a role' : 'Select application first'} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role._id || role.id} value={role._id || role.id}>
                      {role.name} ({role.roleCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Resource (Optional)</label>
              <Select
                value={selectedResourceId}
                onValueChange={setSelectedResourceId}
                disabled={!selectedApplicationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedApplicationId ? 'App-wide (no resource)' : 'Select application first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">App-wide (no resource)</SelectItem>
                  {resources.map((resource) => (
                    <SelectItem key={resource._id || resource.id} value={resource._id || resource.id}>
                      {resource.name || resource.resourceExternalId || 'Unknown Resource'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Valid From (Optional)</label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Valid Until (Optional)</label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false);
                  setSelectedUserId('');
                  setSelectedApplicationId('');
                  setSelectedRoleId('');
                  setSelectedResourceId('');
                  setValidFrom('');
                  setValidUntil('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAssignment}
                disabled={createAssignmentMutation.isPending}
              >
                {createAssignmentMutation.isPending ? 'Creating...' : 'Create Assignment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserProfileManagementPage;
