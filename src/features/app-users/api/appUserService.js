import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const appUserService = {
  listAppUsers: (appKey) => apiClient.get(v1(`/apps/${appKey}/users`)),
  assignAppUser: (appKey, data) => apiClient.post(v1(`/apps/${appKey}/users/assign`), data),
  removeAppUser: (appKey, userId) => apiClient.delete(v1(`/apps/${appKey}/users/${userId}`)),
  listAppUserAttrs: (appKey, userId) => apiClient.get(v1(`/apps/${appKey}/users/${userId}/attributes`)),
  setAppUserAttr: (appKey, userId, data) => apiClient.post(v1(`/apps/${appKey}/users/${userId}/attributes`), data),
  deleteAppUserAttr: (appKey, userId, attrDefId) => apiClient.delete(v1(`/apps/${appKey}/users/${userId}/attributes/${attrDefId}`)),
};
