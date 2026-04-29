# IAM Frontend

**Identity & Access Management (IAM)** — a standalone React single-page application for the platform hub. It provides **ABAC (Attribute-Based Access Control)** administration, **user and account workflows**, **resource registration**, **audit and policy tooling**, and **profile** management. The app is launched from the **Hub** after authentication and talks to the platform **backend API** over HttpOnly cookies.

---

## Table of contents

1. [Purpose and scope](#purpose-and-scope)
2. [Technology stack](#technology-stack)
3. [High-level architecture](#high-level-architecture)
4. [Repository layout](#repository-layout)
5. [Application bootstrap and providers](#application-bootstrap-and-providers)
6. [Routing and pages](#routing-and-pages)
7. [Navigation, roles, and ABAC scope](#navigation-roles-and-abac-scope)
8. [Data layer: API client and services](#data-layer-api-client-and-services)
9. [Authentication and session](#authentication-and-session)
10. [Configuration (environment variables)](#configuration-environment-variables)
11. [Build, test, and quality](#build-test-and-quality)
12. [Deployment and CI/CD](#deployment-and-cicd)
13. [Related documentation](#related-documentation)

---

## Purpose and scope

The IAM Frontend is the **administrative and self-service UI** for:

- **Global (hub-wide) configuration**: users, hub attribute definitions, resource classifications, global policies, application registry (ABAC "applications" list).
- **Per-application configuration**: app attribute definitions, per-user app attributes, app policies, policy evaluation ("policy tester"), audit trail, coverage gap analysis — all scoped to a **selected application** when in **App** scope.
- **Cross-cutting**: resource management (registering/linking resources), account approval queues, access request review, signed-in user profile.

It is **not** the Hub Login screen itself; users typically sign in via the Hub, then open IAM with a **session handoff** (see [Authentication and session](#authentication-and-session)).

---

## Technology stack

| Area | Choice |
|------|--------|
| UI | **React 18** (`react`, `react-dom`) |
| Build / dev server | **Vite 5** |
| Routing | **React Router 6** (`BrowserRouter`, nested routes) |
| Server state / caching | **TanStack Query 5** (`@tanstack/react-query`) |
| HTTP | **Axios** via `src/lib/apiClient.js` singleton |
| Styling | **Tailwind CSS** + **tailwindcss-animate** |
| Components | **Radix UI** primitives (accordion, avatar, checkbox, dialog, dropdown-menu, label, popover, progress, scroll-area, select, separator, slot, switch, tabs, toast, tooltip) + local **`src/components/ui`** (shadcn-style wrappers using `class-variance-authority`, `clsx`, `tailwind-merge`) |
| Forms / validation | **react-hook-form** v7, **zod**, **@hookform/resolvers** |
| OAuth | **@react-oauth/google** (`GoogleOAuthProvider` in `main.jsx`) |
| Icons | **lucide-react**, **react-icons** |
| Notifications | **react-hot-toast** + Radix `@radix-ui/react-toast` wrapper |
| Date utilities | **date-fns** |
| Client state (minimal) | **zustand** (available; primary state is TanStack Query + React context) |

Path alias: **`@/` → `src/`** (see `vite.config.js`).

---

## High-level architecture

```mermaid
flowchart LR
  subgraph hub [Hub / Login]
    Login[Login & handoff]
  end
  subgraph iam [IAM Frontend]
    Main[main.jsx handoff + GoogleOAuth]
    App[App.jsx routes]
    Auth[AuthProvider]
    Abac[AbacScopeProvider]
    Pages[Feature pages]
    Main --> App
    App --> Auth
    App --> Abac
    Auth --> Pages
    Abac --> Pages
  end
  subgraph api [Backend API]
    REST["/api/..."]
  end
  Login -->|"?handoffCode="| Main
  Pages -->|HttpOnly cookies| REST
```

1. **`main.jsx`** runs **before** React mounts: redirects `*.azurestaticapps.net` to `https://iam.dizzaroo.com` (preserving query string), resolves `?handoffCode=` from the URL and exchanges it via **`initializeAuthFromUrl()`** (a native `fetch` to `/api/auth/handoff/exchange` with `credentials: "include"`), then wraps the tree in **`GoogleOAuthProvider`** inside an `AppErrorBoundary` and mounts **`App`**. If `VITE_GOOGLE_CLIENT_ID` is missing the `Root` component renders a configuration error page instead.
2. **`App.jsx`** wraps the app with **`QueryClientProvider`**, **`BrowserRouter`**, **`AuthProvider`**, and **`AbacScopeProvider`**, then mounts `AppRoutes` which defines all routes.
3. **Feature modules** under `src/features/*` own pages, feature-specific API modules, and small components/hooks.
4. **`lib/apiClient.js`** — an Axios instance with `withCredentials: true`, request/response interceptors for `X-Request-Id` correlation headers, structured logging, and **401 → redirect to Hub login** (bypassed in dev mode).

---

## Repository layout

```
IAM-Frontend/
├── azure-pipelines.yml       # CI: install, build, copy SWA config, deploy
├── env.example               # Template for Vite env vars (copy to .env)
├── index.html
├── package.json
├── staticwebapp.config.json  # Azure Static Web Apps: SPA fallback, security headers
├── vite.config.js            # Alias @→src, dev server :5001, /api proxy, build chunks
└── src/
    ├── App.jsx               # Routes and providers
    ├── main.jsx              # Handoff exchange, azurestaticapps.net redirect, Google OAuth, error boundary, mount
    ├── index.css             # Global styles / Tailwind
    ├── __tests__/            # Vitest setup
    ├── components/ui/        # Shared primitives: badge, button, card, checkbox, dialog,
    │                         # IconPickerField, input, label, popover, select, separator,
    │                         # switch, tabs, textarea, toast, toaster
    ├── config/
    │   ├── env.js            # VITE_* readers and URL helpers (getApiBaseURL, getAxiosBaseURL, getValidHubUrl)
    │   ├── index.js          # Barrel re-export
    │   └── queryClient.js    # TanStack Query defaults (staleTime 5 min, retry 1, no refetchOnWindowFocus)
    ├── features/
    │   ├── abac/
    │   │   ├── api/abacService.js             # All /v1/... ABAC API calls
    │   │   ├── contexts/AbacScopeContext.jsx  # scope, selectedAppKey/Name/Id + localStorage persistence
    │   │   └── pages/
    │   │       ├── AbacApplicationsPage.jsx   # Application registry (Hub Owner, global scope)
    │   │       ├── AbacUsersPage.jsx           # User listing with hub attribute management
    │   │       ├── AppAttributesPage.jsx       # App attribute definition CRUD
    │   │       ├── AppPoliciesPage.jsx         # App policy CRUD + status + version history
    │   │       ├── AppUserAttributesPage.jsx   # (Component file; integrated via AppUsersManagementPage)
    │   │       ├── AppUserAttributesPanel.jsx  # Panel used inside AppUsersManagementPage
    │   │       ├── AppUsersManagementPage.jsx  # App user list + inline attribute assignment
    │   │       ├── AssignUserDialog.jsx        # Dialog for assigning a user to an app with resources
    │   │       ├── CoverageGapsPage.jsx        # Users with no ABAC coverage
    │   │       ├── GlobalPoliciesPage.jsx      # Global policy CRUD + status + version history
    │   │       ├── HubAttributesPage.jsx       # Hub attribute definition CRUD
    │   │       ├── PolicyTesterPage.jsx        # Interactive ABAC evaluation runner
    │   │       └── ResourceClassificationsPage.jsx  # Resource classification management
    │   ├── access-requests/
    │   │   ├── api/accessRequestService.js    # /access-requests CRUD (class-based)
    │   │   ├── components/RequestAccessModal.jsx  # Modal for submitting new access requests
    │   │   ├── index.js
    │   │   └── pages/
    │   │       ├── AccessRequestsPage.jsx     # Hub Owner / IT Support / App Owner review queue
    │   │       └── MyRequestsPage.jsx         # End-user's own request history (file exists; not in active routes)
    │   ├── applications/
    │   │   ├── api/applicationService.js      # /applications reads for non-ABAC flows
    │   │   ├── index.js
    │   │   └── pages/ApplicationAccessManagementPage.jsx  # (Legacy; replaced by active routes)
    │   ├── audit/
    │   │   ├── index.js
    │   │   └── pages/AuditPage.jsx            # Audit log browser with stats
    │   ├── auth/
    │   │   ├── components/ProtectedRoute.jsx  # Redirects unauthenticated users
    │   │   ├── contexts/
    │   │   │   ├── AuthContext.js             # Context shape + DEFAULT_EFFECTIVE_ROLES
    │   │   │   └── AuthProvider.jsx           # verify-on-mount, effectiveRoles derivation, logout
    │   │   ├── hooks/useAuth.js               # Context consumer hook
    │   │   ├── index.js
    │   │   └── utils/authInit.js              # initializeAuthFromUrl, isValidToken, getStoredToken, key constants
    │   ├── layout/
    │   │   ├── components/DashboardPage.jsx   # Collapsible sidebar, scope switcher, nav groups, top header
    │   │   └── index.js
    │   ├── profile/
    │   │   ├── api/profileService.js          # /users/me/... endpoints
    │   │   ├── index.js
    │   │   └── pages/
    │   │       ├── ApplicationRoleAssignmentsPage.jsx  # (Legacy)
    │   │       ├── MyProfilePage.jsx           # Current user profile view/edit
    │   │       └── UserProfilePage.jsx         # Admin view of a specific user's profile
    │   ├── resources/
    │   │   ├── api/resourceService.js          # /resources CRUD and application linkage
    │   │   ├── components/                     # ApplicationMultiSelect, EditResourceModal,
    │   │   │                                   # L2ContainerSelect, ResourceManagementTab,
    │   │   │                                   # ResourceRegistrationModal
    │   │   ├── config/resourceTypeConfig.js    # Resource type definitions and metadata
    │   │   ├── hooks/useResourceForm.js        # Form state helper
    │   │   ├── index.js
    │   │   └── pages/ResourceManagementPage.jsx
    │   ├── roles/
    │   │   ├── api/permissionService.js        # Permission helpers
    │   │   ├── api/roleService.js              # Role helpers
    │   │   ├── components/RolesPermissionsView.jsx
    │   │   ├── index.js
    │   │   └── pages/RolesPage.jsx             # (Legacy RBAC; superseded by ABAC)
    │   └── users/
    │       ├── api/userService.js              # Full user CRUD + assignments + approvals (class-based)
    │       ├── components/
    │       │   ├── AssignManagerModal.jsx       # Assign/remove APP_MANAGER role
    │       │   ├── UserForm.jsx                 # Create/edit user form
    │       │   └── UserManagementTable.jsx      # Paginated user table
    │       ├── index.js
    │       └── pages/
    │           ├── AccountRequestsPage.jsx      # Account approval queue
    │           ├── UserProfileManagementPage.jsx  # (Legacy; redirected to /users)
    │           └── UsersPage.jsx                # (Legacy; superseded by AbacUsersPage)
    ├── hooks/
    │   └── use-toast.js                        # Toast hook wired to Radix toast
    ├── lib/
    │   ├── apiClient.js    # Axios instance — x-request-id, structured logging, cookie auth, 401 handler
    │   ├── index.js
    │   ├── logger.js       # Browser-side structured logger: [UI_LOG] console entries, sensitive-field redaction
    │   └── utils.js        # cn() (tailwind merge), getDisplayRole(), generateObjectId()
    └── utils/
        ├── authInit.js     # Re-export of features/auth/utils/authInit (for legacy imports)
        └── hubUrl.js       # getValidHubUrl re-export
```

**Note:** The **active route tree** is defined entirely in **`App.jsx`**. Several page components under `features/` exist for reuse or legacy compatibility only — prefer `App.jsx` as the source of truth for what ships.

---

## Application bootstrap and providers

### Bootstrap sequence (`main.jsx`)

| Step | What happens |
|------|-------------|
| **1. Domain redirect** | If `window.location.hostname.endsWith("azurestaticapps.net")`, redirect to `https://iam.dizzaroo.com` preserving the query string (so `?handoffCode=` is not lost). |
| **2. Handoff exchange** | `initializeAuthFromUrl()` reads `?handoffCode=` (or hash fallback), POSTs to `/api/auth/handoff/exchange` via `fetch` with `credentials: "include"`, caches the returned `user` in `localStorage` (`platform_user`), strips `handoffCode` from the URL via `history.replaceState`. |
| **3. React mount** | `ReactDOM.createRoot` renders `<React.StrictMode><AppErrorBoundary><Root /></AppErrorBoundary></React.StrictMode>`. |
| **4. Google guard** | `Root` checks `VITE_GOOGLE_CLIENT_ID`. If missing/empty, renders a configuration error page; otherwise wraps `<App>` in `<GoogleOAuthProvider>`. |

### Provider stack (`App.jsx`)

| Provider | Responsibility |
|----------|---------------|
| **`QueryClientProvider`** | TanStack Query: `staleTime` 5 min, `retry: 1`, `refetchOnWindowFocus: false`. |
| **`BrowserRouter`** | React Router 6 browser history. |
| **`AuthProvider`** | On mount calls `POST /api/auth/verify` (15 s timeout) to hydrate the user from the session cookie. On success: stores user in `localStorage` and React state. On failure: clears storage and redirects to `${HUB_URL}/login` (skipped in dev mode). Exposes `user`, `loading`, `isAuthenticated`, `logout`, **`effectiveRoles`** (memoized), `rolesReady`. |
| **`AbacScopeProvider`** | Manages `scope` (`"global"` \| `"app"`), `selectedAppKey`, `selectedAppName`, `selectedAppId`. Persists selection to `localStorage` under key `abac.scope`. Exports `selectApp(key, name, id?)` and `selectGlobal()` actions, and `useAbacScope()` hook. |

---

## Routing and pages

All authenticated app routes are nested under `/` and wrapped by **`ProtectedRoute`** + **`DashboardPage`** (`src/App.jsx`).

### Active routes

| Path | Component | Role / scope (typical) |
|------|-----------|------------------------|
| `/` (index) | Redirect | → role-based default (see below) |
| `/my-profile` | `MyProfilePage` | All authenticated users |
| `/resources` | `ResourceManagementPage` | Hub Owner or App Owner |
| `/users` | `AbacUsersPage` | Hub Owner — global scope |
| `/applications` | `AbacApplicationsPage` | Hub Owner — global scope |
| `/account-approvals` | `AccountRequestsPage` | Hub Owner or IT Support |
| `/access-approvals` | `AccessRequestsPage` | Hub Owner, IT Support, or App Owner |
| `/audit` | `AuditPage` | Hub Owner or App Owner — app scope |
| `/hub-attributes` | `HubAttributesPage` | Hub Owner — global scope |
| `/global-policies` | `GlobalPoliciesPage` | Hub Owner — global scope |
| `/app-attributes` | `AppAttributesPage` | Hub Owner or App Owner — app scope |
| `/app-user-attributes` | `AppUsersManagementPage` | Hub Owner or App Owner — app scope |
| `/app-users` | `AppUsersManagementPage` | Hub Owner or App Owner — app scope (alias) |
| `/app-policies` | `AppPoliciesPage` | Hub Owner or App Owner — app scope |
| `/policy-tester` | `PolicyTesterPage` | Hub Owner or App Owner — app scope |
| `/coverage-gaps` | `CoverageGapsPage` | Hub Owner or App Owner — app scope |

### Default redirect (index route)

After login, `/` redirects based on **`effectiveRoles`**:

- **Hub Owner** → `/users`
- **App Owner** → `/app-policies`
- **IT Support** → `/account-approvals`
- Otherwise → `/my-profile`

### Backward-compatibility redirects

| Old path | Redirects to |
|----------|-------------|
| `/profile` | `/my-profile` |
| `/account-requests` | `/account-approvals` |
| `/access-requests` | `/access-approvals` |
| `/application-role-assignments` | `/my-profile` |
| `/user-profile-management` | `/users` |
| `/resource-management` | `/resources` |
| `/application-access-management` | `/applications` |

### Other routes

- **`/unauthorized`** — "Access Denied" page with a "Back to Hub" button (`getValidHubUrl()`).
- **`*`** — simple "Page not found".

---

## Navigation, roles, and ABAC scope

### Effective roles (`AuthProvider`)

Derived from the **`user`** object returned by `POST /api/auth/verify`. Computed via `useMemo` so identity is stable across renders:

| Flag | Condition |
|------|-----------|
| `isHubOwner` | `user.hubRoles` contains `"HUB_OWNER"` |
| `isITSupport` | `user.hubRoles` contains `"IT_SUPPORT"` |
| `isAppOwner` | `user.ownedAppIds` array is non-empty (populated by backend from `application_owners` table) |
| `isAppManager` | `appManagerOf` array is non-empty (currently always empty; reserved for future use) |
| `isElevated` | Any of the above |
| `canAccessAdmin` | Any of the above |
| `appOwnerOf` | `user.ownedAppIds` array (application IDs) |
| `appManagerOf` | `[]` (reserved) |

`getDisplayRole(effectiveRoles)` (from `lib/utils.js`) returns `"Hub Owner"`, `"IT Support"`, `"App Owner"`, `"App Manager"`, or `"User"` for the sidebar footer.

### Sidebar nav groups (`DashboardPage`)

The sidebar is **collapsible** (state persisted to `localStorage` as `iam_sidebar_collapsed`). When collapsed, nav items show only their icon with a tooltip. Nav sections are conditionally rendered based on role and scope:

| Section | `show` condition | Items |
|---------|-----------------|-------|
| **Personal** | Always | My Profile |
| **Administration** | `isHubOwner \|\| isAppOwner` | Account Approvals (Hub Owner/IT Support only), Access Approvals (Hub Owner/IT Support/App Owner) |
| **Application selector** | `isHubOwner \|\| isAppOwner` | Inline `<select>` listing all ABAC apps + "Hub Management" option for Hub Owners |
| **Hub Config** | `isHubOwner && scope === 'global'` | Users, Hub Attributes, Global Policies, Applications |
| **`{AppName}` Settings** | `(isHubOwner \|\| isAppOwner) && scope === 'app' && app selected` | App Attributes, App Users, App Policies, Policy Tester, Audit Trail, Coverage Gaps |
| **Resources** | `isHubOwner \|\| isAppOwner` | Resources |

**Auto-select:** If the signed-in user is an App Owner (but not Hub Owner) and owns exactly one app, `DashboardPage` calls `selectApp()` on first load to automatically enter app scope.

**Back to Hub:** The header "Back" button navigates to `getValidHubUrl() + "/hub"`.

### Global vs App scope (`AbacScopeContext`)

- **Global** (`scope === 'global'`): configure hub-wide users, hub attribute definitions, resource classifications, global policies, and the application list.
- **App** (`scope === 'app'`): select an application from the dropdown (populated from `abacService.getApplications()` → `GET /api/v1/abac/applications`) to manage that app's attributes, policies, audit, and coverage gaps.

Scope selection (including `key`, `name`, and `id`) is persisted to `localStorage` under key `abac.scope` and restored on page load.

---

## Data layer: API client and services

### `apiClient` (`src/lib/apiClient.js`)

- **Base URL**: `getAxiosBaseURL()` → `/api` (same-origin Vite proxy) in dev; `${VITE_API_URL}/api` in production. Keeps HttpOnly cookies on the correct `:5001` origin in dev.
- **Auth**: entirely **cookie-based** (`withCredentials: true`). No `Authorization` header — the HttpOnly `access_token` cookie is sent automatically.
- **Request interceptor**: generates a `X-Request-Id` UUID via `crypto.randomUUID()` (fallback: `Date.now()` + random), attaches it as a header, records `startedAt` via `performance.now()`, logs via `logger.info` (with sanitized payload).
- **Response interceptor**: logs `statusCode` and `durationMs`. On **401**: clears `platform_user` from `localStorage` and redirects to `${HUB_URL}/login` — bypassed when `import.meta.env.DEV`, `VITE_DEV_MODE === "true"`, or `localStorage.getItem("dev_mode") === "true"`.
- **Timeout**: 15 s default.
- **Logger** (`lib/logger.js`): emits `[UI_LOG]` structured console entries `{ timestamp, userId, route, level, message, metadata }`. Redacts `password`, `token`, `secret`, `authorization`, `cookie` up to depth 4.

### Service modules

| Module | File | Purpose |
|--------|------|---------|
| **ABAC** | `features/abac/api/abacService.js` | Hub/app attribute definitions, hub user attributes, app user attributes, resource classifications, global/app policies (status, versions, rollback), app user assignment, evaluation, audit logs + stats, coverage gaps, applications list. All calls use `/v1/...` paths. |
| **Access requests** | `features/access-requests/api/accessRequestService.js` | Full `/access-requests` CRUD — create, list (all or by user), get, update, approve, reject, cancel, delete, stats. Class-based; reads current user from `localStorage`. |
| **Users** | `features/users/api/userService.js` | User listing (with search/filter/pagination), CRUD, assignment CRUD, account approve/reject, `getUserStats`, app team lookup, assign/remove App Manager. Class-based. |
| **Profile** | `features/profile/api/profileService.js` | Current user `/users/me/...` endpoints. |
| **Resources** | `features/resources/api/resourceService.js` | `/resources` CRUD and application linkage. |
| **Applications** | `features/applications/api/applicationService.js` | `/applications` reads for non-ABAC flows. |
| **Roles** | `features/roles/api/{roleService,permissionService}.js` | Legacy RBAC helpers; not in active nav. |

**Response envelope:** Backend responses use `{ success, data }`. Components and React Query `queryFn`s normalize nested `data` where needed (e.g. `normalizeApplicationsList` in `DashboardPage.jsx`).

### Key `abacService` endpoints

| Method | Endpoint |
|--------|----------|
| `getApplications()` | `GET /v1/abac/applications` |
| `listHubAttrDefs()` | `GET /v1/hub-attributes` |
| `createHubAttrDef(data)` | `POST /v1/hub-attributes` |
| `updateHubAttrDef(id, data)` | `PATCH /v1/hub-attributes/:id` |
| `deleteHubAttrDef(id)` | `DELETE /v1/hub-attributes/:id` |
| `listHubUserAttrs(userId)` | `GET /v1/users/:userId/hub-attributes` |
| `setHubUserAttr(userId, data)` | `POST /v1/users/:userId/hub-attributes` |
| `deleteHubUserAttr(userId, key)` | `DELETE /v1/users/:userId/hub-attributes/:key` |
| `listGlobalPolicies(params)` | `GET /v1/global-policies` |
| `setGlobalPolicyStatus(id, status)` | `PATCH /v1/global-policies/:id/status` |
| `getGlobalPolicyVersions(id)` | `GET /v1/global-policies/:id/versions` |
| `rollbackGlobalPolicy(id, version)` | `POST /v1/global-policies/:id/rollback/:version` |
| `listClassifications()` | `GET /v1/resource-classifications` |
| `listAppAttrDefs(appKey)` | `GET /v1/apps/:appKey/attributes` |
| `listRequestableAppAttrDefs(appKey)` | `GET /v1/apps/:appKey/attributes/requestable` |
| `listAppUsers(appKey)` | `GET /v1/apps/:appKey/users` |
| `assignAppUser(appKey, data)` | `POST /v1/apps/:appKey/users/assign` |
| `listAppUserAttrs(appKey, userId)` | `GET /v1/apps/:appKey/users/:userId/attributes` |
| `setAppUserAttr(appKey, userId, data)` | `POST /v1/apps/:appKey/users/:userId/attributes` |
| `deleteAppUserAttr(appKey, userId, attrDefId)` | `DELETE /v1/apps/:appKey/users/:userId/attributes/:id` |
| `listAppPolicies(appKey, params)` | `GET /v1/apps/:appKey/policies` |
| `setAppPolicyStatus(appKey, id, status)` | `PATCH /v1/apps/:appKey/policies/:id/status` |
| `getAppPolicyVersions(appKey, id)` | `GET /v1/apps/:appKey/policies/:id/versions` |
| `rollbackAppPolicy(appKey, id, version)` | `POST /v1/apps/:appKey/policies/:id/rollback/:version` |
| `evaluate(appKey, data)` | `POST /v1/evaluate/:appKey` |
| `listAuditLogs(appKey, params)` | `GET /v1/apps/:appKey/audit` |
| `getAuditStats(appKey, params)` | `GET /v1/apps/:appKey/audit/stats` |
| `getCoverageGaps(appKey)` | `GET /v1/apps/:appKey/coverage-gaps` |

---

## Authentication and session

1. **Hub handoff:** Hub navigates to IAM with `?handoffCode=` in the URL. Before React mounts, `initializeAuthFromUrl` reads the code (query string, or hash fallback for router edge cases), POSTs to **`/api/auth/handoff/exchange`** via native `fetch` with `credentials: "include"` so the backend sets **HttpOnly cookies** (`access_token`, `refresh_token`). The user object from the response body is cached in `localStorage` under `platform_user` for instant UI render. The `handoffCode` param is stripped via `history.replaceState`.

2. **Session validation on mount:** `AuthProvider` calls `POST /api/auth/verify` (15 s timeout) to get the canonical user object. On success it stores the user and sets `isAuthenticated = true`. On failure it clears storage and redirects to `${HUB_URL}/login` (skipped in `DEV` mode or when `localStorage.getItem("dev_mode") === "true"`).

3. **No legacy token params:** URL `accessToken` / `access_token` query parameters are not accepted. All session state flows through HttpOnly cookies only.

4. **Logout:** `AuthProvider.logout()` calls `POST /auth/logout` (best-effort), clears `platform_user` from `localStorage`, attempts `window.opener.postMessage({ type: "dizzaroo-hub-auth", action: "session-ended" })` to notify the Hub tab, then redirects to `${HUB_URL}/logout`.

Storage key constants (from `authInit.js`):

| Constant | Value | Purpose |
|----------|-------|---------|
| `PLATFORM_TOKEN_KEY` | `"access_token"` | Used only for legacy reads; tokens are in HttpOnly cookies |
| `PLATFORM_USER_KEY` | `"platform_user"` | Cached user object for UI until `verify` completes |

`isValidToken(token)` decodes the JWT payload and checks the `exp` claim (with 30 s buffer) — used for local validation only.

---

## Configuration (environment variables)

Vite exposes only variables prefixed with **`VITE_`**. Copy **`env.example`** to **`.env`** and adjust.

| Variable | Required | Purpose |
|----------|----------|---------|
| **`VITE_API_URL`** | Yes (production) | Backend origin **without** trailing slash or `/api` (e.g. `https://api.example.com`). In dev, `apiClient` uses `/api` (same-origin Vite proxy); `VITE_API_URL` is used for absolute URL construction via `getApiBaseURL()`. Falls back to `http://localhost:4001` in dev if unset. |
| **`VITE_HUB_URL`** | Yes | Hub base URL for redirects and "Back to Hub". Falls back to `https://hub.dizzaroo.com` in production if unset or invalid (guards against unexpanded pipeline variable placeholders like `$(var)`); dev falls back to `http://localhost:5000`. |
| **`VITE_GOOGLE_CLIENT_ID`** | **Yes at runtime** | Google OAuth Web client ID. Missing or empty causes the app to render a configuration error page. |
| `VITE_DEV_MODE` | Optional | Set to `"true"` to suppress Hub login redirects on 401 (same effect as `localStorage.setItem("dev_mode", "true")`). |

**`config/env.js` URL helpers:**

| Function | Returns |
|----------|---------|
| `getApiBaseURL()` | Absolute API origin (no `/api`) — uses `VITE_API_URL`, falls back to `http://localhost:4001` in dev |
| `getAxiosBaseURL()` | Axios `baseURL` — `/api` (same-origin) in dev, `${VITE_API_URL}/api` in production |
| `getValidHubUrl()` | Hub URL; validates `http(s)://` prefix and rejects unexpanded pipeline variable strings |

**`env` object** (exported from `config/env.js`): `{ API_BASE_URL, AXIOS_BASE_URL, HUB_URL, GOOGLE_CLIENT_ID, getApiBaseURL, getAxiosBaseURL, getValidHubUrl }`.

**Local dev proxy:** `vite.config.js` proxies **`/api`** to `VITE_API_URL || http://localhost:4001` — this is what makes HttpOnly cookies work in dev (cookies are stored on the `:5001` origin the browser sees).

---

## Build, test, and quality

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server on **port 5001** |
| `npm run build` | Production build to **`dist/`** |
| `npm run preview` / `npm start` | Preview production build on port **5001** |
| `npm run lint` | ESLint (`js`/`jsx`) |
| `npm test` | **Vitest** (jsdom, `@testing-library/react`) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage via **v8** |

Test setup: `src/__tests__/setup.js` with `@testing-library/jest-dom` matchers.

---

## Deployment and CI/CD

- **`azure-pipelines.yml`**: Node **20.x**, `npm ci || npm install`, `npm run build` (pipeline variables supply `VITE_API_URL`, `VITE_HUB_URL`, `VITE_GOOGLE_CLIENT_ID`), copies `staticwebapp.config.json` into `dist/`, deploys via **Azure Static Web Apps** task (`skip_app_build: true`).
- **`staticwebapp.config.json`**: SPA **navigation fallback** to `index.html`, security-related **global headers** (CSP, X-Frame-Options, etc.), 404 → index for client-side routing.

Ensure pipeline/portal settings match the same `VITE_*` values used by the Hub and backend.

---

## Related documentation

- **[`startup.md`](./startup.md)** — step-by-step local setup, environment checklist, and how to run with the Hub and backend.
- **Hub IAM Backend** README — API routes, database schema, ports, and ABAC evaluation pipeline.
- **`docs/HUB-IAM-ABAC-V1-Design-Document.md`** — platform design specification and domain concepts.

For questions about **ABAC domain concepts** (policies, attributes, evaluation), refer to backend documentation and the design document; this README describes **frontend structure and integration points** only.
