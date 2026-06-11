import apiClient from '@/lib/apiClient';

export const externalUserService = {
  list:   (params = {}) => apiClient.get('/external-users', { params }),
  get:    (id)          => apiClient.get(`/external-users/${id}`),
  create: (data)        => apiClient.post('/external-users', data),
  update: (id, data)    => apiClient.patch(`/external-users/${id}`, data),
  remove: (id)          => apiClient.delete(`/external-users/${id}`),
};
