import apiClient from "@/lib/apiClient";

class PermissionService {
  async getPermissions(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.page) params.append("page", options.page);
      if (options.limit) params.append("limit", options.limit);
      if (options.search) params.append("search", options.search);
      if (options.category) params.append("category", options.category);
      if (options.application) params.append("application", options.application);
      if (options.level) params.append("level", options.level);
      if (options.isActive !== undefined) params.append("isActive", options.isActive);
      if (options.isSystem !== undefined) params.append("isSystem", options.isSystem);

      const response = await apiClient.get(`/permissions?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPermissionById(id) {
    try {
      const response = await apiClient.get(`/permissions/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createPermission(permissionData) {
    try {
      const response = await apiClient.post("/permissions", permissionData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updatePermission(id, updateData) {
    try {
      const response = await apiClient.patch(`/permissions/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deletePermission(id) {
    try {
      const response = await apiClient.delete(`/permissions/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPermissionsByCategory(category) {
    try {
      const response = await apiClient.get(`/permissions/category/${category}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPermissionsByApplication(application) {
    try {
      const response = await apiClient.get(`/permissions/application/${application}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSystemPermissions() {
    try {
      const response = await apiClient.get("/permissions/system/all");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPermissionCategories() {
    try {
      const response = await apiClient.get("/permissions/categories/all");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPermissionStats(application) {
    try {
      const params = application ? `?application=${application}` : "";
      const response = await apiClient.get(`/permissions/stats/overview${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async bulkCreatePermissions(permissions) {
    try {
      const response = await apiClient.post("/permissions/bulk/create", {
        permissions,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      return {
        message:
          error.response.data?.error ||
          error.response.data?.message ||
          "An error occurred",
        status: error.response.status,
        details: error.response.data,
      };
    }
    if (error.request) {
      return {
        message: "Network error - please check your connection",
        status: 0,
        details: null,
      };
    }
    return {
      message: error.message || "An unexpected error occurred",
      status: 0,
      details: null,
    };
  }
}

export const permissionService = new PermissionService();
