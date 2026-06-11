import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const abacUserService = {
  list: (params = {}) => apiClient.get(v1('/users'), { params }),
  get: (id) => apiClient.get(v1(`/users/${id}`)),
  create: (data) => apiClient.post(v1('/users'), data),
  update: (id, data) => apiClient.patch(v1(`/users/${id}`), data),
  listHubUserAttrs: (userId) => apiClient.get(v1(`/users/${userId}/hub-attributes`)),
  setHubUserAttr: (userId, data) => apiClient.post(v1(`/users/${userId}/hub-attributes`), data),
  deleteHubUserAttr: (userId, attributeKey) => apiClient.delete(v1(`/users/${userId}/hub-attributes/${encodeURIComponent(attributeKey)}`)),
};
