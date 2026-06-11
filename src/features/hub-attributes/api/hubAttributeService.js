import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const hubAttributeService = {
  list: () => apiClient.get(v1('/hub-attributes')),
  create: (data) => apiClient.post(v1('/hub-attributes'), data),
  update: (id, data) => apiClient.patch(v1(`/hub-attributes/${id}`), data),
  delete: (id) => apiClient.delete(v1(`/hub-attributes/${id}`)),
};
