import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const auditService = {
  listLogs: (appKey, params) => apiClient.get(v1(`/apps/${appKey}/audit`), { params }),
  listGlobalLogs: (params) => apiClient.get(v1('/audit/global'), { params }),
  getStats: (appKey, params) => apiClient.get(v1(`/apps/${appKey}/audit/stats`), { params }),
};
