import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const appAttributeService = {
  list: (appKey) => apiClient.get(v1(`/apps/${appKey}/attributes`)),
  listRequestable: (appKey) => apiClient.get(v1(`/apps/${appKey}/attributes/requestable`)),
  create: (appKey, data) => apiClient.post(v1(`/apps/${appKey}/attributes`), data),
  update: (appKey, id, data) => apiClient.patch(v1(`/apps/${appKey}/attributes/${id}`), data),
  delete: (appKey, id) => apiClient.delete(v1(`/apps/${appKey}/attributes/${id}`)),
};
