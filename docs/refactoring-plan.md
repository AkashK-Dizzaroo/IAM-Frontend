# IAM-Frontend Deep Refactoring Plan

Generated: 2026-06-10 | Based on complete audit of every file in `src/`

---

## Phase 1: Full Audit

### Core Files

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `App.jsx` | 175 | Route table, provider stack (QueryClient, BrowserRouter, AuthProvider, AbacScopeProvider), lazy imports, default redirect logic | `main.jsx` | **KEEP** — clean route manifest |
| `main.jsx` | 91 | Custom domain redirect, GoogleOAuthProvider, error boundary, VITE_GOOGLE_CLIENT_ID guard, React mount | Entry point | **KEEP** — frozen per constraints |
| `index.css` | — | Tailwind base styles | Entry point | **KEEP** |

### Config

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `config/env.js` | 75 | VITE_* readers, URL helpers (getApiBaseURL, getAxiosBaseURL, getValidHubUrl), env object | `apiClient.js`, `DashboardPage.jsx`, `AuthProvider.jsx`, `App.jsx` | **KEEP** |
| `config/queryClient.js` | 12 | QueryClient singleton with defaults | `App.jsx`, `AuthProvider.jsx`, `LogoutPage.jsx` | **KEEP** |
| `config/index.js` | 2 | Re-exports queryClient + env | Nobody directly (imports use specific paths) | **DELETE** — zero consumers |

### Lib

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `lib/apiClient.js` | 110 | Axios singleton, request/response interceptors, 401 handler, logger integration | Nearly every service file | **KEEP** — frozen per constraints |
| `lib/logger.js` | 51 | Structured console logger with sanitization, user tracking | `apiClient.js`, `AuthProvider.jsx`, `GlobalPoliciesPage.jsx` | **KEEP** |
| `lib/queryKeys.js` | 78 | Central QK registry for TanStack Query | Most page components | **KEEP** but will need updates as features split |
| `lib/utils.js` | 28 | `cn()`, `getDisplayRole()`, `generateObjectId()` — 3 unrelated concerns | `cn`: ~many UI files; `getDisplayRole`: DashboardPage + MyProfilePage; `generateObjectId`: accessRequestService | **SPLIT** |
| `lib/index.js` | 2 | Re-exports apiClient, cn, generateObjectId | Nobody (zero consumers) | **DELETE** |

### Utils

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `utils/hubUrl.js` | 27 | Duplicate of `getValidHubUrl` from `config/env.js` | Nobody (zero consumers — all imports use `config/env`) | **DELETE** |

### Hooks

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `hooks/use-toast.js` | 155 | shadcn toast hook (global store pattern) | Nearly every page component | **KEEP** |

### Auth Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `auth/contexts/AuthContext.js` | 3 | createContext(null) | AuthProvider, useAuth | **KEEP** |
| `auth/contexts/AuthProvider.jsx` | 208 | Session management, verify, logout, effectiveRoles, 401 listener | App.jsx | **KEEP** — frozen |
| `auth/hooks/useAuth.js` | 10 | useContext wrapper | ~20 files | **KEEP** |
| `auth/components/ProtectedRoute.jsx` | 50 | Auth guard, OAuth redirect trigger, role check | App.jsx | **KEEP** |
| `auth/components/LogoutPage.jsx` | 36 | Forced logout handler | App.jsx route | **KEEP** |
| `auth/components/OAuthCallbackPage.jsx` | 56 | OAuth callback → backend exchange | App.jsx route | **KEEP** |
| `auth/utils/oauthFlow.js` | 95 | PKCE generation, startOAuthLogin, consume verifier/state | ProtectedRoute, AuthProvider, OAuthCallbackPage | **KEEP** |
| `auth/utils/sessionKeys.js` | 8 | Storage key constants | oauthFlow.js | **KEEP** |
| `auth/index.js` | 4 | Barrel: AuthProvider, AuthContext, useAuth, ProtectedRoute | App.jsx, many pages | **KEEP** |

### ABAC Feature — The Junk Drawer

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `abac/api/abacService.js` | 138 | 30+ API methods: hub attrs, app attrs, global policies, app policies, users, app users, classifications, audit, coverage gaps, evaluation, applications | ~15 page/component files | **SPLIT** — into domain-specific services |
| `abac/contexts/AbacScopeContext.jsx` | 73 | Scope state (global/app), selectedAppKey, localStorage persistence | DashboardPage, ~10 app-scope pages | **KEEP** (move to shared location) |
| `abac/pages/HubAttributesPage.jsx` | 875 | Hub attribute definitions CRUD, bulk delete, namespace tabs, form dialog | App.jsx route | **MOVE** to `features/hub-attributes/` |
| `abac/pages/GlobalPoliciesPage.jsx` | 1860 | Global policy CRUD, status management, version history, rollback, condition builder | App.jsx route | **MOVE** to `features/global-policies/` |
| `abac/pages/AppAttributesPage.jsx` | 1583 | App attribute definitions CRUD, namespace tabs, bulk import | App.jsx route | **MOVE** to `features/app-attributes/` |
| `abac/pages/AppPoliciesPage.jsx` | 2354 | App policy CRUD, status, versions, rollback, condition builder, combining strategy | App.jsx route | **MOVE** to `features/app-policies/` |
| `abac/pages/AppUserAttributesPage.jsx` | 752 | Per-user app attribute value editing, study access input | AppUsersManagementPage (imported) | **RENAME+MOVE** — it's a component, not a page → `features/app-users/components/AppUserAttributesPage.jsx` |
| `abac/pages/AppUserAttributesPanel.jsx` | 588 | Side panel for editing a user's app attributes with resource tree | AppUsersManagementPage (imported) | **RENAME+MOVE** → `features/app-users/components/AppUserAttributesPanel.jsx` |
| `abac/pages/AppUsersManagementPage.jsx` | 579 | App user list, search, inline attribute editing, remove user | App.jsx route (both `/app-user-attributes` and `/app-users`) | **MOVE** to `features/app-users/` |
| `abac/pages/AssignUserDialog.jsx` | 740 | Dialog for assigning a user to an app with resource access + attributes | AppUsersManagementPage | **RENAME+MOVE** → `features/app-users/components/AssignUserDialog.jsx` |
| `abac/pages/BulkImportDialog.jsx` | 545 | CSV/structured bulk import of attribute definitions | AppAttributesPage | **RENAME+MOVE** → `features/app-attributes/components/BulkImportDialog.jsx` |
| `abac/pages/CoverageGapsPage.jsx` | 221 | Coverage gap analysis table with categorization | App.jsx route | **MOVE** to `features/coverage-gaps/` |
| `abac/pages/PolicyTesterPage.jsx` | 1303 | ABAC evaluation runner with user/resource pickers, result display | App.jsx route | **MOVE** to `features/policy-tester/` |
| `abac/pages/ResourceClassificationsPage.jsx` | 385 | Resource classification definitions CRUD | No active route in App.jsx! | **INVESTIGATE** — may be dead or accessed via other means |
| `abac/pages/AbacApplicationsPage.jsx` | 861 | Application registry CRUD, combining strategy, OAuth config | App.jsx route `/applications` | **MOVE** to `features/applications/` (replace legacy) |
| `abac/pages/AbacUsersPage.jsx` | 980 | User CRUD with hub attribute editing, search, create dialog | App.jsx route `/users` | **MOVE** to `features/users/` (replace legacy page) |

