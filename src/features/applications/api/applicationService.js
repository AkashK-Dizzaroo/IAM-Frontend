import apiClient from "@/lib/apiClient";

class ApplicationService {
  async getApplications() {
    try {
      const response = await apiClient.get("/applications");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getApplicationById(id) {
    try {
      const response = await apiClient.get(`/applications/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
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
        data: safeData,
      };
    }
    if (error.request) {
      return {
        message: "Network error. Please check your connection.",
        status: 0,
      };
    }
    return {
      message: error.message || "An unexpected error occurred",
      status: 0,
    };
  }
}

export const applicationService = new ApplicationService();
