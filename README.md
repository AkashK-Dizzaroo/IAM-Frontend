# IAM App (Identity & Access Management)

**Standalone Identity and Access Management Application**

---

## 🎯 Purpose

Dedicated application for managing:
- User accounts and permissions
- Access requests across all platform applications
- Roles and permission sets
- Audit logging and security monitoring

---

## 🚀 Quick Start

### Installation
```bash
cd IAM-App
npm install
```

### Development
```bash
npm run dev
# Runs on http://localhost:5001
```

### Build for Production
```bash
npm run build
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` from `env.example`:

```env
VITE_API_URL=http://localhost:4000/api/v1
VITE_HUB_URL=http://localhost:5000
VITE_TOKEN_STORAGE_KEY=platform_token
VITE_USER_STORAGE_KEY=platform_user
```

---

## 📁 Project Structure

```
IAM-App/
├── src/
│   ├── contexts/
│   │   └── AuthContext.jsx           # Auth from Hub
│   ├── pages/
│   │   ├── DashboardPage.jsx         # Main dashboard with tabs
│   │   ├── AccessRequestsPage.jsx    # Access requests management
│   │   ├── UsersPage.jsx             # User management
│   │   ├── RolesPage.jsx             # Roles & permissions
│   │   └── AuditPage.jsx             # Audit logs
│   ├── components/
│   │   └── ProtectedRoute.jsx        # Auth guard
│   ├── config/
│   │   └── queryClient.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
└── README.md
```

---

## 🔐 Authentication

### Authentication Flow

1. **User authenticates** via Hub-Login app (port 5000)
2. **Hub redirects** to IAM app with token in URL: 
   ```
   http://localhost:5001?token=xxx&user=yyy
   ```
3. **IAM app receives** token and stores in localStorage
4. **IAM app validates** user has required roles (ADMIN, USER_MANAGER, etc.)
5. **If unauthorized**, redirects back to Hub

### Token Storage

- Token: `localStorage.getItem('platform_token')`
- User: `localStorage.getItem('platform_user')`
- Shared across Hub and IAM apps

### Logout

- Clears localStorage
- Redirects to Hub-Login app: `http://localhost:5000/login`

---

## 🎨 Features

### ✅ Access Requests Management
- View all access requests from users
- Approve/reject requests
- Filter by application, status, urgency
- User information display

### ✅ User Management
- List all platform users
- Create/edit/delete users
- Assign roles and permissions
- Manage user status

### ✅ Roles & Permissions
- Define custom roles
- Configure permission sets
- Assign permissions to roles
- Role hierarchy management

### ✅ Audit & Security
- View audit logs
- Track user activities
- Security event monitoring
- Compliance reporting

---

## 🔗 Integration

### With Hub-Login App

```javascript
// Hub launches IAM app
const token = localStorage.getItem('platform_token')
const user = localStorage.getItem('platform_user')
window.location.href = `http://localhost:5001?token=${token}&user=${user}`

// IAM app receives auth
const urlParams = new URLSearchParams(window.location.search)
const token = urlParams.get('token')
const user = urlParams.get('user')
localStorage.setItem('platform_token', token)
localStorage.setItem('platform_user', user)
```

### With Backend

All API calls to `Backend-Clinical-trial-Platform` on port 4000:
- `/api/v1/users` - User management
- `/api/v1/roles` - Role management
- `/api/v1/permissions` - Permission management
- `/api/v1/access-requests` - Access request management
- `/api/v1/audit` - Audit logs

---

## 📱 Deployment

### Azure Static Web Apps

```bash
# Build
npm run build

# Deploy
az staticwebapp create \
  --name iam-app \
  --resource-group clinical-trial-platform \
  --source ./dist \
  --location "Central US" \
  --branch main \
  --app-location "/" \
  --output-location "dist"
```

### Production Environment Variables

Set in Azure:
- `VITE_API_URL` → Backend API URL
- `VITE_HUB_URL` → Hub-Login app URL

---

## 🛠️ Development Setup

### Complete Local Stack

```bash
# Terminal 1: Backend (IAM Service)
cd Backend-Clinical-trial-Platform
npm run dev
# Port: 4000

# Terminal 2: Hub-Login App
cd Hub-Login-App
npm run dev
# Port: 5000

# Terminal 3: IAM App
cd IAM-App
npm run dev
# Port: 5001

# Terminal 4: Neurodoc (eTMF)
cd Neurodoc-frontend
npm run dev
# Port: 5173
```

### Access Flow

1. Go to http://localhost:5000 (Hub-Login)
2. Login with credentials
3. Click "Identity & Access Management" card
4. Opens http://localhost:5001 with token
5. IAM app loads with authenticated user

---

## 📝 Next Steps

### To Complete IAM App

1. **Copy components from Neurodoc-frontend**:
   - `src/modules/identity-access-management/components/AccessRequestTable.jsx`
   - User management tables
   - Role management components

2. **Copy services**:
   - Access request service
   - User service
   - Role service

3. **Add UI components from Neurodoc-frontend**:
   - Card, Button, Input, Select, etc. from `@/components/ui`
   - Or install shadcn/ui

4. **Configure API integration**:
   - Update services to use correct backend endpoints
   - Add proper error handling

---

## 🔧 Customization

### Theme

Modify `src/index.css` CSS variables:

```css
:root {
  --primary: 263.4 70% 50.4%;  /* Indigo for IAM */
  --radius: 0.5rem;
}
```

### Roles

Allowed roles to access IAM app (in `DashboardPage.jsx`):
- ADMIN
- USER_MANAGER
- AUDIT_MANAGER

---

## 🎉 Benefits of Separate Deployment

✅ **Independent Scaling** - Scale IAM app separately
✅ **Separate CI/CD** - Deploy without affecting other apps
✅ **Team Ownership** - Different teams can own different apps
✅ **Security Isolation** - IAM app can have stricter security
✅ **Performance** - Smaller bundle size per app
✅ **Maintenance** - Easier to update and maintain

---

**IAM App is ready for development!** 🚀

