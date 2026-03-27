# IAM Frontend — Local setup and startup

This guide walks through cloning, configuring, and running the **IAM Frontend** (`iam-app`) on your machine. For architecture, routes, and services, see **[`README.md`](./README.md)**.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **20.x** recommended (matches Azure Pipelines `nodeVersion`; Vite 5 and the toolchain work well on current Node 20 LTS). |
| **npm** | Bundled with Node; use `npm ci` when a lockfile is committed for reproducible installs. |
| **Backend API** | A running platform/IAM backend that exposes `/api/...` (auth handoff, verify, ABAC routes). Default Vite proxy assumes **`http://localhost:4001`** if `VITE_API_URL` is unset — adjust to your backend port. |
| **Hub (optional for full flow)** | The Hub Login app (typically **port 5000**) issues **`handoffCode`** and redirects users into IAM (**port 5001**). You can still load IAM directly if you already have a valid token in storage or use dev workflows your team supports. |
| **Google Cloud OAuth client** | The app **requires** **`VITE_GOOGLE_CLIENT_ID`** at build/runtime (`main.jsx`). Create an OAuth 2.0 **Web client** in Google Cloud Console and add authorized JavaScript origins (e.g. `http://localhost:5001`) for local dev. |

---

## 1. Get the code

From your machine (path may differ):

```bash
cd C:\path\to\HUB_IAM_ABAC\IAM-Frontend
```

If this repo is git-hosted elsewhere, clone it first, then `cd` into `IAM-Frontend`.

---

## 2. Install dependencies

```bash
npm install
```

For CI-style installs (when `package-lock.json` is present and up to date):

```bash
npm ci
```

---

## 3. Environment variables

### Create `.env`

Copy the template and edit values:

```bash
copy env.example .env
```

On macOS/Linux:

```bash
cp env.example .env
```

### Variables you should set

| Variable | Purpose |
|----------|---------|
| **`VITE_API_URL`** | Backend origin **without** trailing `/api`. Example: `http://localhost:4001` for a local Hub IAM API. The client builds requests as `${VITE_API_URL}/api/...`. |
| **`VITE_HUB_URL`** | Hub base URL for “Back to Hub”, login redirects, and logout. Local example: `http://localhost:5000`. |
| **`VITE_GOOGLE_CLIENT_ID`** | **Required.** Google OAuth Web client ID. Without it, the app renders a configuration error instead of the UI. |

### Optional / template extras

`env.example` may include legacy or feature-flag style entries such as `VITE_DEV_MODE`, `VITE_TOKEN_STORAGE_KEY`, etc. Only variables that are **read in source** (for example in `src/config/env.js` or `main.jsx`) have effect. When in doubt, search the codebase for `import.meta.env.VITE_`.

### Security

- Do **not** commit **`.env`** (it should be gitignored).
- Do **not** put secrets that must stay server-only into `VITE_*` variables — they are embedded in the client bundle.

---

## 4. Align ports with your backend

`vite.config.js` sets:

- **Dev server port:** **5001** (also used by `npm run dev` / `preview` scripts in `package.json`).
- **Proxy:** requests to **`/api`** are forwarded to **`process.env.VITE_API_URL`** or **`http://localhost:4001`** if unset.

**If your backend runs on another port**, either:

- Set **`VITE_API_URL=http://localhost:<your-port>`** in `.env`, so the Axios `apiClient` points at the correct origin, **or**
- Change the proxy `target` in `vite.config.js` for local use only (prefer `.env` for consistency).

The **`apiClient`** uses **`VITE_API_URL`** for `baseURL` (`${env.API_BASE_URL}/api`), so production and dev must both resolve to a backend that serves `/api/auth/...`, `/api/v1/...`, etc.

---

## 5. Start the development server

```bash
npm run dev
```

Open **http://localhost:5001** (or the URL printed by Vite).

Expected behavior:

- If **`VITE_GOOGLE_CLIENT_ID`** is missing, you will see a **configuration error** page.
- If the backend is down or auth fails, you may be redirected to **`${VITE_HUB_URL}/login`** after a failed `/api/auth/verify` (unless dev-only paths apply).

---

## 6. Full local stack (recommended)

Typical order when developing IAM against a local backend and Hub:

1. **PostgreSQL** (if required by your backend) — running and reachable.
2. **Backend** (e.g. Hub IAM API on port **4001** or your chosen port) — `ALLOWED_ORIGINS` should include `http://localhost:5001`.
3. **Hub Login** — **port 5000** (or your team’s standard), `VITE_API_URL` pointing at the same backend.
4. **IAM Frontend** — **port 5001**, `VITE_API_URL` and `VITE_HUB_URL` set.

### End-to-end login flow

1. Open the Hub and sign in.
2. Launch IAM from the Hub so the URL includes **`handoffCode`** (or use your team’s documented handoff).
3. IAM runs **`initializeAuthFromUrl`** before React mounts, exchanges the code, stores **`platform_token`** / **`platform_user`**, then loads the dashboard.

---

## 7. Production-like checks

### Preview the production build

```bash
npm run build
npm run preview
```

Serves the **`dist`** output on port **5001** by default. Use this to verify routing, lazy loading, and env vars before deploying.

### Lint and tests

```bash
npm run lint
npm test
```

---

## 8. Azure Static Web Apps / CI

The pipeline (`azure-pipelines.yml`) expects:

- **`VITE_API_URL`**, **`VITE_HUB_URL`**, **`VITE_GOOGLE_CLIENT_ID`** as pipeline variables (or equivalent secret/variable group) when running `npm run build`.
- **`staticwebapp.config.json`** copied into **`dist/`** before deploy.

Ensure production URLs and OAuth client allow **your deployed IAM origin** (e.g. `https://iam.example.com`).

---

## 9. Troubleshooting

| Symptom | Things to check |
|---------|------------------|
| “**VITE_GOOGLE_CLIENT_ID is not set**” | Add the variable to `.env`, restart dev server; confirm Azure pipeline variables for deployed builds. |
| **Redirect to Hub login** immediately | Token missing/invalid; backend `/api/auth/verify` failing; CORS or wrong `VITE_API_URL`; 401 handling in `apiClient`. |
| **API calls 404 or wrong host** | `VITE_API_URL` must match backend scheme/host/port; no trailing `/api` in the variable. |
| **CORS errors** | Backend `ALLOWED_ORIGINS` (or equivalent) must include `http://localhost:5001`. |
| **Handoff does nothing** | Network tab: `POST /api/auth/handoff/exchange` must succeed; Hub must pass a valid `handoffCode`. |
| **Blank page after deploy** | Check browser console; verify `staticwebapp.config.json` in `dist`; verify `navigationFallback` and that API is not accidentally served as static files. |

---

## 10. Quick reference — scripts

| Script | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Preview build | `npm run preview` or `npm start` |
| Lint | `npm run lint` |
| Tests | `npm test` / `npm run test:watch` / `npm run test:coverage` |

---

For architecture deep dive (routes, services, auth flow), see **[`README.md`](./README.md)**.
