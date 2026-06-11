import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const globalPolicyService = {
  list: (params) => apiClient.get(v1('/global-policies'), { params }),
  get: (id) => apiClient.get(v1(`/global-policies/${id}`)),
  create: (data) => apiClient.post(v1('/global-policies'), data),
  update: (id, data) => apiClient.patch(v1(`/global-policies/${id}`), data),
  setStatus: (id, status) => apiClient.patch(v1(`/global-policies/${id}/status`), { status }),
  delete: (id) => apiClient.delete(v1(`/global-policies/${id}`)),
  getVersions: (id) => apiClient.get(v1(`/global-policies/${id}/versions`)),
  rollback: (id, version) => apiClient.post(v1(`/global-policies/${id}/rollback/${version}`)),
};
