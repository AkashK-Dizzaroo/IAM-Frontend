import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { userService } from "@/features/users";
import { applicationService } from "../api/applicationService";
import { Globe, Plus, Search, XCircle, RefreshCw, Users } from "lucide-react";

export const ApplicationAccessManagementPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState("");

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      const response = await userService.getUsers({ limit: 100 });
      const users = response.data || [];
      const usersWithAssignments = await Promise.all(
        users.map(async (user) => {
          try {
            const assignmentsResponse = await userService.getUserAssignments(
              user._id || user.id
            );
            return {
              ...user,
              assignments: assignmentsResponse.data || [],
            };
          } catch (error) {
            return { ...user, assignments: [] };
          }
        })
      );
      return usersWithAssignments;
    },
  });

  const { data: applicationsData } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const response = await applicationService.getApplications();
      return response.data || [];
    },
  });

  const users = usersData || [];
  const applications = applicationsData || [];

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.email?.toLowerCase().includes(term) ||
        user.firstName?.toLowerCase().includes(term) ||
        user.lastName?.toLowerCase().includes(term) ||
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const assignMutation = useMutation({
    mutationFn: async ({ userId, applicationId }) => {
      return await userService.assignUserToApplication(userId, {
        appId: applicationId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Application access assigned successfully",
      });
      setShowAssignDialog(false);
      setSelectedUser(null);
      setSelectedApplication("");
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["userAssignments"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign application access",
        variant: "destructive",
      });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ userId, assignmentId }) => {
      return await userService.removeUserAssignment(userId, assignmentId);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Application access removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["userAssignments"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove application access",
        variant: "destructive",
      });
    },
  });

  const handleAssign = () => {
    if (!selectedUser || !selectedApplication) {
      toast({
        title: "Validation Error",
        description: "Please select both user and application",
        variant: "destructive",
      });
      return;
    }
    assignMutation.mutate({
      userId: selectedUser._id || selectedUser.id,
      applicationId: selectedApplication,
    });
  };

  const handleRemoveAssignment = (userId, assignmentId) => {
    if (confirm("Are you sure you want to remove this application access?")) {
      removeAssignmentMutation.mutate({ userId, assignmentId });
    }
  };

  const getUserName = (user) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
    return user.name || user.email || "Unknown User";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Application Access Management
          </h2>
          <p className="text-gray-600">Manage user access to applications</p>
        </div>
        <Button onClick={() => setShowAssignDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Assign Access
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Application Access
            </CardTitle>
            <Badge variant="outline" className="flex items-center gap-1">
              <RefreshCw
                className={`w-3 h-3 ${usersLoading ? "animate-spin" : ""}`}
              />
              {filteredUsers.length} users
            </Badge>
          </div>
          <CardDescription>
            View and manage application assignments for all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    User
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Global Role
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Assignments
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersLoading ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-12 text-center text-gray-500">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                      Loading users and assignments...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-12 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user._id || user.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                            {(
                              user.firstName?.[0] ||
                              user.email?.[0] ||
                              "U"
                            ).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {user.firstName || user.lastName
                                ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                                : user.email}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {user.email}
                            </div>
                            {user.organization && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {user.organization}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge
                          variant={
                            user.globalRole === "ADMIN" ? "default" : "secondary"
                          }
                        >
                          {user.globalRole || "USER"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 align-top">
                        {user.assignments?.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">
                            No applications assigned
                          </span>
                        ) : (
                          <div className="space-y-2 max-w-md">
                            {user.assignments.map((assignment) => (
                              <div
                                key={assignment._id || assignment.id}
                                className="flex flex-col p-2 bg-gray-50 rounded-md border border-gray-100"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-3 h-3 text-indigo-500" />
                                    <span className="font-semibold text-xs text-gray-900">
                                      {assignment.application?.name ||
                                        assignment.application?.appCode ||
                                        "Unknown App"}
                                    </span>
                                    {assignment.application?.appCode && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1 py-0"
                                      >
                                        {assignment.application.appCode}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={
                                        assignment.isActive
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-[9px] px-1.5 py-0 leading-tight h-4"
                                    >
                                      {assignment.isActive
                                        ? "Active"
                                        : "Inactive"}
                                    </Badge>
                                    <button
                                      onClick={() =>
                                        handleRemoveAssignment(
                                          user._id || user.id,
                                          assignment._id || assignment.id
                                        )
                                      }
                                      className="text-gray-400 hover:text-red-600 transition-colors"
                                      title="Remove Access"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-[10px] text-gray-500">
                                  {assignment.assignedAt && (
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium text-gray-400">
                                        Assigned:
                                      </span>
                                      <span>
                                        {new Date(
                                          assignment.assignedAt
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                  {assignment.assignedBy && (
                                    <div
                                      className="flex items-center gap-1 truncate"
                                      title={
                                        typeof assignment.assignedBy === "object"
                                          ? assignment.assignedBy.email
                                          : assignment.assignedBy
                                      }
                                    >
                                      <span className="font-medium text-gray-400">
                                        By:
                                      </span>
                                      <span className="truncate">
                                        {typeof assignment.assignedBy ===
                                        "object"
                                          ? assignment.assignedBy.name ||
                                            assignment.assignedBy.email
                                          : "Admin"}
                                      </span>
                                    </div>
                                  )}
                                  {assignment.resource && (
                                    <div className="flex items-center gap-1 col-span-2">
                                      <span className="font-medium text-gray-400">
                                        Resource:
                                      </span>
                                      <span className="text-indigo-600">
                                        {assignment.resource}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowAssignDialog(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add App
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Application Access</DialogTitle>
            <DialogDescription>
              Select a user and application to grant access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">User</label>
              <Select
                value={selectedUser?._id || selectedUser?.id || ""}
                onValueChange={(value) => {
                  const u = users.find((x) => (x._id || x.id) === value);
                  setSelectedUser(u);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem
                      key={u._id || u.id}
                      value={u._id || u.id}
                    >
                      {getUserName(u)} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Application
              </label>
              <Select
                value={selectedApplication}
                onValueChange={setSelectedApplication}
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
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAssignDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={assignMutation.isPending}
              >
                {assignMutation.isPending ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
