import { useState, useMemo, memo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { useToast } from "@/hooks/use-toast";
import { userService } from "../api/userService";
import { applicationService } from "@/features/applications";
import { roleService } from "@/features/roles";
import { resourceService } from "@/features/resources";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, Shield, Trash2 } from "lucide-react";
import { AssignManagerModal } from "../components/AssignManagerModal";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString();
};

const computeStatus = (assignment) => {
  if (!assignment.isActive) return { label: "Inactive", variant: "inactive" };
  if (assignment.validUntil && new Date(assignment.validUntil) < new Date()) {
    return { label: "Expired", variant: "expired" };
  }
  return { label: "Active", variant: "active" };
};

const AssignmentRow = memo(({ assignment }) => {
  const userName = useMemo(() => {
    return [assignment.user?.firstName, assignment.user?.lastName]
      .filter(Boolean)
      .join(" ") || assignment.user?.email || "—";
  }, [assignment.user]);
  const resourceName = useMemo(() => {
    return (
      assignment.resource?.name ||
      assignment.resource?.resourceExternalId ||
      "App-wide"
    );
  }, [assignment.resource]);
  const approver = useMemo(
    () => assignment.assignedBy?.email || "—",
    [assignment.assignedBy]
  );
  const status = useMemo(() => computeStatus(assignment), [assignment]);
  const startDate = useMemo(
    () => formatDate(assignment.validFrom || assignment.createdAt),
    [assignment.validFrom, assignment.createdAt]
  );
  const endDate = useMemo(
    () => formatDate(assignment.validUntil),
    [assignment.validUntil]
  );

  const getStatusBadge = (statusVariant) => {
    switch (statusVariant) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
            {status.label}
          </Badge>
        );
      case "inactive":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
            {status.label}
          </Badge>
        );
      case "expired":
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
        {assignment.application?.name ||
          assignment.application?.appCode ||
          "—"}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{resourceName}</td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {assignment.role?.name || assignment.role?.roleCode || "—"}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{approver}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{startDate}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{endDate}</td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {getStatusBadge(status.variant)}
      </td>
    </tr>
  );
});
AssignmentRow.displayName = "AssignmentRow";

