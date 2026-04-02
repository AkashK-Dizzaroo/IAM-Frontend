import apiClient from "@/lib/apiClient";

class RoleService {
  async getRoles(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.page) params.append("page", options.page);
      if (options.limit) params.append("limit", options.limit);
      if (options.search) params.append("search", options.search);
      if (options.application) params.append("application", options.application);
      if (options.level) params.append("level", options.level);
      if (options.isActive !== undefined) params.append("isActive", options.isActive);
      if (options.isSystem !== undefined) params.append("isSystem", options.isSystem);

      const response = await apiClient.get(`/roles?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getRoleById(id) {
    try {
      const response = await apiClient.get(`/roles/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createRole(roleData) {
    try {
      const response = await apiClient.post("/roles", roleData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateRole(id, updateData) {
    try {
      const response = await apiClient.patch(`/roles/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteRole(id) {
    try {
      const response = await apiClient.delete(`/roles/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getRolesByApplication(application) {
    try {
      const response = await apiClient.get(`/roles/application/${application}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSystemRoles() {
    try {
      const response = await apiClient.get("/roles/system/all");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async assignPermissionsToRole(roleId, permissionIds) {
    try {
      const response = await apiClient.post(`/roles/${roleId}/permissions`, {
        permissionIds,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getRoleStats(application) {
    try {
      const params = application ? `?application=${application}` : "";
      const response = await apiClient.get(`/roles/stats/overview${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async cloneRole(roleId, cloneData) {
    try {
      const response = await apiClient.post(`/roles/${roleId}/clone`, cloneData);
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

export const roleService = new RoleService();
