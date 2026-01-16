import axios from 'axios';
import { generateObjectId } from '../utils/objectIdGenerator';

// Use the same default backend port (4001) as the main API client
const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:4001'}/api`;

class AccessRequestService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('platform_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }


  // Create a new access request
  async createAccessRequest(requestData) {
    try {
      // Get current user info or use demo data
      const currentUser = this.getCurrentUserInfo();
      
      // Merge user info with request data - always use current user's email
      const requestPayload = {
        ...requestData,
        requesterId: currentUser.id || generateObjectId(),
        requesterEmail: currentUser.email || 'demo@neurodoc.com', // Always use logged-in user's email
        requesterName: currentUser.name || requestData.metadata?.requesterName || 'Demo User'
      };

      const response = await this.api.post('/access-requests', requestPayload);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get access requests for a specific user
  async getUserAccessRequests(userId, options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.status) params.append('status', options.status);
      if (options.application) params.append('application', options.application);
      if (options.limit) params.append('limit', options.limit);
      if (options.page) params.append('page', options.page);

      const response = await this.api.get(`/access-requests/user/${userId}?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get all access requests (admin)
  async getAllAccessRequests(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.status) params.append('status', options.status);
      if (options.application) params.append('application', options.application);
      if (options.urgency) params.append('urgency', options.urgency);
      if (options.requesterId) params.append('requesterId', options.requesterId);
      if (options.limit) params.append('limit', options.limit);
      if (options.page) params.append('page', options.page);
      if (options.sortBy) params.append('sortBy', options.sortBy);
      if (options.sortOrder) params.append('sortOrder', options.sortOrder);

      const response = await this.api.get(`/access-requests?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get access request by ID
  async getAccessRequestById(id) {
    try {
      const response = await this.api.get(`/access-requests/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update access request
  async updateAccessRequest(id, updateData) {
    try {
      const response = await this.api.put(`/access-requests/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Approve access request (admin)
  async approveAccessRequest(id, { reviewerComments = '', approvals = [] } = {}) {
    try {
      const response = await this.api.patch(`/access-requests/${id}/approve`, {
        reviewerComments,
        approvals
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Reject access request (admin)
  async rejectAccessRequest(id, reviewerComments = '') {
    try {
      const response = await this.api.patch(`/access-requests/${id}/reject`, {
        reviewerComments
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Delete access request
  async deleteAccessRequest(id) {
    try {
      const response = await this.api.delete(`/access-requests/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get access request statistics
  async getAccessRequestStats() {
    try {
      const response = await this.api.get('/access-requests/stats');
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
        message: error.response.data.message || 'An error occurred',
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

  // Helper method to get current user ID (you may need to adjust this based on your auth system)
  getCurrentUserId() {
    // This should be replaced with your actual user ID retrieval logic
    const user = JSON.parse(localStorage.getItem('platform_user') || '{}');
    return user.id || user._id;
  }

  // Helper method to get current user info
  getCurrentUserInfo() {
    // Use platform_user for consistency with the rest of the application
    const user = JSON.parse(localStorage.getItem('platform_user') || '{}');
    
    return {
      id: user.id || user._id,
      email: user.email,
      name: user.name || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      department: user.department,
      role: user.role || user.jobTitle
    };
  }

  // Helper method to get current user (alias for getCurrentUserInfo)
  async getCurrentUser() {
    const user = this.getCurrentUserInfo();
    if (!user.id) {
      throw new Error('No user session found');
    }
    return user;
  }
}

// Create and export a singleton instance
const accessRequestService = new AccessRequestService();
export default accessRequestService;


