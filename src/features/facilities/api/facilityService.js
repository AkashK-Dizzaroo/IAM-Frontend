import apiClient from '@/lib/apiClient';

export const facilityService = {
  list: (params = {}) => apiClient.get('/facilities', { params }),
  get: (id) => apiClient.get(`/facilities/${id}`),
  create: (data) => apiClient.post('/facilities', data),
  update: (id, data) => apiClient.patch(`/facilities/${id}`, data),
  remove: (id) => apiClient.delete(`/facilities/${id}`),
};
