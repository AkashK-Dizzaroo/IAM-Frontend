import apiClient from "@/lib/apiClient";

/**
 * Profile service - Me-only endpoints (/users/me/*).
 * For admin user CRUD, use userService from @/features/users.
 */
class ProfileService {
  async getCurrentUserProfile() {
    try {
      const response = await apiClient.get("/users/me/profile");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateCurrentUserProfile(updateData) {
    try {
      const response = await apiClient.patch("/users/me/profile", updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserApplicationAccess() {
    try {
      const response = await apiClient.get("/users/me/applications");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserRolesAndResources() {
    try {
      const response = await apiClient.get("/users/me/assignments");
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

export const profileService = new ProfileService();