### Access Requests Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `access-requests/api/accessRequestService.js` | 176 | Class-based service: CRUD, approve/reject/cancel, stats, getCurrentUser from localStorage | AccessRequestsPage, RequestAccessModal | **KEEP** — standardize to functions later |
| `access-requests/components/RequestAccessModal.jsx` | 420 | Multi-step access request form with attribute inputs | MyProfilePage | **KEEP** |
| `access-requests/pages/AccessRequestsPage.jsx` | 611 | Admin access request queue with approve/reject workflow | App.jsx route | **KEEP** |
| `access-requests/pages/MyRequestsPage.jsx` | 279 | User's own request history | No active route in App.jsx | **DELETE** — dead page, only exported from barrel |
| `access-requests/index.js` | 4 | Barrel: service, pages, modal | 1 import (barrel itself re-exports) | **UPDATE** — remove MyRequestsPage export |

### Applications Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `applications/api/applicationService.js` | 48 | Class-based: getApplications, getApplicationById | AbacApplicationsPage, AppResourcesPage, ResourceRegistrationModal, ResourceManagementTab, UserProfileManagementPage | **KEEP** — widely used |
| `applications/pages/ApplicationAccessManagementPage.jsx` | 487 | Legacy app access management UI | Barrel export only — no route in App.jsx, no external import | **DELETE** |
| `applications/index.js` | 2 | Barrel: applicationService, ApplicationAccessManagementPage | 4 files import `applicationService` from barrel | **UPDATE** — remove dead page export |

### Audit Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `audit/pages/AuditPage.jsx` | 318 | Global audit log table with filters, detail dialog | App.jsx route | **KEEP** — already uses abacService for data |
| `audit/index.js` | 1 | Barrel: AuditPage | App.jsx (via lazy import of direct path) | **KEEP** |

### Facilities Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `facilities/api/facilityService.js` | 9 | Plain object with CRUD methods | FacilitiesPage | **KEEP** — good pattern |
| `facilities/index.js` | 1 | Re-export from `../layout/pages/FacilitiesPage` | Nobody (zero consumers) | **DELETE** — misleading re-export |

### Layout Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `layout/components/DashboardPage.jsx` | 469 | Top header, sidebar, nav config, scope selector, app dropdown, user info, collapse toggle, `<Outlet />` | App.jsx | **SPLIT** — see Phase 5 |
| `layout/pages/FacilitiesPage.jsx` | 795 | Facility CRUD page (wrongly in layout/) | App.jsx route | **MOVE** to `features/facilities/` |
| `layout/index.js` | 1 | Barrel: DashboardPage | App.jsx | **KEEP** (update after split) |

### Profile Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `profile/api/profileService.js` | 114 | Class-based: me endpoints, getUserRolesAndResources | MyProfilePage, UserProfilePage, ApplicationRoleAssignmentsPage | **KEEP** |
| `profile/pages/MyProfilePage.jsx` | 763 | User's own profile view with tabs: info, access, hub attributes | App.jsx route | **KEEP** |
| `profile/pages/UserProfilePage.jsx` | 317 | Admin view of another user's profile | No active route in App.jsx | **INVESTIGATE** — may be used from AbacUsersPage as navigation |
| `profile/pages/ApplicationRoleAssignmentsPage.jsx` | 384 | My app role assignments view | No active route — redirect to `/my-profile` in App.jsx | **DELETE** — superseded, redirect exists |
| `profile/index.js` | 4 | Barrel | Various | **UPDATE** |

### Resources Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `resources/api/resourceService.js` | 148 | Class-based CRUD, classification, attributes | ~8 files across abac and resources | **KEEP** |
| `resources/components/ResourceManagementTab.jsx` | 890 | Main resource management table with CRUD | ResourceManagementPage | **KEEP** |
| `resources/components/AppResourcesTab.jsx` | 624 | App-scoped resource table with link/unlink | AppResourcesPage | **KEEP** |
| `resources/components/ResourceRegistrationModal.jsx` | 692 | New resource registration form | ResourceManagementTab | **KEEP** |
| `resources/components/AppResourceRegistrationModal.jsx` | 367 | Register resource for an app | AppResourcesTab | **KEEP** |
| `resources/components/EditResourceModal.jsx` | 475 | Edit existing resource | ResourceManagementTab, AppResourcesTab | **KEEP** |
| `resources/components/LinkResourceModal.jsx` | 305 | Link existing resource to app | AppResourcesTab | **KEEP** |
| `resources/components/ApplicationMultiSelect.jsx` | 135 | Multi-select app picker for resources | ResourceRegistrationModal, EditResourceModal | **KEEP** |
| `resources/components/L2ContainerSelect.jsx` | 125 | Level-2 parent resource selector | ResourceRegistrationModal | **KEEP** |
| `resources/config/resourceTypeConfig.js` | 88 | App topology level/type mappings | useResourceForm, ResourceRegistrationModal, AppResourceRegistrationModal | **KEEP** |
| `resources/hooks/useResourceForm.js` | 95 | Form state management for resource creation | ResourceRegistrationModal, AppResourceRegistrationModal | **KEEP** |
| `resources/pages/ResourceManagementPage.jsx` | 15 | Thin wrapper around ResourceManagementTab | App.jsx route | **KEEP** |
| `resources/pages/AppResourcesPage.jsx` | 50 | App-scoped resources page with scope guard | App.jsx route | **KEEP** |
| `resources/index.js` | 9 | Barrel: service, pages, components, config | ~6 external importers | **KEEP** |

### Roles Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `roles/api/permissionService.js` | 142 | Class-based permission CRUD | RolesPermissionsView only | **INVESTIGATE** — may be dead with ABAC replacing RBAC |
| `roles/api/roleService.js` | 132 | Class-based role CRUD | UserProfileManagementPage (legacy!) | **INVESTIGATE** — only consumer is a legacy page |
| `roles/components/RolesPermissionsView.jsx` | 551 | Roles + permissions management UI | RolesPage only | **INVESTIGATE** — RolesPage has no active route |
| `roles/pages/RolesPage.jsx` | 9 | Thin wrapper | No active route | **DELETE** — legacy RBAC page |
| `roles/index.js` | 4 | Barrel | UserProfileManagementPage (legacy) | **UPDATE** or **DELETE** |

