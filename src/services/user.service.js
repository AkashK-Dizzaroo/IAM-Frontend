import api from './api';

class UserService {
  // Get all users with pagination and filtering
  async getUsers(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.page) params.append('page', options.page);
      if (options.limit) params.append('limit', options.limit);
      if (options.search) params.append('search', options.search);
      if (options.appId) params.append('appId', options.appId);
      // role filter removed (roles no longer exist)
      if (options.status) params.append('status', options.status);
      if (options.organization) params.append('organization', options.organization);

      const response = await api.get(`/users?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Admin: get all assignments
  async getAllAssignments(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.page) params.append('page', options.page);
      // API schema caps limit at 100; enforce client-side to avoid 400s
      const safeLimit = options.limit ? Math.min(options.limit, 100) : 25;
      params.append('limit', safeLimit);
      if (options.includeInactive !== undefined) params.append('includeInactive', options.includeInactive);
      
      const config = {};
      if (options.signal) {
        config.signal = options.signal;
      }
      
      const response = await api.get(`/users/assignments?${params}`, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get user by ID
  async getUserById(id) {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get user assignments
  async getUserAssignments(userId, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.appCode) params.append('appCode', options.appCode);
      if (options.applicationId) params.append('applicationId', options.applicationId);
      
      const response = await api.get(`/users/${userId}/assignments?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Assign user to application
  async assignUserToApplication(userId, assignmentData) {
    try {
      const response = await api.post(`/users/${userId}/assignments`, assignmentData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update user assignment
  async updateUserAssignment(userId, assignmentId, updateData) {
    try {
      const response = await api.patch(`/users/${userId}/assignments/${assignmentId}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Remove user assignment
  async removeUserAssignment(userId, assignmentId) {
    try {
      const response = await api.delete(`/users/${userId}/assignments/${assignmentId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Create new user
  async createUser(userData) {
    try {
      // Split name into firstName and lastName
      const nameParts = (userData.name || '').trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || firstName;

      // Generate a temporary password if not provided
      // In production, you might want to send an email with a password reset link
      const tempPassword = userData.password || this.generateTempPassword();

      // Map selectedApplications to backend format
      // Backend expects applications array with appId (which will be converted to appCode internally)
      // Roles and permissions are removed
      const applications = (userData.selectedApplications || []).map(app => ({
        appId: app.appId || app.id || app.code,
        isActive: app.isActive !== undefined ? app.isActive : true
      }));

      // Normalize status to match backend enum (ACTIVE, INACTIVE, SUSPENDED)
      let normalizedStatus = userData.status;
      if (normalizedStatus) {
        normalizedStatus = normalizedStatus.toUpperCase();
      }

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
        applications: applications.length > 0 ? applications : undefined
      };

      // Remove undefined fields
      Object.keys(payload).forEach(key => 
        payload[key] === undefined && delete payload[key]
      );


      const response = await api.post('/users', payload);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update user
  async updateUser(id, updateData) {
    try {
      // If name is provided, split it
      if (updateData.name) {
        const nameParts = updateData.name.trim().split(' ');
        updateData.firstName = nameParts[0] || '';
        updateData.lastName = nameParts.slice(1).join(' ') || updateData.firstName;
        delete updateData.name;
      }

      // Normalize status to match backend enum if provided
      if (updateData.status) {
        updateData.status = updateData.status.toUpperCase();
      }

      // Map selectedApplications if provided
      if (updateData.selectedApplications) {
        // Map to backend format - roles and permissions removed
        updateData.applications = updateData.selectedApplications.map(app => ({
          appId: app.appId || app.id || app.code,
          isActive: app.isActive !== undefined ? app.isActive : true
        }));
        delete updateData.selectedApplications;
      }

      const response = await api.patch(`/users/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Delete user
  async deleteUser(id) {
    try {
      const response = await api.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get user statistics
  async getUserStats(appId) {
    try {
      const params = appId ? `?appId=${appId}` : '';
      const response = await api.get(`/users/stats/overview${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ========== SELF-SERVICE METHODS ==========

  // Get current user's profile
  async getCurrentUserProfile() {
    try {
      const response = await api.get('/users/me/profile');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update current user's profile
  async updateCurrentUserProfile(updateData) {
    try {
      const response = await api.patch('/users/me/profile', updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get current user's application access
  async getUserApplicationAccess() {
    try {
      const response = await api.get('/users/me/applications');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get current user's roles and resources
  async getUserRolesAndResources() {
    try {
      const response = await api.get('/users/me/assignments');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Approve user account
  async approveUserAccount(userId) {
    try {
      const response = await api.patch(`/users/${userId}/approve-account`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Reject user account
  async rejectUserAccount(userId, rejectionReason) {
    try {
      const response = await api.patch(`/users/${userId}/reject-account`, {
        rejectionReason: rejectionReason || ''
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Helper method to generate temporary password
  generateTempPassword() {
    // Generate a random 12-character password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Helper method to handle errors
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const safeData = {
        error: error.response.data?.error,
        message: error.response.data?.message,
        statusCode: error.response.data?.statusCode
      };


      return {
        message: safeData.error || safeData.message || 'An error occurred',
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
const userService = new UserService();
export default userService;

