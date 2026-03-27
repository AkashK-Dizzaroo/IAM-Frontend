import apiClient from "@/lib/apiClient";

class UserService {
  async getUsers(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.page) params.append("page", options.page);
      if (options.limit) params.append("limit", options.limit);
      if (options.search) params.append("search", options.search);
      if (options.appId) params.append("appId", options.appId);
      if (options.status) params.append("status", options.status);
      if (options.organization) params.append("organization", options.organization);

      const response = await apiClient.get(`/users?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAllAssignments(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.page) params.append("page", options.page);
      const safeLimit = options.limit ? Math.min(options.limit, 100) : 25;
      params.append("limit", safeLimit);
      if (options.includeInactive !== undefined)
        params.append("includeInactive", options.includeInactive);

      const config = {};
      if (options.signal) config.signal = options.signal;

      const response = await apiClient.get(`/users/assignments?${params}`, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserById(id) {
    try {
      const response = await apiClient.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserAssignments(userId, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.appCode) params.append("appCode", options.appCode);
      if (options.applicationId) params.append("applicationId", options.applicationId);

      const response = await apiClient.get(`/users/${userId}/assignments?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async assignUserToApplication(userId, assignmentData) {
    try {
      const response = await apiClient.post(`/users/${userId}/assignments`, assignmentData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUserAssignment(userId, assignmentId, updateData) {
    try {
      const response = await apiClient.patch(
        `/users/${userId}/assignments/${assignmentId}`,
        updateData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async removeUserAssignment(userId, assignmentId) {
    try {
      const response = await apiClient.delete(`/users/${userId}/assignments/${assignmentId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createUser(userData) {
    try {
      const nameParts = (userData.name || "").trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || firstName;
      const tempPassword = userData.password || this.generateTempPassword();
      const applications = (userData.selectedApplications || []).map((app) => ({
        appId: app.appId || app.id || app.code,
        isActive: app.isActive !== undefined ? app.isActive : true,
      }));
      let normalizedStatus = userData.status;
      if (normalizedStatus) normalizedStatus = normalizedStatus.toUpperCase();

      const payload = {
        email: userData.email,
        password: tempPassword,
        firstName,
        lastName,
        phone: userData.phone,
        phoneNumber: userData.phone || userData.phoneNumber,
        organization: userData.organization,
        address: userData.address,
        department: userData.department,
        status: normalizedStatus,
        applications: applications.length > 0 ? applications : undefined,
      };

      Object.keys(payload).forEach(
        (key) => payload[key] === undefined && delete payload[key]
      );

      const response = await apiClient.post("/users", payload);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUser(id, updateData) {
    try {
      if (updateData.name) {
        const nameParts = updateData.name.trim().split(" ");
        updateData.firstName = nameParts[0] || "";
        updateData.lastName = nameParts.slice(1).join(" ") || updateData.firstName;
        delete updateData.name;
      }
      if (updateData.status) updateData.status = updateData.status.toUpperCase();
      if (updateData.selectedApplications) {
        updateData.applications = updateData.selectedApplications.map((app) => ({
          appId: app.appId || app.id || app.code,
          isActive: app.isActive !== undefined ? app.isActive : true,
        }));
        delete updateData.selectedApplications;
      }

      const response = await apiClient.patch(`/users/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteUser(id) {
    try {
      const response = await apiClient.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserStats(appId) {
    try {
      const params = appId ? `?appId=${appId}` : "";
      const response = await apiClient.get(`/users/stats/overview${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async approveUserAccount(userId) {
    try {
      const response = await apiClient.patch(`/users/${userId}/approve-account`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async rejectUserAccount(userId, rejectionReason) {
    try {
      const response = await apiClient.patch(`/users/${userId}/reject-account`, {
        rejectionReason: rejectionReason || "",
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAppTeamUsers(applicationId, search = '') {
    try {
      const params = new URLSearchParams({ applicationId });
      if (search) params.set('search', search);
      const response = await apiClient.get(`/users/app-team?${params.toString()}`);
      return response.data ?? response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async assignAppManager(userId, applicationId, resourceId) {
    try {
      const response = await apiClient.post(`/users/${userId}/assign-manager`, {
        applicationId,
        resourceId
      });
      return response.data ?? response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async removeAppManager(userId, assignmentId) {
    try {
      const response = await apiClient.delete(
        `/users/${userId}/assignments/${assignmentId}/manager`
      );
      return response.data ?? response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  generateTempPassword() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  handleError(error) {
    if (error.response) {
      const safeData = {
        error: error.response.data?.error,
        message: error.response.data?.message,
        statusCode: error.response.data?.statusCode,
      };
      return {
        message: safeData.error || safeData.message || "An error occurred",
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

export const userService = new UserService();