export const UserProfileManagementPage = () => {
  const { user, effectiveRoles } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isHubOwner = effectiveRoles.isHubOwner;
  const isAppOwner = effectiveRoles.isAppOwner && !isHubOwner;

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("app-wide");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");

  // App Owner specific state
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [appDetails, setAppDetails] = useState([]);
  const [assignManagerTarget, setAssignManagerTarget] = useState(null);

  // Fetch application details for App Owner's owned apps
  useEffect(() => {
    if (isAppOwner && effectiveRoles.appOwnerOf?.length > 0) {
      applicationService.getApplications()
        .then((response) => {
          const allApps = response?.data ?? response ?? [];
          const apps = Array.isArray(allApps) ? allApps : [];
          const ownedIds = effectiveRoles.appOwnerOf.map(String);
          const valid = apps.filter(
            (a) => ownedIds.includes(String(a._id ?? a.id))
          );
          setAppDetails(valid);
          if (valid.length === 1) {
            setSelectedAppId(String(valid[0]._id ?? valid[0].id));
          }
        })
        .catch(() => setAppDetails([]));
    }
  }, [isAppOwner, effectiveRoles.appOwnerOf?.join(',')]);

  // App Owner scoped query
  const {
    data: appTeamData,
    isLoading: appTeamLoading,
    refetch: refetchAppTeam,
  } = useQuery({
    queryKey: ['appTeam', selectedAppId, searchTerm],
    queryFn: () => userService.getAppTeamUsers(selectedAppId, searchTerm),
    enabled: isAppOwner && !!selectedAppId,
    staleTime: 2 * 60 * 1000,
  });

  const appTeamUsers = useMemo(() => {
    const raw = appTeamData?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [appTeamData]);

  const removeManagerMutation = useMutation({
    mutationFn: ({ userId, assignmentId }) =>
      userService.removeAppManager(userId, assignmentId),
    onSuccess: () => {
      toast({ title: 'App Manager assignment removed' });
      queryClient.invalidateQueries({ queryKey: ['appTeam', selectedAppId] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove manager',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { data: filterApplicationsData } = useQuery({
    queryKey: ["applications-filter"],
    queryFn: async () => {
      try {
        const response = await applicationService.getApplications();
        return response?.data || [];
      } catch (error) {
        console.error("Failed to fetch applications for filter:", error);
        return [];
      }
    },
  });

  const { data: filterResourcesData } = useQuery({
    queryKey: ["resources-filter"],
    queryFn: async () => {
      try {
        const response = await userService.getAllAssignments({ limit: 100 });
        const assignments = response?.data || [];
        const resourcesMap = new Map();
        assignments.forEach((a) => {
          if (a.resource && a.resource._id)
            resourcesMap.set(a.resource._id, a.resource);
        });
        return Array.from(resourcesMap.values());
      } catch (error) {
        console.error("Failed to fetch resources for filter:", error);
        return [];
      }
    },
    enabled: isHubOwner,
  });

  const filterApplications = filterApplicationsData || [];
  const filterResources = filterResourcesData || [];

  const {
    data: assignmentsData,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: [
      "assignments",
      currentPage,
      itemsPerPage,
      searchTerm,
      applicationFilter,
      resourceFilter,
      statusFilter,
      sortBy,
    ],
    enabled: isHubOwner,
    queryFn: async ({ signal }) => {
      const response = await userService.getAllAssignments({
        page: 1,
        limit: 100,
        signal,
      });
      let filteredData = response?.data || [];
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = filteredData.filter((a) => {
          const userName = [a.user?.firstName, a.user?.lastName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          const email = a.user?.email?.toLowerCase() || "";
          const appName = a.application?.name?.toLowerCase() || "";
          return (
            userName.includes(term) ||
            email.includes(term) ||
            appName.includes(term)
          );
        });
      }
      if (applicationFilter && applicationFilter !== "all") {
        filteredData = filteredData.filter(
          (a) =>
            (a.application?._id || a.application?.id) === applicationFilter
        );
      }
      if (resourceFilter && resourceFilter !== "all") {
        if (resourceFilter === "app-wide") {
          filteredData = filteredData.filter((a) => !a.resource);
        } else {
          filteredData = filteredData.filter(
            (a) =>
              (a.resource?._id || a.resource?.id) === resourceFilter
          );
        }
      }
      if (statusFilter && statusFilter !== "all") {
        filteredData = filteredData.filter((a) => {
          const status = computeStatus(a);
          return status.variant === statusFilter;
        });
      }
      filteredData.sort((a, b) => {
        switch (sortBy) {
          case "userName":
            const nameA =
              [a.user?.firstName, a.user?.lastName].filter(Boolean).join(" ") ||
              a.user?.email ||
              "";
            const nameB =
              [b.user?.firstName, b.user?.lastName].filter(Boolean).join(" ") ||
              b.user?.email ||
              "";
            return nameA.localeCompare(nameB);
          case "application":
            return (
              (a.application?.name || "").localeCompare(
                b.application?.name || ""
              )
            );
          case "createdAt":
          default:
            return new Date(b.createdAt) - new Date(a.createdAt);
        }
      });
      const total = filteredData.length;
      const pages = Math.ceil(total / itemsPerPage);
      const startIdx = (currentPage - 1) * itemsPerPage;
      const paginatedData = filteredData.slice(
        startIdx,
        startIdx + itemsPerPage
      );
      return {
        assignments: paginatedData.map((a) => ({
          ...a,
          userName:
            [a.user?.firstName, a.user?.lastName].filter(Boolean).join(" ") ||
            a.user?.email ||
            "—",
          resourceName:
            a.resource?.name || a.resource?.resourceExternalId || "App-wide",
          approver: a.assignedBy?.email || "—",
          startDate: formatDate(a.validFrom || a.createdAt),
          endDate: formatDate(a.validUntil),
          status: computeStatus(a),
        })),
        pagination: {
          page: currentPage,
          limit: itemsPerPage,
          total,
          pages,
        },
      };
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    applicationFilter,
    resourceFilter,
    statusFilter,
    sortBy,
    itemsPerPage,
  ]);

  const assignments = assignmentsData?.assignments || [];
  const pagination = assignmentsData?.pagination || {
    page: 1,
    limit: itemsPerPage,
    total: 0,
    pages: 0,
  };

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await userService.getUsers({ limit: 100 });
      return response?.data || [];
    },
    enabled: showAssignDialog,
  });

  const { data: applicationsData } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const response = await applicationService.getApplications();
      return response?.data || [];
    },
    enabled: showAssignDialog,
  });

  const users = usersData || [];
  const applications = applicationsData || [];

  // Use appCode for API calls when available - backend accepts both _id and appCode
  const selectedAppIdentifier = (() => {
    if (!selectedApplicationId) return null;
    const app = applications.find(
      (a) => (a._id || a.id) === selectedApplicationId || a.appCode === selectedApplicationId
    );
    return app?.appCode || selectedApplicationId;
  })();

  const { data: rolesData } = useQuery({
    queryKey: ["roles", selectedAppIdentifier],
    queryFn: async () => {
      if (!selectedAppIdentifier) return [];
      try {
        const response = await roleService.getRolesByApplication(
          selectedAppIdentifier
        );
        return response?.data ?? [];
      } catch (error) {
        console.error("Failed to fetch roles for application:", error);
        toast({
          title: "Error loading roles",
          description: error?.message || "Could not load roles for this application",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: showAssignDialog && !!selectedAppIdentifier,
  });

  const { data: resourcesData } = useQuery({
    queryKey: ["resources", selectedAppIdentifier],
    queryFn: async () => {
      if (!selectedAppIdentifier) return [];
      try {
        const response = await resourceService.getResourcesByApplication(
          selectedAppIdentifier
        );
        return response?.data ?? [];
      } catch (error) {
        console.warn("Failed to fetch resources:", error);
        toast({
          title: "Error loading resources",
          description: error?.message || "Could not load resources for this application",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: showAssignDialog && !!selectedAppIdentifier,
  });
  const roles = rolesData || [];
  const resources = resourcesData || [];

  useEffect(() => {
    if (selectedApplicationId) {
      setSelectedRoleId("");
      setSelectedResourceId("app-wide");
    }
  }, [selectedApplicationId]);

  const createAssignmentMutation = useMutation({
    mutationFn: async (assignmentData) => {
      return await userService.assignUserToApplication(
        selectedUserId,
        assignmentData
      );
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Assignment created successfully" });
      setShowAssignDialog(false);
      setSelectedUserId("");
      setSelectedApplicationId("");
      setSelectedRoleId("");
      setSelectedResourceId("app-wide");
      setValidFrom("");
      setValidUntil("");
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment",
        variant: "destructive",
      });
    },
  });

  const handleCreateAssignment = () => {
    if (!selectedUserId || !selectedApplicationId || !selectedRoleId) {
      toast({
        title: "Validation Error",
        description: "Please select user, application, and role",
        variant: "destructive",
      });
      return;
    }
    const assignmentData = {
      applicationId: selectedApplicationId,
      roleId: selectedRoleId,
    };
    if (selectedResourceId && selectedResourceId !== "app-wide") {
      assignmentData.resourceId = selectedResourceId;
    }
    if (validFrom)
      assignmentData.validFrom = new Date(validFrom).toISOString();
    if (validUntil)
      assignmentData.validUntil = new Date(validUntil).toISOString();
    createAssignmentMutation.mutate(assignmentData);
  };

  const getUserName = (u) => {
    if (u.firstName || u.lastName)
      return `${u.firstName || ""} ${u.lastName || ""}`.trim();
    return u.email || "Unknown User";
  };

  if (!isHubOwner && !isAppOwner) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const pageTitle = isHubOwner ? 'Users' : 'App Team';
  const pageSubtitle = isHubOwner
    ? 'Manage user accounts and platform assignments'
    : 'View and manage your application team members and their roles';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {pageTitle}
          </h2>
          <p className="text-gray-600">
            {pageSubtitle}
          </p>
        </div>
        {isHubOwner && (
          <Button onClick={() => setShowAssignDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Assignment
          </Button>
        )}
      </div>

      {isAppOwner && appDetails.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Application:
          </label>
          <select
            value={selectedAppId ?? ''}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="">Select application...</option>
            {appDetails.map((app) => (
              <option
                key={app._id ?? app.id}
                value={app._id ?? app.id}
              >
                {app.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isAppOwner && appDetails.length === 1 && (
        <div className="mb-4">
          <span className="text-sm text-gray-500">Application: </span>
          <span className="text-sm font-semibold text-gray-800">
            {appDetails[0]?.name}
          </span>
        </div>
      )}

      {/* ── App Owner: Search bar ── */}
      {isAppOwner && selectedAppId && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search team members by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* ── Hub Owner: Filter bar ── */}
      {isHubOwner && (
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="space-y-4">
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
                  {applicationFilter === "all"
                    ? "All Applications"
                    : filterApplications.find(
                        (app) => (app._id || app.id) === applicationFilter
                      )?.name || "All Applications"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Applications</SelectItem>
                {filterApplications.map((app) => (
                  <SelectItem
                    key={app._id || app.id}
                    value={app._id || app.id}
                  >
                    {app.name} ({app.appCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue>
                  {statusFilter === "all"
                    ? "All Statuses"
                    : statusFilter.charAt(0).toUpperCase() +
                      statusFilter.slice(1)}
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
                  {resourceFilter === "all"
                    ? "All Resources"
                    : resourceFilter === "app-wide"
                    ? "App-wide Only"
                    : filterResources.find(
                        (res) => (res._id || res.id) === resourceFilter
                      )?.name || "All Resources"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="app-wide">App-wide Only</SelectItem>
                {filterResources.map((resource) => (
                  <SelectItem
                    key={resource._id || resource.id}
                    value={resource._id || resource.id}
                  >
                    {resource.name ||
                      resource.resourceExternalId ||
                      "Unknown Resource"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show:</span>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(v) => setItemsPerPage(Number(v))}
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
                <RefreshCw
                  className={`w-4 h-4 ${assignmentsLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
            <div className="text-sm text-gray-600">
              Showing{" "}
              {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
              -
              {Math.min(
                pagination.page * pagination.limit,
                pagination.total
              )}{" "}
              of {pagination.total} assignments
            </div>
          </div>
        </div>
      </div>
      )}

      {isHubOwner && assignmentsError && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3">
          {assignmentsError?.message || "Failed to load assignments"}
        </div>
      )}

      {isHubOwner && (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Application
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Resource
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Approved By
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Start date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  End date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Status
                </th>
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
                assignments.map((a) => (
                  <AssignmentRow key={a._id} assignment={a} />
                ))
              )}
            </tbody>
          </table>
        </div>
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
              {Array.from(
                { length: Math.min(pagination.pages, 5) },
                (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={
                        pagination.page === pageNum ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={assignmentsLoading}
                      className={
                        pagination.page === pageNum
                          ? "bg-purple-600 hover:bg-purple-700"
                          : ""
                      }
                    >
                      {pageNum}
                    </Button>
                  );
                }
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.pages, p + 1))
                }
                disabled={
                  pagination.page === pagination.pages || assignmentsLoading
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── App Owner: Team Users View ── */}
      {isAppOwner && selectedAppId && (
        <div className="bg-white rounded-xl shadow-sm border">
          {appTeamLoading ? (
            <div className="px-4 py-6 text-center text-gray-500">
              Loading team members...
            </div>
          ) : appTeamUsers.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500">
              No team members found for this application
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {appTeamUsers.map((entry) => {
                const u = entry.user;
                const managerAssignments = entry.assignments.filter(
                  (a) => a.role?.roleCode === 'APP_MANAGER'
                );
                const nonManagerAssignments = entry.assignments.filter(
                  (a) => a.role?.roleCode !== 'APP_MANAGER'
                );
                const userName = [u.firstName, u.lastName]
                  .filter(Boolean)
                  .join(' ') || u.email || '—';

                return (
                  <div key={u._id} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900">{userName}</span>
                        <span className="text-sm text-gray-500 ml-2">{u.email}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAssignManagerTarget(entry)}
                      >
                        <Shield className="w-3.5 h-3.5 mr-1.5" />
                        Assign as Manager
                      </Button>
                    </div>

                    {nonManagerAssignments.length > 0 && (
                      <div className="mb-2">
                        <div className="flex flex-wrap gap-1.5">
                          {nonManagerAssignments.map((a) => (
                            <Badge
                              key={a._id}
                              variant="outline"
                              className="text-xs"
                            >
                              {a.role?.name || a.role?.roleCode || 'Role'}
                              {a.resource ? ` — ${a.resource.name || a.resource.resourceExternalId}` : ''}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {managerAssignments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {managerAssignments.map((a) => (
                          <div
                            key={a._id}
                            className="flex items-center justify-between bg-purple-50 rounded px-3 py-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs hover:bg-purple-100">
                                App Manager
                              </Badge>
                              <span className="text-sm text-gray-700">
                                {a.resource?.name || a.resource?.resourceExternalId || 'Global'}
                                {a.resource?.level ? ` (L${a.resource.level})` : ''}
                              </span>
                              <span className="text-xs text-gray-400">
                                expires {a.validUntil ? new Date(a.validUntil).toLocaleDateString() : '—'}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                              disabled={removeManagerMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Remove App Manager assignment for ${a.resource?.name || 'this resource'}?`)) {
                                  removeManagerMutation.mutate({
                                    userId: u._id,
                                    assignmentId: a._id,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isAppOwner && !selectedAppId && appDetails.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border px-4 py-8 text-center text-gray-500">
          Select an application above to view team members
        </div>
      )}

      {/* ── Assign Manager Modal ── */}
      {assignManagerTarget && (
        <AssignManagerModal
          open={!!assignManagerTarget}
          onOpenChange={(open) => { if (!open) setAssignManagerTarget(null); }}
          user={assignManagerTarget.user}
          applicationId={selectedAppId}
          existingManagerResourceIds={
            assignManagerTarget.assignments
              .filter((a) => a.role?.roleCode === 'APP_MANAGER')
              .map((a) => a.resource?._id ?? a.resource?.id)
              .filter(Boolean)
          }
          onSuccess={() => setAssignManagerTarget(null)}
        />
      )}

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
                  {users.map((u) => (
                    <SelectItem key={u._id || u.id} value={u._id || u.id}>
                      {getUserName(u)} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Application *
              </label>
              <Select
                value={selectedApplicationId}
                onValueChange={setSelectedApplicationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an application" />
                </SelectTrigger>
                <SelectContent>
                  {applications.map((app) => (
                    <SelectItem
                      key={app._id || app.id}
                      value={app._id || app.id}
                    >
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
                  <SelectValue
                    placeholder={
                      selectedApplicationId
                        ? "Select a role"
                        : "Select application first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem
                      key={role._id || role.id}
                      value={role._id || role.id}
                    >
                      {role.name} ({role.roleCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Resource (Optional)
              </label>
              <Select
                value={selectedResourceId}
                onValueChange={setSelectedResourceId}
                disabled={!selectedApplicationId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedApplicationId
                        ? "App-wide (no resource)"
                        : "Select application first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="app-wide">App-wide (no resource)</SelectItem>
                  {resources.map((res) => (
                    <SelectItem
                      key={res._id || res.id}
                      value={res._id || res.id}
                    >
                      {res.name || res.resourceExternalId || "Unknown Resource"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Valid From (Optional)
                </label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Valid Until (Optional)
                </label>
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
                  setSelectedUserId("");
                  setSelectedApplicationId("");
                  setSelectedRoleId("");
                  setSelectedResourceId("app-wide");
                  setValidFrom("");
                  setValidUntil("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAssignment}
                disabled={createAssignmentMutation.isPending}
              >
                {createAssignmentMutation.isPending
                  ? "Creating..."
                  : "Create Assignment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
