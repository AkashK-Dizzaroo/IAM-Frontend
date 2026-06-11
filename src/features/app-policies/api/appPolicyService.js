import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const appPolicyService = {
  list: (appKey, params) => apiClient.get(v1(`/apps/${appKey}/policies`), { params }),
  get: (appKey, id) => apiClient.get(v1(`/apps/${appKey}/policies/${id}`)),
  create: (appKey, data) => apiClient.post(v1(`/apps/${appKey}/policies`), data),
  update: (appKey, id, data) => apiClient.patch(v1(`/apps/${appKey}/policies/${id}`), data),
  setStatus: (appKey, id, status) => apiClient.patch(v1(`/apps/${appKey}/policies/${id}/status`), { status }),
  delete: (appKey, id) => apiClient.delete(v1(`/apps/${appKey}/policies/${id}`)),
  getVersions: (appKey, id) => apiClient.get(v1(`/apps/${appKey}/policies/${id}/versions`)),
  rollback: (appKey, id, version) => apiClient.post(v1(`/apps/${appKey}/policies/${id}/rollback/${version}`)),
};
