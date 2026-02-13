import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { roleService } from "../api/roleService";
import { permissionService } from "../api/permissionService";
import {
  Shield,
  Key,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const RolesPermissionsView = () => {
  const { toast } = useToast();
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleSearchTerm, setRoleSearchTerm] = useState("");
  const [roleApplicationFilter, setRoleApplicationFilter] = useState("all");
  const [roleLevelFilter, setRoleLevelFilter] = useState("all");
  const [roleCurrentPage, setRoleCurrentPage] = useState(1);
  const [rolePagination, setRolePagination] = useState({ total: 0, pages: 0 });
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionSearchTerm, setPermissionSearchTerm] = useState("");
  const [permissionCategoryFilter, setPermissionCategoryFilter] = useState("all");
  const [permissionCurrentPage, setPermissionCurrentPage] = useState(1);
  const [permissionPagination, setPermissionPagination] = useState({
    total: 0,
    pages: 0,
  });
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState("roles");

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const response = await roleService.getRoles({
        page: roleCurrentPage,
        limit: 25,
        search: roleSearchTerm || undefined,
        application:
          roleApplicationFilter !== "all" ? roleApplicationFilter : undefined,
        level: roleLevelFilter !== "all" ? roleLevelFilter : undefined,
      });
      if (response.success) {
        setRoles(response.data || []);
        setRolePagination(response.pagination || { total: 0, pages: 0 });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch roles",
        variant: "destructive",
      });
    } finally {
      setRolesLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      setPermissionsLoading(true);
      const response = await permissionService.getPermissions({
        page: permissionCurrentPage,
        limit: 25,
        search: permissionSearchTerm || undefined,
        category:
          permissionCategoryFilter !== "all"
            ? permissionCategoryFilter
            : undefined,
      });
      if (response.success) {
        setPermissions(response.data || []);
        setPermissionPagination(response.pagination || {
          total: 0,
          pages: 0,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch permissions",
        variant: "destructive",
      });
    } finally {
      setPermissionsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await permissionService.getPermissionCategories();
      if (response.success) setCategories(response.data || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "roles") fetchRoles();
    else fetchPermissions();
  }, [
    activeTab,
    roleCurrentPage,
    roleSearchTerm,
    roleApplicationFilter,
    roleLevelFilter,
    permissionCurrentPage,
    permissionSearchTerm,
    permissionCategoryFilter,
  ]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const getStatusBadge = (isActive) => {
    if (isActive)
      return (
        <Badge className="bg-green-100 text-green-800">Active</Badge>
      );
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-800">
        Inactive
      </Badge>
    );
  };

  const formatPermissionName = (name) =>
    (name || "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());

  const getCategoryDisplayName = (category) =>
    (category || "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Roles & Permissions</h2>
        <p className="text-gray-600">Configure roles and permission sets</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="roles">
            <Shield className="w-4 h-4 mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Key className="w-4 h-4 mr-2" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search roles..."
                    value={roleSearchTerm}
                    onChange={(e) => {
                      setRoleSearchTerm(e.target.value);
                      setRoleCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={roleLevelFilter}
                  onValueChange={(v) => {
                    setRoleLevelFilter(v);
                    setRoleCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="SYSTEM">System</SelectItem>
                    <SelectItem value="APPLICATION">Application</SelectItem>
                    <SelectItem value="STUDY">Study</SelectItem>
                    <SelectItem value="FACILITY">Facility</SelectItem>
                    <SelectItem value="SITE">Site</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={fetchRoles}
                  disabled={rolesLoading}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${rolesLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {rolesLoading && roles.length === 0 ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Loading roles...</p>
                </div>
              ) : roles.length === 0 ? (
                <div className="p-12 text-center">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No roles found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Level
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Permissions
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {roles.map((role) => (
                          <tr
                            key={role._id || role.id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-4 py-3">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {role.displayName || role.name}
                                </div>
                                {role.description && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {role.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline">
                                {role.level || "N/A"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">
                                {role.permissions?.length || 0} permission
                                {role.permissions?.length !== 1 ? "s" : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(role.isActive !== false)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rolePagination.pages > 1 && (
                    <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {(roleCurrentPage - 1) * 25 + 1} to{" "}
                        {Math.min(
                          roleCurrentPage * 25,
                          rolePagination.total
                        )}{" "}
                        of {rolePagination.total} roles
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRoleCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={roleCurrentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <div className="text-sm text-gray-600">
                          Page {roleCurrentPage} of {rolePagination.pages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRoleCurrentPage((p) =>
                              Math.min(rolePagination.pages, p + 1)
                            )
                          }
                          disabled={
                            roleCurrentPage === rolePagination.pages
                          }
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
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          {categories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Permission Categories</CardTitle>
                <CardDescription>
                  Click a category to filter permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      permissionCategoryFilter === "all" ? "default" : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => setPermissionCategoryFilter("all")}
                  >
                    All (
                    {permissions.reduce(
                      (sum, cat) => sum + (cat.count || 0),
                      0
                    )}
                    )
                  </Badge>
                  {categories.map((cat) => {
                    const categoryName = cat._id || cat.category || cat;
                    return (
                      <Badge
                        key={categoryName}
                        variant={
                          permissionCategoryFilter === categoryName
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => {
                          setPermissionCategoryFilter(categoryName);
                          setPermissionCurrentPage(1);
                        }}
                      >
                        {getCategoryDisplayName(categoryName)} ({cat.count || 0}
                        )
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search permissions..."
                    value={permissionSearchTerm}
                    onChange={(e) => {
                      setPermissionSearchTerm(e.target.value);
                      setPermissionCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={fetchPermissions}
                  disabled={permissionsLoading}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${
                      permissionsLoading ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {permissionsLoading && permissions.length === 0 ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Loading permissions...</p>
                </div>
              ) : permissions.length === 0 ? (
                <div className="p-12 text-center">
                  <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No permissions found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Permission
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Level
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {permissions.map((permission) => (
                          <tr
                            key={permission._id || permission.id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-4 py-3">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {permission.displayName ||
                                    formatPermissionName(permission.name)}
                                </div>
                                {permission.description && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {permission.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline">
                                {getCategoryDisplayName(permission.category)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline">
                                {permission.level || "N/A"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(permission.isActive !== false)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {permissionPagination.pages > 1 && (
                    <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing{" "}
                        {(permissionCurrentPage - 1) * 25 + 1} to{" "}
                        {Math.min(
                          permissionCurrentPage * 25,
                          permissionPagination.total
                        )}{" "}
                        of {permissionPagination.total} permissions
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPermissionCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={permissionCurrentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <div className="text-sm text-gray-600">
                          Page {permissionCurrentPage} of{" "}
                          {permissionPagination.pages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPermissionCurrentPage((p) =>
                              Math.min(permissionPagination.pages, p + 1)
                            )
                          }
                          disabled={
                            permissionCurrentPage ===
                            permissionPagination.pages
                          }
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