### Users Feature

| File | Lines | Responsibilities | Imported by | Verdict |
|------|-------|-----------------|-------------|---------|
| `users/api/userService.js` | 238 | Class-based user CRUD, assignments, stats, approval | AbacUsersPage, AppUserAttributesPage, AccountRequestsPage, UserProfileManagementPage, ApplicationAccessManagementPage | **KEEP** |
| `users/components/UserForm.jsx` | 567 | User create/edit form with hub attribute editing | AbacUsersPage | **KEEP** |
| `users/components/UserManagementTable.jsx` | 599 | Legacy user management table | UsersPage only (legacy!) | **DELETE** — superseded by AbacUsersPage |
| `users/pages/AccountRequestsPage.jsx` | 356 | Account approval queue | App.jsx route | **KEEP** |
| `users/pages/UserProfileManagementPage.jsx` | 1035 | Legacy user profile management with role assignments | No active route — redirect to `/users` | **DELETE** — superseded by AbacUsersPage |
| `users/pages/UsersPage.jsx` | 9 | Thin wrapper for UserManagementTable | No active route — redirect to `/users` | **DELETE** — superseded by AbacUsersPage |
| `users/index.js` | 4 | Barrel | ApplicationAccessManagementPage (legacy) | **UPDATE** |

---

## Phase 2: New Folder Structure

```
src/
├── App.jsx
├── main.jsx
├── index.css
├── __tests__/
│
├── components/ui/                    # FROZEN — shared Radix/shadcn primitives
│
├── config/
│   ├── env.js
│   └── queryClient.js
│
├── hooks/
│   └── use-toast.js
│
├── lib/
│   ├── apiClient.js                  # FROZEN
│   ├── logger.js
│   ├── queryKeys.js                  # Updated with new feature key factories
│   ├── cn.js                         # NEW — extracted from utils.js
│   ├── roles.js                      # NEW — extracted getDisplayRole()
│   └── id.js                         # NEW — extracted generateObjectId()
│
├── features/
│   ├── auth/                         # FROZEN — no structural changes
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── LogoutPage.jsx
│   │   │   └── OAuthCallbackPage.jsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.js
│   │   │   └── AuthProvider.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── utils/
│   │   │   ├── oauthFlow.js
│   │   │   └── sessionKeys.js
│   │   └── index.js
│   │
│   ├── layout/                       # SPLIT from monolithic DashboardPage
│   │   ├── components/
│   │   │   ├── DashboardLayout.jsx   # Composes Sidebar + TopHeader + Outlet
│   │   │   ├── Sidebar.jsx           # Nav groups, collapse, scope selector
│   │   │   ├── TopHeader.jsx         # Back-to-hub, branding, logout
│   │   │   ├── NavItem.jsx           # Single nav button (extracted memo component)
│   │   │   └── ScopeSelector.jsx     # App dropdown + global/app switching
│   │   ├── navConfig.js              # Nav section data declarations
│   │   └── index.js                  # Exports DashboardLayout as DashboardPage
│   │
│   ├── scope/                        # Moved from abac/contexts/
│   │   ├── AbacScopeContext.jsx
│   │   └── index.js
│   │
│   ├── hub-attributes/               # From abac/pages/HubAttributesPage
│   │   ├── HubAttributesPage.jsx
│   │   └── index.js
│   │
│   ├── global-policies/              # From abac/pages/GlobalPoliciesPage
│   │   ├── GlobalPoliciesPage.jsx
│   │   └── index.js
│   │
│   ├── app-attributes/               # From abac/pages/AppAttributesPage
│   │   ├── components/
│   │   │   └── BulkImportDialog.jsx
│   │   ├── AppAttributesPage.jsx
│   │   └── index.js
│   │
│   ├── app-policies/                 # From abac/pages/AppPoliciesPage
│   │   ├── AppPoliciesPage.jsx
│   │   └── index.js
│   │
│   ├── app-users/                    # From abac/pages/AppUsersManagement + related
│   │   ├── components/
│   │   │   ├── AppUserAttributesPage.jsx
│   │   │   ├── AppUserAttributesPanel.jsx
│   │   │   └── AssignUserDialog.jsx
│   │   ├── AppUsersManagementPage.jsx
│   │   └── index.js
│   │
│   ├── policy-tester/                # From abac/pages/PolicyTesterPage
│   │   ├── PolicyTesterPage.jsx
│   │   └── index.js
│   │
│   ├── coverage-gaps/                # From abac/pages/CoverageGapsPage
│   │   ├── CoverageGapsPage.jsx
│   │   └── index.js
│   │
│   ├── resource-classifications/     # From abac/pages/ResourceClassificationsPage
│   │   ├── ResourceClassificationsPage.jsx
│   │   └── index.js
│   │
│   ├── applications/                 # Merged: existing service + AbacApplicationsPage
│   │   ├── api/
│   │   │   └── applicationService.js
│   │   ├── AbacApplicationsPage.jsx  # Renamed from pages/ since only one page
│   │   └── index.js
│   │
│   ├── users/                        # Cleaned: legacy pages removed
│   │   ├── api/
│   │   │   └── userService.js
│   │   ├── components/
│   │   │   └── UserForm.jsx
│   │   ├── AbacUsersPage.jsx         # Moved from abac/pages/
│   │   └── index.js
│   │
│   ├── account-approvals/            # Renamed from users/pages/AccountRequestsPage
│   │   ├── AccountRequestsPage.jsx
│   │   └── index.js
│   │
│   ├── access-requests/              # Cleaned: MyRequestsPage removed
│   │   ├── api/
│   │   │   └── accessRequestService.js
│   │   ├── components/
│   │   │   └── RequestAccessModal.jsx
│   │   ├── AccessRequestsPage.jsx
│   │   └── index.js
│   │
│   ├── audit/                        # No change needed
│   │   ├── AuditPage.jsx
│   │   └── index.js
│   │
│   ├── facilities/                   # FacilitiesPage moved here from layout/
│   │   ├── api/
│   │   │   └── facilityService.js
│   │   ├── FacilitiesPage.jsx
│   │   └── index.js
│   │
│   ├── profile/                      # Cleaned: legacy page removed
│   │   ├── api/
│   │   │   └── profileService.js
│   │   ├── MyProfilePage.jsx
│   │   └── index.js
│   │
│   └── resources/                    # No structural change — already well-organized
│       ├── api/
│       │   └── resourceService.js
│       ├── components/
│       │   ├── ResourceManagementTab.jsx
│       │   ├── AppResourcesTab.jsx
│       │   ├── ResourceRegistrationModal.jsx
│       │   ├── AppResourceRegistrationModal.jsx
│       │   ├── EditResourceModal.jsx
│       │   ├── LinkResourceModal.jsx
│       │   ├── ApplicationMultiSelect.jsx
│       │   └── L2ContainerSelect.jsx
│       ├── config/
│       │   └── resourceTypeConfig.js
│       ├── hooks/
│       │   └── useResourceForm.js
│       ├── pages/
│       │   ├── ResourceManagementPage.jsx
│       │   └── AppResourcesPage.jsx
│       └── index.js
```

