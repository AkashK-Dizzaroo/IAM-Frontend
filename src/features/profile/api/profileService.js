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

  async getUserRolesAndResources(userId) {
    /**
     * "My Access" displays the user's approved access grants.
     *
     * We derive these from APPROVED access requests so the user sees the same
     * application/resource/role approvals that admins action in the workflow.
     */
    if (!userId) return { data: [] };
    try {
      const res = await apiClient.get("/access-requests", {
        params: {
          requesterId: userId,
          status: "approved",
          page: 1,
          limit: 500,
        },
      });
      const body = res.data || {};
      const rows = Array.isArray(body.data) ? body.data : [];

      const assignments = rows.map((r) => {
        const ra = r?.requestedAttributes && typeof r.requestedAttributes === "object"
          ? r.requestedAttributes
          : {};

        const roleCode =
          ra.role ||
          ra.requestedRole ||
          ra.roleCode ||
          ra.requestedRoleCode ||
          null;

        const validUntil = ra.assignUntil || ra.validUntil || null;

        return {
          id: r.id,
          application: r.application || null,
          resource: r.requestedResource || null,
          roleCode,
          assignedBy: r.reviewedBy || null,
          validFrom: r.updatedAt || r.createdAt || null,
          validUntil,
          isActive: String(r.status || "").toLowerCase() === "approved",
          status: r.status,
        };
      });

      return { data: assignments };
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
