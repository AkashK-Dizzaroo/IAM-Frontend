import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const coverageGapService = {
  get: (appKey) => apiClient.get(v1(`/apps/${appKey}/coverage-gaps`)),
};
