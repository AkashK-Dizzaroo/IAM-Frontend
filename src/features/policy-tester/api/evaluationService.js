import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const evaluationService = {
  evaluate: (appKey, data) => apiClient.post(v1(`/evaluate/${appKey}`), data),
};
