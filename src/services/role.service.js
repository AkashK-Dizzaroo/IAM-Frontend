import api from './api';

class RoleService {
  // Get all roles with pagination and filtering
  async getRoles(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.page) params.append('page', options.page);
      if (options.limit) params.append('limit', options.limit);
      if (options.search) params.append('search', options.search);
      if (options.application) params.append('application', options.application);
      if (options.level) params.append('level', options.level);
      if (options.isActive !== undefined) params.append('isActive', options.isActive);
      if (options.isSystem !== undefined) params.append('isSystem', options.isSystem);

      const response = await api.get(`/roles?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get role by ID
  async getRoleById(id) {
    try {
      const response = await api.get(`/roles/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Create new role
  async createRole(roleData) {
    try {
      const response = await api.post('/roles', roleData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update role
  async updateRole(id, updateData) {
    try {
      const response = await api.patch(`/roles/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Delete role (soft delete)
  async deleteRole(id) {
    try {
      const response = await api.delete(`/roles/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get roles by application
  async getRolesByApplication(application) {
    try {
      const response = await api.get(`/roles/application/${application}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get system roles
  async getSystemRoles() {
    try {
      const response = await api.get('/roles/system/all');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Assign permissions to role
  async assignPermissionsToRole(roleId, permissionIds) {
    try {
      const response = await api.post(`/roles/${roleId}/permissions`, {
        permissionIds
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get role statistics
  async getRoleStats(application) {
    try {
      const params = application ? `?application=${application}` : '';
      const response = await api.get(`/roles/stats/overview${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Clone role
  async cloneRole(roleId, cloneData) {
    try {
      const response = await api.post(`/roles/${roleId}/clone`, cloneData);
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
const roleService = new RoleService();
export default roleService;