### Design decisions

**Why `features/scope/` instead of keeping AbacScopeContext inside `features/abac/`?**
AbacScopeContext is consumed by DashboardPage, ~10 ABAC-related pages, and AppResourcesPage. It's a cross-cutting concern used by layout and multiple features. Extracting it to its own module prevents circular dependencies and makes the import path obvious. The `features/abac/` folder is being dissolved entirely.

**Why NOT a `src/pages/` re-export layer?**
After analysis, the lazy imports in App.jsx already serve as a clean route manifest — each line shows exactly which file backs each route. Adding a `src/pages/` layer would just add 20+ one-line files with zero new information. The imports already use direct paths. Skip it.

**Why merge `AbacUsersPage` into `features/users/` instead of keeping it separate?**
AbacUsersPage replaced UsersPage functionally. It manages user CRUD with hub attributes — that's the users domain. It imports `userService` and `UserForm` from the users feature. Keeping it separate would force cross-feature imports for what is logically the same vertical slice.

**Why separate `account-approvals/` from `users/`?**
Account approvals is a distinct workflow (approval queue) with its own route, its own data shape, and its own user persona (IT_SUPPORT/HUB_OWNER). It doesn't share components with user CRUD. Separating it makes both features more cohesive.

**Why keep `resource-classifications/` as a standalone feature?**
ResourceClassificationsPage manages classification definitions — a distinct domain from both resources (which are resource instances) and ABAC attributes. It has its own CRUD operations on `/v1/resource-classifications`. Even though it's only ~385 lines, it's a complete feature with its own API surface.

**Note:** ResourceClassificationsPage has NO active route in App.jsx. This needs investigation — it may be accessible from within another page or may be dead code. If dead, fold the page into `features/resources/` as a component or delete it.

---

## Phase 3: Service Splitting — `abacService.js`

| Current method | New service file | Feature |
|----------------|------------------|---------| 
| `getApplications()` | `features/applications/api/applicationService.js` (add as `getAbacApplications`) | `applications` |
| `listHubAttrDefs()` | `features/hub-attributes/api/hubAttributeService.js` | `hub-attributes` |
| `createHubAttrDef(data)` | `features/hub-attributes/api/hubAttributeService.js` | `hub-attributes` |
| `updateHubAttrDef(id, data)` | `features/hub-attributes/api/hubAttributeService.js` | `hub-attributes` |
| `deleteHubAttrDef(id)` | `features/hub-attributes/api/hubAttributeService.js` | `hub-attributes` |
| `listClassifications()` | `features/resource-classifications/api/classificationService.js` | `resource-classifications` |
| `createClassification(data)` | `features/resource-classifications/api/classificationService.js` | `resource-classifications` |
| `updateClassification(id, data)` | `features/resource-classifications/api/classificationService.js` | `resource-classifications` |
| `deleteClassification(id)` | `features/resource-classifications/api/classificationService.js` | `resource-classifications` |
| `listUsers(params)` | `features/users/api/abacUserService.js` | `users` |
| `getUser(id)` | `features/users/api/abacUserService.js` | `users` |
| `createUser(data)` | `features/users/api/abacUserService.js` | `users` |
| `updateUser(id, data)` | `features/users/api/abacUserService.js` | `users` |
| `listHubUserAttrs(userId)` | `features/users/api/abacUserService.js` | `users` |
| `setHubUserAttr(userId, data)` | `features/users/api/abacUserService.js` | `users` |
| `deleteHubUserAttr(userId, attrKey)` | `features/users/api/abacUserService.js` | `users` |
| `listGlobalPolicies(params)` | `features/global-policies/api/globalPolicyService.js` | `global-policies` |
| `getGlobalPolicy(id)` | `features/global-policies/api/globalPolicyService.js` | `global-policies` |
| `createGlobalPolicy(data)` | `features/global-policies/api/globalPolicyService.js` | `global-policies` |
| `updateGlobalPolicy(id, data)` | `features/global-policies/api/globalPolicyService.js` | `global-policies` |
| `setGlobalPolicyStatus(id, status)` | `features/global-policies/api/globalPolicyService.js` | `global-policies` |
| `deleteGlobalPolicy(id)` | `features/global-policies/api/globalPolicyService.js` | `global-policies` |
| `getGlobalPolicyVersions(id)` | `features/global-policies/api/globalPolicyService.js` | `global-policies` |
| `rollbackGlobalPolicy(id, version)` | `features/global-policies/api/globalPolicyService.js` | `global-policies` |
| `listAppUsers(appKey)` | `features/app-users/api/appUserService.js` | `app-users` |
| `assignAppUser(appKey, data)` | `features/app-users/api/appUserService.js` | `app-users` |
| `removeAppUser(appKey, userId)` | `features/app-users/api/appUserService.js` | `app-users` |
| `listAppAttrDefs(appKey)` | `features/app-attributes/api/appAttributeService.js` | `app-attributes` |
| `listRequestableAppAttrDefs(appKey)` | `features/app-attributes/api/appAttributeService.js` | `app-attributes` |
| `createAppAttrDef(appKey, data)` | `features/app-attributes/api/appAttributeService.js` | `app-attributes` |
| `updateAppAttrDef(appKey, id, data)` | `features/app-attributes/api/appAttributeService.js` | `app-attributes` |
| `deleteAppAttrDef(appKey, id)` | `features/app-attributes/api/appAttributeService.js` | `app-attributes` |
| `listAppUserAttrs(appKey, userId)` | `features/app-users/api/appUserService.js` | `app-users` |
| `setAppUserAttr(appKey, userId, data)` | `features/app-users/api/appUserService.js` | `app-users` |
| `deleteAppUserAttr(appKey, userId, attrDefId)` | `features/app-users/api/appUserService.js` | `app-users` |
| `listAppPolicies(appKey, params)` | `features/app-policies/api/appPolicyService.js` | `app-policies` |
| `getAppPolicy(appKey, id)` | `features/app-policies/api/appPolicyService.js` | `app-policies` |
| `createAppPolicy(appKey, data)` | `features/app-policies/api/appPolicyService.js` | `app-policies` |
| `updateAppPolicy(appKey, id, data)` | `features/app-policies/api/appPolicyService.js` | `app-policies` |
| `setAppPolicyStatus(appKey, id, status)` | `features/app-policies/api/appPolicyService.js` | `app-policies` |
| `deleteAppPolicy(appKey, id)` | `features/app-policies/api/appPolicyService.js` | `app-policies` |
| `getAppPolicyVersions(appKey, id)` | `features/app-policies/api/appPolicyService.js` | `app-policies` |
| `rollbackAppPolicy(appKey, id, version)` | `features/app-policies/api/appPolicyService.js` | `app-policies` |
| `evaluate(appKey, data)` | `features/policy-tester/api/evaluationService.js` | `policy-tester` |
| `listAuditLogs(appKey, params)` | `features/audit/api/auditService.js` | `audit` |
| `listGlobalAuditLogs(params)` | `features/audit/api/auditService.js` | `audit` |
| `getAuditStats(appKey, params)` | `features/audit/api/auditService.js` | `audit` |
| `getCoverageGaps(appKey)` | `features/coverage-gaps/api/coverageGapService.js` | `coverage-gaps` |

