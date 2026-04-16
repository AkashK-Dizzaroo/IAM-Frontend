import apiClient from "@/lib/apiClient";

class ResourceService {
  async getResources(params = {}) {
    try {
      const response = await apiClient.get("/resources", { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getResourcesByApplication(applicationId, params = {}) {
    try {
      const response = await apiClient.get(`/resources/application/${applicationId}`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createResource(payload) {
    try {
      const response = await apiClient.post("/resources", payload);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateResource(id, payload) {
    try {
      const response = await apiClient.patch(`/resources/${id}`, payload);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteResource(id) {
    try {
      const response = await apiClient.delete(`/resources/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addApplicationToResource(id, applicationId) {
    try {
      const response = await apiClient.patch(
        `/resources/${id}/add-application`,
        { applicationId }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async listAttributeDefinitions() {
    try {
      const response = await apiClient.get('/resources/attribute-definitions');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getResourceAttributes(resourceId) {
    try {
      const response = await apiClient.get(`/resources/${resourceId}/attributes`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async upsertResourceAttributes(resourceId, entries) {
    try {
      const response = await apiClient.post(`/resources/${resourceId}/attributes`, entries);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async setClassification(resourceId, applicationId, classificationId) {
    try {
      const response = await apiClient.patch(
        `/resources/${resourceId}/classification`,
        { applicationId, classificationId: classificationId || null }
      );
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

export const resourceService = new ResourceService();
