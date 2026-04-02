import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { getDisplayRole } from "@/lib/utils";
import { profileService } from "../api/profileService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Globe,
  Bell,
  MapPin,
  Shield,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const MyProfilePage = () => {
  const { user, effectiveRoles } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    address: "",
  });

  // Profile tab — query key ["userProfile"]
  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const response = await profileService.getCurrentUserProfile();
      return response.data || response;
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => profileService.updateCurrentUserProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      setIsEditing(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // My Access tab — query key ["userAssignments"] (distinct from ["userProfile"])
  const {
    data: assignmentsData,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useQuery({
    queryKey: ["userAssignments"],
    queryFn: async () => {
      const response = await profileService.getUserRolesAndResources();
      return response.data;
    },
    enabled: !!user,
  });

  const handleEdit = () => {
    if (profileData) {
      setFormData({
        firstName: profileData.firstName || "",
        lastName: profileData.lastName || "",
        phoneNumber: profileData.phoneNumber || "",
        address: profileData.address || "",
      });
    }
    setIsEditing(true);
  };

  const handleSave = () => updateMutation.mutate(formData);
  const handleCancel = () => setIsEditing(false);

  const formatDate = (date) => {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "—";
    }
  };

  const profile = profileData || {};
  const assignments = assignmentsData || [];

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
          <p className="text-gray-600 mt-1">
            Manage your profile and view your access assignments
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="my-access">My Access</TabsTrigger>
        </TabsList>
      </div>

      {/* ── Profile tab ─────────────────────────────────────────────────── */}
      <TabsContent value="profile" className="space-y-6">
        {profileLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading profile...</p>
            </div>
          </div>
        ) : profileError ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-red-600 mb-4">Failed to load profile</p>
                  <Button
                    onClick={() =>
                      queryClient.invalidateQueries({
                        queryKey: ["userProfile"],
                      })
                    }
                  >
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>
                      Your account details and contact information
                    </CardDescription>
                  </div>
                  {!isEditing && (
                    <Button onClick={handleEdit} variant="outline">
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phoneNumber: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: e.target.value,
                          })
                        }
                        placeholder="Enter your address"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button onClick={handleCancel} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500">First Name</p>
                          <p className="font-medium text-gray-900">
                            {profile.firstName || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500">Last Name</p>
                          <p className="font-medium text-gray-900">
                            {profile.lastName || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="font-medium text-gray-900 break-words">
                            {profile.email || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500">Phone Number</p>
                          <p className="font-medium text-gray-900">
                            {profile.phoneNumber || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500">Organization</p>
                          <p className="font-medium text-gray-900">
                            {profile.organization || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium text-gray-900 break-words">
                            {profile.address || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Account Information
                </CardTitle>
                <CardDescription>Account status and activity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Platform Role</p>
                    <p className="font-medium text-gray-900">
                      {getDisplayRole(effectiveRoles)}
                    </p>
                    {(effectiveRoles?.isAppOwner || effectiveRoles?.isAppManager) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {effectiveRoles.isAppOwner
                          ? `Owner of ${effectiveRoles.appOwnerOf.length} application(s)`
                          : `Manager of ${effectiveRoles.appManagerOf.length} application(s)`}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Account Status</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {profile.status || "Active"}
                    </p>
                  </div>
                  {profile.lastLogin && (
                    <div>
                      <p className="text-sm text-gray-500">Last Login</p>
                      <p className="font-medium">
                        {new Date(profile.lastLogin).toLocaleDateString()}{" "}
                        {new Date(profile.lastLogin).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                  {profile.createdAt && (
                    <div>
                      <p className="text-sm text-gray-500">Member Since</p>
                      <p className="font-medium">
                        {new Date(profile.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {profile.preferences && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Preferences
                  </CardTitle>
                  <CardDescription>Your account preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {profile.preferences.language && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Language</p>
                          <p className="font-medium">
                            {profile.preferences.language}
                          </p>
                        </div>
                      </div>
                    )}
                    {profile.preferences.timezone && (
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Timezone</p>
                          <p className="font-medium">
                            {profile.preferences.timezone}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </TabsContent>

      {/* ── My Access tab ────────────────────────────────────────────────── */}
      <TabsContent value="my-access" className="space-y-6">
        {assignmentsLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading assignments...</p>
            </div>
          </div>
        ) : assignmentsError ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-red-600 mb-4">Failed to load assignments</p>
                  <p className="text-sm text-gray-500">
                    {assignmentsError.message ||
                      "An error occurred while fetching your assignments"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  You don&apos;t have any assignments yet.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Assignments
                  </CardTitle>
                  <CardDescription>
                    Your application access, roles, and resource assignments
                  </CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <RefreshCw
                    className={`w-3 h-3 ${assignmentsLoading ? "animate-spin" : ""}`}
                  />
                  {assignments.length}{" "}
                  {assignments.length === 1 ? "assignment" : "assignments"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Application
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Resource
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Approved by
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Start date
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        End date
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assignments.map((assignment) => {
                      const isExpired =
                        assignment.validUntil &&
                        new Date(assignment.validUntil) < new Date();
                      const isActive = assignment.isActive && !isExpired;

                      return (
                        <tr
                          key={assignment.id}
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 truncate">
                                  {assignment.application?.name ||
                                    assignment.application?.appCode ||
                                    assignment.appName ||
                                    "Unknown Application"}
                                </div>
                                {assignment.application?.appCode && assignment.application?.name && (
                                  <div className="text-xs text-gray-500 truncate">
                                    {assignment.application.appCode}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {(() => {
                              const resourceName =
                                assignment.resource?.name ||
                                assignment.resourceName ||
                                assignment.resource?.resourceExternalId ||
                                null;
                              return resourceName ? (
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate">
                                    {resourceName}
                                  </div>
                                  {assignment.resource?.level != null && (
                                    <div className="text-xs text-gray-500 truncate">
                                      Level {assignment.resource.level}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">
                                  Global Access
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            {(() => {
                              const roleName =
                                assignment.role?.name ||
                                assignment.roleName ||
                                assignment.role?.roleCode ||
                                assignment.roleCode ||
                                (typeof assignment.role === "string" ? assignment.role : null);
                              return roleName ? (
                                <Badge variant="outline" className="text-xs">
                                  {roleName}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 italic">—</span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            {assignment.assignedBy ? (
                              <div className="min-w-0">
                                <div className="text-gray-900 truncate">
                                  {assignment.assignedBy.name ||
                                    assignment.assignedBy.email ||
                                    "—"}
                                </div>
                                {assignment.assignedBy.name &&
                                  assignment.assignedBy.email && (
                                    <div className="text-xs text-gray-500 truncate">
                                      {assignment.assignedBy.email}
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-gray-700">
                            {formatDate(assignment.validFrom)}
                          </td>
                          <td className="px-4 py-4">
                            {assignment.validUntil ? (
                              <div>
                                <div
                                  className={`${
                                    isExpired
                                      ? "text-red-600 font-medium"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {formatDate(assignment.validUntil)}
                                </div>
                                {isExpired && (
                                  <div className="text-xs text-red-500 mt-1">
                                    Expired
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                No expiration
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              variant={isActive ? "default" : "secondary"}
                              className="flex items-center gap-1 w-fit"
                            >
                              {isActive ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  {isExpired ? "Expired" : "Inactive"}
                                </>
                              )}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
};