### Cross-feature consumers

Some methods are consumed by pages outside their natural feature:

- `listAppAttrDefs()` → consumed by: AppAttributesPage, AppPoliciesPage, AppUsersManagementPage, AppUserAttributesPage, CoverageGapsPage, PolicyTesterPage. **Solution:** Import from `@/features/app-attributes/api/appAttributeService` in all consumers.
- `listHubAttrDefs()` → consumed by: HubAttributesPage, PolicyTesterPage. **Solution:** Import from `@/features/hub-attributes/api/hubAttributeService`.
- `listUsers()` → consumed by: AbacUsersPage, AssignUserDialog. **Solution:** Import from `@/features/users/api/abacUserService`.
- `getApplications()` → consumed by: DashboardPage (scope selector), RequestAccessModal. **Solution:** Add method to `features/applications/api/applicationService.js`.

---

## Phase 4: TanStack Query Hook Plan

**Current state:** Most pages already use `useQuery`/`useMutation` directly with inline service calls. The codebase is already 80% on TanStack Query. The remaining anti-pattern is NOT "fetch in useEffect + setState" — it's that the query hooks are defined inline in each component rather than being shared.

**Recommendation:** Do NOT create separate `useXxxQuery.js` files for each service function at this stage. Here's why:

1. The existing pattern works: pages call `useQuery({ queryKey: QK.xxx, queryFn: service.xxx })` directly.
2. The `QK` registry in `lib/queryKeys.js` already centralizes cache keys.
3. Creating 40+ hook wrapper files would add 40+ files with ~10 lines each — pure boilerplate.
4. Most queries have page-specific `enabled` guards and `staleTime` overrides that make "generic" hooks less useful.

**What to do instead:**
- Keep using `useQuery`/`useMutation` inline in pages
- Keep using the `QK` registry for cache key consistency
- Only extract a query hook when the exact same query (same key, same enabled guard, same transform) is duplicated across 3+ pages

**Exceptions — queries worth extracting:**

| Shared query | Pages that duplicate it | Proposed hook location |
|---|---|---|
| `getApplications()` for scope selector | DashboardPage, RequestAccessModal | `features/applications/api/useApplicationsQuery.js` |
| `listAppAttrDefs(appKey)` | AppAttributesPage, AppPoliciesPage, AppUsersManagementPage, PolicyTesterPage, CoverageGapsPage | `features/app-attributes/api/useAppAttrDefsQuery.js` |

**Pattern for the AccountRequestsPage:**
This page (356 lines) still uses `useEffect` + `setState` for fetching. It should be migrated to `useQuery`:

```js
// Before (AccountRequestsPage.jsx):
const [requests, setRequests] = useState([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  userService.getUsers({ status: 'pending_approval' }).then(...)
}, []);

// After:
const { data, isLoading } = useQuery({
  queryKey: ['users', 'pending_approval'],
  queryFn: () => userService.getUsers({ status: 'pending_approval' }),
});
```

---

## Phase 5: DashboardPage Decomposition

Current file: `layout/components/DashboardPage.jsx` — 469 lines

### New file: `layout/navConfig.js` (~50 lines)

Extract nav item declarations as data. Lines 132-166 move here:

```js
import {
  User, Users, FolderOpen, Layers, FileText, FlaskConical,
  AlertTriangle, ShieldCheck, Globe2, AppWindow, BarChart2,
  Tag, UserCog, ClipboardList, Building2, Boxes,
} from 'lucide-react';

export const navPersonal = [
  { id: 'my-profile', label: 'My Profile', icon: User, path: '/my-profile', show: () => true },
];

export const navAdmin = [
  { id: 'account-approvals', label: 'Account Approvals', icon: ShieldCheck, path: '/account-approvals',
    show: (roles) => roles.isHubOwner },
  { id: 'access-approvals', label: 'Access Approvals', icon: ClipboardList, path: '/access-approvals',
    show: (roles) => roles.isHubOwner || roles.isAppOwner },
];

export const navGlobal = [
  { id: 'users', label: 'Users', icon: Users, path: '/users', show: (roles) => roles.isHubOwner },
  { id: 'hub-attributes', label: 'Hub Attributes', icon: Tag, path: '/hub-attributes', show: (roles) => roles.isHubOwner },
  { id: 'global-policies', label: 'Global Policies', icon: Globe2, path: '/global-policies', show: (roles) => roles.isHubOwner },
  { id: 'applications', label: 'Applications', icon: AppWindow, path: '/applications', show: (roles) => roles.isHubOwner },
  { id: 'facilities', label: 'Facilities', icon: Building2, path: '/facilities', show: (roles) => roles.isHubOwner },
  { id: 'audit', label: 'Audit Trail', icon: BarChart2, path: '/audit', show: (roles) => roles.isHubOwner },
];

export const navApp = (roles, selectedAppId, isAppScope) => {
  const canSee = roles.isHubOwner || (roles.isAppOwner && roles.appOwnerOf.includes(selectedAppId));
  const show = canSee && isAppScope;
  return [
    { id: 'app-attributes', label: 'App Attributes', icon: Layers, path: '/app-attributes', show: () => show },
    { id: 'app-user-attributes', label: 'App Users', icon: UserCog, path: '/app-user-attributes', show: () => show },
    { id: 'app-policies', label: 'App Policies', icon: FileText, path: '/app-policies', show: () => show },
    { id: 'policy-tester', label: 'Policy Tester', icon: FlaskConical, path: '/policy-tester', show: () => show },
    { id: 'coverage-gaps', label: 'Coverage Gaps', icon: AlertTriangle, path: '/coverage-gaps', show: () => show },
    { id: 'app-resources', label: 'App Resources', icon: Boxes, path: '/app-resources', show: () => show },
  ];
};

export const navResources = [
  { id: 'resources', label: 'Resources', icon: FolderOpen, path: '/resources',
    show: (roles) => roles.isHubOwner || roles.isAppOwner },
];
```

### New file: `layout/components/NavItem.jsx` (~40 lines)

Lines 48-86 move here (already a `memo` component):

