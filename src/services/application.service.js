import api from './api';

class ApplicationService {
  // Get all applications
  async getApplications() {
    try {
      const response = await api.get('/applications');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get application by ID
  async getApplicationById(id) {
    try {
      const response = await api.get(`/applications/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Helper method to handle errors
  handleError(error) {
    if (error.response) {
      const safeData = {
        error: error.response.data?.error,
        message: error.response.data?.message,
        statusCode: error.response.data?.statusCode
      };

      return {
        message: safeData.error || safeData.message || 'An error occurred',
        status: error.response.status,
        data: safeData
      };
    } else if (error.request) {
      return {
        message: 'Network error. Please check your connection.',
        status: 0
      };
    } else {
      return {
        message: error.message || 'An unexpected error occurred',
        status: 0
      };
    }
  }
}

export default new ApplicationService();










