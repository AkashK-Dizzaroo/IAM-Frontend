/**
 * Central registry of TanStack Query cache keys for the IAM-Frontend.
 *
 * All useQuery / useMutation / queryClient.invalidateQueries calls MUST
 * reference these constants. Inline string arrays cause cache misses across
 * pages because TanStack Query uses deep-equality on the key array — a single
 * spelling difference creates a separate cache entry.
 */
export const QK = {
  // ── Hub attribute definitions ──────────────────────────────────────────────
  hubAttributes: ['abac', 'hubAttributes'],

  // ── Global policies ────────────────────────────────────────────────────────
  globalPolicies: (filter) => ['abac', 'globalPolicies', filter ?? 'all'],
  globalPolicy: (id) => ['abac', 'globalPolicy', id ?? null],
  globalPolicyVersions: (id) => ['abac', 'globalPolicyVersions', id ?? null],

  // ── App policies ───────────────────────────────────────────────────────────
  appPolicies: (appKey, filter) => ['abac', 'appPolicies', appKey ?? null, filter ?? 'all'],
  appPolicy: (id) => ['abac', 'appPolicy', id ?? null],
  appPolicyVersions: (appKey, policyId) => ['abac', 'appPolicyVersions', appKey ?? null, policyId ?? null],

  // ── App attribute definitions ──────────────────────────────────────────────
  // Per-app ABAC attribute schema (subject/resource/action/environment namespaces).
  // Used by AppAttributesPage, AppPoliciesPage, AppUsersManagementPage,
  // AppUserAttributesPage, CoverageGapsPage, PolicyTesterPage.
  appAttributes: (appKey) => ['abac', 'appAttributes', appKey ?? null],

  // ── App users ──────────────────────────────────────────────────────────────
  // Users assigned to a specific application (AppUsersManagementPage, AssignUserDialog).
  appUsers: (appKey) => ['abac', 'appUsers', appKey ?? null],
  // App-team members for the attribute editor user picker.
  appTeam: (appKey) => ['appTeam', appKey ?? null],
  // All active hub users for the AssignUser picker (large stable list).
  usersAllActive: ['abac', 'users', 'all-active'],
  // Users picker inside AppUserAttributesPage (smaller limit).
  usersAttrsPicker: ['abac', 'users', 'appUserAttrsPicker'],

  // ── App user attributes ────────────────────────────────────────────────────
  // Per-user attribute values scoped to an app (AppUserAttributesPage, AppUserAttributesPanel).
  appUserAttributes: (appKey, userId) => ['abac', 'appUserAttributes', appKey ?? null, userId ?? null],
  // Hub-level user attributes used in PolicyTester subject resolution.
  hubUserAttrs: (userId) => ['abac', 'hubUserAttrs', userId ?? null],
  // App-level user attributes used in PolicyTester (distinct shape from appUserAttributes).
  appUserAttrs: (appKey, userId) => ['abac', 'appUserAttrs', appKey ?? null, userId ?? null],

  // ── Applications ───────────────────────────────────────────────────────────
  // ABAC-scoped app list (used across most ABAC pages).
  applications: ['abac', 'applications'],
  // Full app list fetched via the raw /applications route (AbacApplicationsPage admin table).
  applicationsRaw: ['applications'],
  // Full app list for resource modals and filters.
  applicationsModal: ['resources', 'applicationsModal'],
  // App list fetched for study-access resource resolution (stable, shared across panels).
  appsForStudyAccess: ['abac', 'applications', 'forStudyAccess'],

  // ── Study resources ────────────────────────────────────────────────────────
  // Active resources for a specific app (used in user-attribute panels for study pickers).
  studyResources: (appKey, appId) => ['abac', 'studyResources', appKey ?? null, appId ?? null],

  // ── Coverage gaps ──────────────────────────────────────────────────────────
  coverageGaps: (appKey) => ['abac', 'coverageGaps', appKey ?? null],

  // ── Resource classifications ───────────────────────────────────────────────
  classifications: ['abac', 'classifications'],

  // ── Users ──────────────────────────────────────────────────────────────────
  users: (search) => ['abac', 'users', search ?? ''],
  userAttrs: (userId) => ['abac', 'userAttrs', userId ?? null],

  // ── Resources ──────────────────────────────────────────────────────────────
  resources: (params) => ['resources', 'list', params ?? null],
  resourcesAll: ['resources', 'all'],
  resourcesByApp: (applicationId) => ['resources', 'byApp', applicationId ?? null],
  resourceAttrDefs: ['resources', 'attrDefs'],
  resourceAttrs: (resourceId) => ['resources', 'attrs', resourceId ?? null],
  applicationDetail: (appId) => ['resources', 'appDetail', appId ?? null],
};