```js
import { memo } from 'react';

export const NavItem = memo(({ tab, isActive, onClick, sidebarCollapsed }) => {
  // ... existing implementation
});
```

### New file: `layout/components/TopHeader.jsx` (~50 lines)

Lines 233-273 move here:

Props: `{ effectiveRoles, onLogout, onBackToHub }`

### New file: `layout/components/ScopeSelector.jsx` (~70 lines)

Lines 304-361 move here:

Props: `{ apps, scope, selectedAppKey, selectedAppName, isGlobalScope, isAppScope, isHubOwner, sidebarCollapsed, onSelectApp, onSelectGlobal, onExpandSidebar }`

### New file: `layout/components/Sidebar.jsx` (~100 lines)

Lines 278-452 move here. Composes NavItem, ScopeSelector. Uses navConfig data.

Props: `{ effectiveRoles, scope, selectedAppKey, selectedAppName, selectedAppId, isGlobalScope, isAppScope, apps, onSelectApp, onSelectGlobal, sidebarCollapsed, onToggleSidebar, user }`

### New file: `layout/components/DashboardLayout.jsx` (~80 lines)

The orchestrator. Contains:
- useAuth(), useAbacScope(), useQuery for apps
- Auto-select logic (lines 169-179)
- Scope-URL sync (lines 183-188)
- Loading guard (lines 190-199)
- Composes TopHeader + Sidebar + `<Outlet />`

This replaces DashboardPage. The barrel `layout/index.js` exports `DashboardLayout as DashboardPage` for backward compatibility with App.jsx.

---

## Phase 6: Dead Code & Legacy Cleanup

### Files to DELETE

| File | Evidence | Safe to delete? |
|------|----------|-----------------|
| `config/index.js` | Zero consumers. grep -r "from.*@/config'" and "from.*config/index" returns 0 hits. | YES |
| `lib/index.js` | Zero consumers. grep -r "from.*@/lib'" and "from.*lib/index" returns 0 hits. | YES |
| `lib/utils.js` | After splitting to cn.js, roles.js, id.js — delete the original. | YES (after split) |
| `utils/hubUrl.js` | Zero consumers. Duplicate of config/env.js getValidHubUrl. | YES |
| `features/applications/pages/ApplicationAccessManagementPage.jsx` | No route in App.jsx. Only referenced by barrel export. No file imports from barrel for this symbol. | YES |
| `features/users/pages/UserProfileManagementPage.jsx` | No route in App.jsx (redirect to /users). Only referenced by barrel export. No file imports from barrel for this symbol. | YES |
| `features/users/pages/UsersPage.jsx` | No route in App.jsx (redirect to /users). Replaced by AbacUsersPage. Only referenced by barrel. | YES |
| `features/users/components/UserManagementTable.jsx` | Only consumer is UsersPage (being deleted). | YES |
| `features/roles/pages/RolesPage.jsx` | No route in App.jsx. Legacy RBAC page. | YES |
| `features/roles/components/RolesPermissionsView.jsx` | Only consumer is RolesPage (being deleted). | YES |
| `features/roles/api/permissionService.js` | Only consumer is RolesPermissionsView (being deleted). | YES |
| `features/roles/api/roleService.js` | Only consumer is UserProfileManagementPage (being deleted). | YES |
| `features/roles/index.js` | Only consumer is UserProfileManagementPage (being deleted). | YES |
| `features/access-requests/pages/MyRequestsPage.jsx` | No route in App.jsx. Only referenced by barrel export. | YES |
| `features/profile/pages/ApplicationRoleAssignmentsPage.jsx` | No route (redirect to /my-profile). Only in barrel. | YES |
| `features/profile/pages/UserProfilePage.jsx` | No route in App.jsx. Grep shows no external imports. | YES — verify first |
| `features/facilities/index.js` | Zero consumers. Only re-exports from layout/pages. | YES |

### Barrel files to UPDATE

| File | Change |
|------|--------|
| `features/applications/index.js` | Remove `ApplicationAccessManagementPage` export |
| `features/users/index.js` | Remove `UserProfileManagementPage`, `UsersPage` exports. Add `AbacUsersPage` export. |
| `features/access-requests/index.js` | Remove `MyRequestsPage` export |
| `features/profile/index.js` | Remove `ApplicationRoleAssignmentsPage`, `UserProfilePage` exports |

### Entire feature to DELETE

The `features/roles/` directory can be deleted entirely. All 5 files are legacy RBAC code with zero active consumers outside the feature. The ABAC system replaced it.

---

## Phase 7: File-by-File Migration Instructions

### 1. `lib/utils.js` → `lib/cn.js` + `lib/roles.js` + `lib/id.js`

**ACTION:** SPLIT then DELETE original

**WHAT MOVES WHERE:**
- `cn()` (lines 1-6) → `lib/cn.js`
- `getDisplayRole()` (lines 11-17) → `lib/roles.js`
- `generateObjectId()` (lines 22-28) → `lib/id.js`

