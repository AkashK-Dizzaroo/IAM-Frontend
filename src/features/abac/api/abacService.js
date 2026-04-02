import apiClient from '@/lib/apiClient';

const v1 = (path) => `/v1${path}`;

export const abacService = {

  // Applications (for scope selector)
  getApplications: () =>
    apiClient.get(v1('/abac/applications')),

  // Hub Attributes
  listHubAttrDefs: () =>
    apiClient.get(v1('/hub-attributes')),
  createHubAttrDef: (data) =>
    apiClient.post(v1('/hub-attributes'), data),
  updateHubAttrDef: (id, data) =>
    apiClient.patch(v1(`/hub-attributes/${id}`), data),
  deleteHubAttrDef: (id) =>
    apiClient.delete(v1(`/hub-attributes/${id}`)),

  // Resource Classifications
  listClassifications: () =>
    apiClient.get(v1('/resource-classifications')),
  createClassification: (data) =>
    apiClient.post(v1('/resource-classifications'), data),
  updateClassification: (id, data) =>
    apiClient.patch(v1(`/resource-classifications/${id}`), data),
  deleteClassification: (id) =>
    apiClient.delete(v1(`/resource-classifications/${id}`)),

  // Users (ABAC)
  listUsers: (params = {}) =>
    apiClient.get(v1('/users'), { params }),
  getUser: (id) =>
    apiClient.get(v1(`/users/${id}`)),
  createUser: (data) =>
    apiClient.post(v1('/users'), data),
  updateUser: (id, data) =>
    apiClient.patch(v1(`/users/${id}`), data),
  listHubUserAttrs: (userId) =>
    apiClient.get(v1(`/users/${userId}/hub-attributes`)),
  setHubUserAttr: (userId, data) =>
    apiClient.post(v1(`/users/${userId}/hub-attributes`), data),
  deleteHubUserAttr: (userId, attrDefId) =>
    apiClient.delete(v1(`/users/${userId}/hub-attributes/${attrDefId}`)),

  // Global Policies
  listGlobalPolicies: (params) =>
    apiClient.get(v1('/global-policies'), { params }),
  getGlobalPolicy: (id) =>
    apiClient.get(v1(`/global-policies/${id}`)),
  createGlobalPolicy: (data) =>
    apiClient.post(v1('/global-policies'), data),
  updateGlobalPolicy: (id, data) =>
    apiClient.patch(v1(`/global-policies/${id}`), data),
  setGlobalPolicyStatus: (id, status) =>
    apiClient.patch(v1(`/global-policies/${id}/status`), { status }),
  deleteGlobalPolicy: (id) =>
    apiClient.delete(v1(`/global-policies/${id}`)),
  getGlobalPolicyVersions: (id) =>
    apiClient.get(v1(`/global-policies/${id}/versions`)),
  rollbackGlobalPolicy: (id, version) =>
    apiClient.post(v1(`/global-policies/${id}/rollback/${version}`)),

  // App Attribute Definitions
  listAppAttrDefs: (appKey) =>
    apiClient.get(v1(`/apps/${appKey}/attributes`)),
  createAppAttrDef: (appKey, data) =>
    apiClient.post(v1(`/apps/${appKey}/attributes`), data),
  updateAppAttrDef: (appKey, id, data) =>
    apiClient.patch(v1(`/apps/${appKey}/attributes/${id}`), data),
  deleteAppAttrDef: (appKey, id) =>
    apiClient.delete(v1(`/apps/${appKey}/attributes/${id}`)),

  // App User Attributes
  listAppUserAttrs: (appKey, userId) =>
    apiClient.get(v1(`/apps/${appKey}/users/${userId}/attributes`)),
  setAppUserAttr: (appKey, userId, data) =>
    apiClient.post(v1(`/apps/${appKey}/users/${userId}/attributes`), data),
  deleteAppUserAttr: (appKey, userId, attrDefId) =>
    apiClient.delete(
      v1(`/apps/${appKey}/users/${userId}/attributes/${attrDefId}`)
    ),

  // App Policies
  listAppPolicies: (appKey, params) =>
    apiClient.get(v1(`/apps/${appKey}/policies`), { params }),
  getAppPolicy: (appKey, id) =>
    apiClient.get(v1(`/apps/${appKey}/policies/${id}`)),
  createAppPolicy: (appKey, data) =>
    apiClient.post(v1(`/apps/${appKey}/policies`), data),
  updateAppPolicy: (appKey, id, data) =>
    apiClient.patch(v1(`/apps/${appKey}/policies/${id}`), data),
  setAppPolicyStatus: (appKey, id, status) =>
    apiClient.patch(
      v1(`/apps/${appKey}/policies/${id}/status`), { status }
    ),
  deleteAppPolicy: (appKey, id) =>
    apiClient.delete(v1(`/apps/${appKey}/policies/${id}`)),
  getAppPolicyVersions: (appKey, id) =>
    apiClient.get(v1(`/apps/${appKey}/policies/${id}/versions`)),
  rollbackAppPolicy: (appKey, id, version) =>
    apiClient.post(
      v1(`/apps/${appKey}/policies/${id}/rollback/${version}`)
    ),

  // Evaluate
  evaluate: (appKey, data) =>
    apiClient.post(v1(`/evaluate/${appKey}`), data),

  // Audit
  listAuditLogs: (appKey, params) =>
    apiClient.get(v1(`/apps/${appKey}/audit`), { params }),
  getAuditStats: (appKey, params) =>
    apiClient.get(v1(`/apps/${appKey}/audit/stats`), { params }),
  getCoverageGaps: (appKey) =>
    apiClient.get(v1(`/apps/${appKey}/coverage-gaps`)),
};
