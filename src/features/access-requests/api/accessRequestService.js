import apiClient from "@/lib/apiClient";
import { generateObjectId } from "@/lib/utils";

class AccessRequestService {
  constructor() {
    this.api = apiClient;
  }

  async createAccessRequest(requestData) {
    try {
      const currentUser = this.getCurrentUserInfo();
      const requestPayload = {
        ...requestData,
        requesterId: currentUser.id || generateObjectId(),
        requesterEmail: currentUser.email || "demo@neurodoc.com",
        requesterName:
          currentUser.name ||
          requestData.metadata?.requesterName ||
          "Demo User",
      };
      const response = await this.api.post("/access-requests", requestPayload);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserAccessRequests(userId, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.status) params.append("status", options.status);
      if (options.application) params.append("application", options.application);
      if (options.limit) params.append("limit", options.limit);
      if (options.page) params.append("page", options.page);
      const response = await this.api.get(
        `/access-requests/user/${userId}?${params}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAllAccessRequests(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.status) params.append("status", options.status);
      if (options.application) params.append("application", options.application);
      if (options.requesterId) params.append("requesterId", options.requesterId);
      if (options.limit) params.append("limit", options.limit);
      if (options.page) params.append("page", options.page);
      const response = await this.api.get(`/access-requests?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAccessRequestById(id) {
    try {
      const response = await this.api.get(`/access-requests/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateAccessRequest(id, updateData) {
    try {
      const response = await this.api.put(`/access-requests/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async approveAccessRequest(id, reviewerComments = "") {
    try {
      const response = await this.api.patch(`/access-requests/${id}/approve`, {
        reviewerComments,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async rejectAccessRequest(id, reviewerComments = "") {
    try {
      const response = await this.api.patch(`/access-requests/${id}/reject`, {
        reviewerComments,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async cancelAccessRequest(id) {
    try {
      const response = await this.api.patch(`/access-requests/${id}/cancel`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteAccessRequest(id) {
    try {
      const response = await this.api.delete(`/access-requests/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAccessRequestStats() {
    try {
      const response = await this.api.get("/access-requests/stats");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      return {
        message:
          error.response.data?.message || "An error occurred",
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

  getCurrentUserId() {
    const user = JSON.parse(localStorage.getItem("platform_user") || "{}");
    return user.id || user._id;
  }

  getCurrentUserInfo() {
    const user = JSON.parse(localStorage.getItem("platform_user") || "{}");
    return {
      id: user.id || user._id,
      email: user.email,
      name:
        user.name ||
        user.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      department: user.department,
      role: user.role || user.jobTitle,
    };
  }

  async getCurrentUser() {
    const user = this.getCurrentUserInfo();
    if (!user.id) throw new Error("No user session found");
    return user;
  }
}

export const accessRequestService = new AccessRequestService();