**lib/cn.js:**
```js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

**lib/roles.js:**
```js
export function getDisplayRole(effectiveRoles) {
  if (!effectiveRoles) return "User";
  if (effectiveRoles.isHubOwner) return "Hub Owner";
  if (effectiveRoles.isAppOwner) return "App Owner";
  return "User";
}
```

**lib/id.js:**
```js
export function generateObjectId() {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

**IMPORT CHANGES:**
- `src/features/layout/components/DashboardPage.jsx`: `import { getDisplayRole } from "@/lib/utils"` → `import { getDisplayRole } from "@/lib/roles"`
- `src/features/profile/pages/MyProfilePage.jsx`: `import { getDisplayRole } from "@/lib/utils"` → `import { getDisplayRole } from "@/lib/roles"`
- `src/features/access-requests/api/accessRequestService.js`: `import { generateObjectId } from "@/lib/utils"` → `import { generateObjectId } from "@/lib/id"`
- All files importing `cn` from `@/lib/utils` → `import { cn } from "@/lib/cn"`

**VERIFICATION:**
```bash
grep -r "from.*@/lib/utils" src/ # should return 0 hits
grep -r "from.*lib/utils" src/   # should return 0 hits
```

### 2. `utils/hubUrl.js` → DELETE

**ACTION:** DELETE

**VERIFICATION:**
```bash
grep -r "hubUrl" src/  # should return 0 hits (already confirmed)
```

### 3. `config/index.js` → DELETE

**ACTION:** DELETE

**VERIFICATION:**
```bash
grep -r "from.*@/config'" src/       # should return 0 hits (already confirmed)
grep -r "from.*@/config/index" src/  # should return 0 hits
```

### 4. `lib/index.js` → DELETE

**ACTION:** DELETE

### 5. `features/abac/api/abacService.js` → SPLIT into 8 service files

**ACTION:** SPLIT

**New files created:**

**`features/hub-attributes/api/hubAttributeService.js`:**
```js
import apiClient from '@/lib/apiClient';
const v1 = (path) => `/v1${path}`;

export const hubAttributeService = {
  list: () => apiClient.get(v1('/hub-attributes')),
  create: (data) => apiClient.post(v1('/hub-attributes'), data),
  update: (id, data) => apiClient.patch(v1(`/hub-attributes/${id}`), data),
  delete: (id) => apiClient.delete(v1(`/hub-attributes/${id}`)),
};
```

**`features/global-policies/api/globalPolicyService.js`:**
```js
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
```

**`features/app-attributes/api/appAttributeService.js`:**
```js
import apiClient from '@/lib/apiClient';
const v1 = (path) => `/v1${path}`;

export const appAttributeService = {
  list: (appKey) => apiClient.get(v1(`/apps/${appKey}/attributes`)),
  listRequestable: (appKey) => apiClient.get(v1(`/apps/${appKey}/attributes/requestable`)),
  create: (appKey, data) => apiClient.post(v1(`/apps/${appKey}/attributes`), data),
  update: (appKey, id, data) => apiClient.patch(v1(`/apps/${appKey}/attributes/${id}`), data),
  delete: (appKey, id) => apiClient.delete(v1(`/apps/${appKey}/attributes/${id}`)),
};
```

**`features/app-policies/api/appPolicyService.js`:**
```js
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
```

**`features/app-users/api/appUserService.js`:**
```js
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
```

**`features/users/api/abacUserService.js`:**
```js
import apiClient from '@/lib/apiClient';
const v1 = (path) => `/v1${path}`;

export const abacUserService = {
  list: (params = {}) => apiClient.get(v1('/users'), { params }),
  get: (id) => apiClient.get(v1(`/users/${id}`)),
  create: (data) => apiClient.post(v1('/users'), data),
  update: (id, data) => apiClient.patch(v1(`/users/${id}`), data),
  listHubUserAttrs: (userId) => apiClient.get(v1(`/users/${userId}/hub-attributes`)),
  setHubUserAttr: (userId, data) => apiClient.post(v1(`/users/${userId}/hub-attributes`), data),
  deleteHubUserAttr: (userId, attributeKey) => apiClient.delete(v1(`/users/${userId}/hub-attributes/${encodeURIComponent(attributeKey)}`)),
};
```

**`features/audit/api/auditService.js`:**
```js
import apiClient from '@/lib/apiClient';
const v1 = (path) => `/v1${path}`;

export const auditService = {
  listLogs: (appKey, params) => apiClient.get(v1(`/apps/${appKey}/audit`), { params }),
  listGlobalLogs: (params) => apiClient.get(v1('/audit/global'), { params }),
  getStats: (appKey, params) => apiClient.get(v1(`/apps/${appKey}/audit/stats`), { params }),
};
```

**`features/coverage-gaps/api/coverageGapService.js`:**
```js
import apiClient from '@/lib/apiClient';
const v1 = (path) => `/v1${path}`;

export const coverageGapService = {
  get: (appKey) => apiClient.get(v1(`/apps/${appKey}/coverage-gaps`)),
};
```

**`features/policy-tester/api/evaluationService.js`:**
```js
import apiClient from '@/lib/apiClient';
const v1 = (path) => `/v1${path}`;

export const evaluationService = {
  evaluate: (appKey, data) => apiClient.post(v1(`/evaluate/${appKey}`), data),
};
```

**`features/resource-classifications/api/classificationService.js`:**
```js
import apiClient from '@/lib/apiClient';
const v1 = (path) => `/v1${path}`;

export const classificationService = {
  list: () => apiClient.get(v1('/resource-classifications')),
  create: (data) => apiClient.post(v1('/resource-classifications'), data),
  update: (id, data) => apiClient.patch(v1(`/resource-classifications/${id}`), data),
  delete: (id) => apiClient.delete(v1(`/resource-classifications/${id}`)),
};
```

**Add `getAbacApplications` to existing `applicationService.js`:**
```js
// Add to features/applications/api/applicationService.js:
async getAbacApplications() {
  try {
    const response = await apiClient.get("/v1/abac/applications");
    return response.data;
  } catch (error) {
    throw this.handleError(error);
  }
}
```

**IMPORT CHANGES for each consuming page:**

| Consumer file | Old import | New import |
|---|---|---|
| `HubAttributesPage.jsx` | `abacService` from `../api/abacService` | `hubAttributeService` from `@/features/hub-attributes/api/hubAttributeService` + `globalPolicyService` from `@/features/global-policies/api/globalPolicyService` |
| `GlobalPoliciesPage.jsx` | `abacService` from `../api/abacService` | `globalPolicyService` from `@/features/global-policies/api/globalPolicyService` + `hubAttributeService` from `@/features/hub-attributes/api/hubAttributeService` |
| `AppAttributesPage.jsx` | `abacService` from `../api/abacService` | `appAttributeService` from `@/features/app-attributes/api/appAttributeService` |
| `AppPoliciesPage.jsx` | `abacService` from `../api/abacService` | `appPolicyService` from `@/features/app-policies/api/appPolicyService` + `appAttributeService` from `@/features/app-attributes/api/appAttributeService` |
| `AppUsersManagementPage.jsx` | `abacService` from `../api/abacService` | `appUserService` from `@/features/app-users/api/appUserService` + `appAttributeService` from `@/features/app-attributes/api/appAttributeService` |
| `AppUserAttributesPage.jsx` | `abacService` from `../api/abacService` | `appUserService` from `@/features/app-users/api/appUserService` + `appAttributeService` from `@/features/app-attributes/api/appAttributeService` |
| `AppUserAttributesPanel.jsx` | `abacService` from `../api/abacService` | `appUserService` from `@/features/app-users/api/appUserService` |
| `AssignUserDialog.jsx` | `abacService` from `../api/abacService` | `appUserService` from `@/features/app-users/api/appUserService` + `abacUserService` from `@/features/users/api/abacUserService` + `appAttributeService` from `@/features/app-attributes/api/appAttributeService` |
| `CoverageGapsPage.jsx` | `abacService` from `../api/abacService` | `coverageGapService` from `@/features/coverage-gaps/api/coverageGapService` + `appAttributeService` from `@/features/app-attributes/api/appAttributeService` |
| `PolicyTesterPage.jsx` | `abacService` from `../api/abacService` | `evaluationService` from `@/features/policy-tester/api/evaluationService` + others as needed |
| `ResourceClassificationsPage.jsx` | `abacService` from `../api/abacService` | `classificationService` from `@/features/resource-classifications/api/classificationService` |
| `AbacApplicationsPage.jsx` | `abacService`, `apiClient` | `applicationService` from `@/features/applications/api/applicationService` |
| `AbacUsersPage.jsx` | `abacService`, `userService` | `abacUserService` from `@/features/users/api/abacUserService` + `userService` |
| `AuditPage.jsx` | `abacService` from `../../abac/api/abacService` | `auditService` from `@/features/audit/api/auditService` |
| `DashboardPage.jsx` | `abacService` from `../../abac/api/abacService` | `applicationService` from `@/features/applications/api/applicationService` (use `getAbacApplications`) |
| `RequestAccessModal.jsx` | `abacService` from `@/features/abac/api/abacService` | `appAttributeService` from `@/features/app-attributes/api/appAttributeService` |

**VERIFICATION:**
```bash
grep -r "abacService" src/ # should return 0 hits after migration
grep -r "features/abac/api" src/ # should return 0 hits
```

### 6. `features/abac/contexts/AbacScopeContext.jsx` → `features/scope/AbacScopeContext.jsx`

**ACTION:** MOVE

**IMPORT CHANGES:**
- `App.jsx`: `from "@/features/abac/contexts/AbacScopeContext"` → `from "@/features/scope"`
- `DashboardPage.jsx`: `from "../../abac/contexts/AbacScopeContext"` → `from "@/features/scope"`
- All pages using `useAbacScope`: update `from "../contexts/AbacScopeContext"` → `from "@/features/scope"`

**VERIFICATION:**
```bash
grep -r "abac/contexts" src/ # should return 0 hits
```

### 7. ABAC pages → their new feature homes

**ACTION:** MOVE (each file)

Example for HubAttributesPage:
- `features/abac/pages/HubAttributesPage.jsx` → `features/hub-attributes/HubAttributesPage.jsx`
- Update App.jsx lazy import path
- Update all internal imports (service, scope context)

Repeat for each page listed in the Phase 2 structure.

**VERIFICATION:**
```bash
grep -r "features/abac/pages" src/ # should return 0 hits after all moves
ls src/features/abac/ # directory should not exist
```

### 8. `features/layout/pages/FacilitiesPage.jsx` → `features/facilities/FacilitiesPage.jsx`

**ACTION:** MOVE

**IMPORT CHANGES:**
- `App.jsx`: `from "@/features/layout/pages/FacilitiesPage"` → `from "@/features/facilities/FacilitiesPage"`

**VERIFICATION:**
```bash
grep -r "layout/pages" src/ # should return 0 hits
```

### 9. Legacy file deletions

**ACTION:** DELETE each file listed in Phase 6

For each:
1. Verify no active route in App.jsx
2. Verify no import from any non-barrel file
3. Remove from barrel exports
4. Delete file

**Deletion order:**
1. `features/roles/` — entire directory (5 files)
2. `features/users/pages/UserProfileManagementPage.jsx`
3. `features/users/pages/UsersPage.jsx`
4. `features/users/components/UserManagementTable.jsx`
5. `features/applications/pages/ApplicationAccessManagementPage.jsx`
6. `features/access-requests/pages/MyRequestsPage.jsx`
7. `features/profile/pages/ApplicationRoleAssignmentsPage.jsx`
8. `features/profile/pages/UserProfilePage.jsx`

### 10. DashboardPage split

**ACTION:** SPLIT (see Phase 5 for detailed block assignments)

Order:
1. Create `layout/navConfig.js`
2. Extract `layout/components/NavItem.jsx`
3. Extract `layout/components/TopHeader.jsx`
4. Extract `layout/components/ScopeSelector.jsx`
5. Extract `layout/components/Sidebar.jsx`
6. Create `layout/components/DashboardLayout.jsx`
7. Update `layout/index.js` to export `DashboardLayout as DashboardPage`
8. Delete old `layout/components/DashboardPage.jsx`

---

## Phase 8: Risk Register

### High risk

1. **ResourceClassificationsPage has no route in App.jsx and zero consumers.** Confirmed dead code — no file imports it, no route references it. **Decision:** DELETE the page. Keep `classificationService.js` only if resource classification data is consumed by other pages (e.g., AppResourcesTab uses classifications). Otherwise delete it too.

2. **UserProfilePage.jsx deletion.** Confirmed: no route in App.jsx, no file imports it except its own barrel. The only "user-profile" reference is the legacy redirect `user-profile-management → /users`. Safe to delete.

3. **DashboardPage split may break sidebar behavior.** The sidebar has subtle interaction between scope state, localStorage, auto-select, and URL sync. Test thoroughly after split:
   - App Owner with 1 app → should auto-select
   - Navigate to global path while in app scope → should switch to global
   - Collapse/expand → should persist across refreshes

### Medium risk

4. **`accessRequestService` imports `generateObjectId` but never calls it.** The import on line 2 is dead code — `generateObjectId` is not referenced anywhere in the file body. Remove the import entirely rather than updating the path. This means `lib/id.js` may have zero consumers and can be deleted too (verify no other file imports it).

5. **`abacService.getApplications()` returns Axios response, not plain data.** The DashboardPage already handles this with `normalizeApplicationsList()`. When moving to `applicationService.getAbacApplications()`, ensure the same response shape is returned (full Axios response).

6. **Cross-feature imports of `appAttributeService`.** After splitting, 6+ pages import this service across 4 features. This is expected (it's a shared domain concept). But watch for circular dependency if `app-attributes` ever imports from `app-policies` or vice versa.

### Low risk

7. **Barrel file changes.** Components imported from barrels (e.g., `from "@/features/resources"`) might break if the barrel is updated. Grep for every barrel import before modifying.

8. **`lib/queryKeys.js` updates.** The QK registry doesn't need restructuring — it's already organized by domain. Just verify all query keys still resolve after page moves.

9. **Service pattern inconsistency.** The new service files use plain object exports (`export const xxxService = { ... }`). Existing services like `accessRequestService`, `userService`, `applicationService`, `resourceService`, `profileService` are class-based. The prompt says to standardize to plain functions. Recommendation: do NOT convert existing class-based services in this refactoring — it would touch every consumer and risk regressions. Standardize incrementally. New service files should use the plain object pattern.

---

## Execution Order

Recommended sequence to minimize breakage:

1. **Delete dead files first** — no import changes needed, pure subtraction
2. **Split `lib/utils.js`** — small, isolated, easy to verify
3. **Delete `utils/`, `config/index.js`, `lib/index.js`** — zero consumers
4. **Move `AbacScopeContext`** to `features/scope/` — affects many imports but no logic change
5. **Split `abacService.js`** into domain services — the biggest change, do one feature at a time
6. **Move ABAC pages** to their new feature homes — update imports in each page + App.jsx
7. **Move `FacilitiesPage`** from layout to facilities
8. **Move `AbacUsersPage`** to users feature
9. **Move `AbacApplicationsPage`** to applications feature
10. **Split `DashboardPage`** — do last since it's the riskiest UI change
11. **Update barrel files** — final cleanup
12. **Run full test suite + manual testing** of all routes
