import api from './api';

class PermissionService {
  // Get all permissions with pagination and filtering
  async getPermissions(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.page) params.append('page', options.page);
      if (options.limit) params.append('limit', options.limit);
      if (options.search) params.append('search', options.search);
      if (options.category) params.append('category', options.category);
      if (options.application) params.append('application', options.application);
      if (options.level) params.append('level', options.level);
      if (options.isActive !== undefined) params.append('isActive', options.isActive);
      if (options.isSystem !== undefined) params.append('isSystem', options.isSystem);

      const response = await api.get(`/permissions?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get permission by ID
  async getPermissionById(id) {
    try {
      const response = await api.get(`/permissions/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Create new permission
  async createPermission(permissionData) {
    try {
      const response = await api.post('/permissions', permissionData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update permission
  async updatePermission(id, updateData) {
    try {
      const response = await api.patch(`/permissions/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Delete permission (soft delete)
  async deletePermission(id) {
    try {
      const response = await api.delete(`/permissions/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get permissions by category
  async getPermissionsByCategory(category) {
    try {
      const response = await api.get(`/permissions/category/${category}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get permissions by application
  async getPermissionsByApplication(application) {
    try {
      const response = await api.get(`/permissions/application/${application}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get system permissions
  async getSystemPermissions() {
    try {
      const response = await api.get('/permissions/system/all');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get permission categories
  async getPermissionCategories() {
    try {
      const response = await api.get('/permissions/categories/all');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get permission statistics
  async getPermissionStats(application) {
    try {
      const params = application ? `?application=${application}` : '';
      const response = await api.get(`/permissions/stats/overview${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Bulk create permissions
  async bulkCreatePermissions(permissions) {
    try {
      const response = await api.post('/permissions/bulk/create', { permissions });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Helper method to handle errors
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      return {
        message: error.response.data?.error || error.response.data?.message || 'An error occurred',
        status: error.response.status,
        details: error.response.data
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        message: 'Network error - please check your connection',
        status: 0,
        details: null
      };
    } else {
      // Something else happened
      return {
        message: error.message || 'An unexpected error occurred',
        status: 0,
        details: null
      };
    }
  }
}

// Create and export a singleton instance
const permissionService = new PermissionService();
export default permissionService;

