# Dummy Login for Local Development

This guide explains how to use the dummy login feature to develop IAM-App locally without needing the Hub-Login app or a backend connection.

## Quick Start

### 1. Enable Dev Mode

Create a `.env` file in the IAM-App directory (or update your existing one):

```env
VITE_DEV_MODE=true
VITE_API_URL=http://localhost:4001
```

### 2. Start the App

```bash
npm run dev
```

### 3. Use Dummy Login

When you open `http://localhost:5001`, you'll see a dummy login page instead of being redirected to the Hub.

**Just click "Login with Dev Credentials"** - no password needed!

Or enter any email and click login.

## How It Works

### Development Mode Detection

The app checks for dev mode in this order:
1. `import.meta.env.DEV` - Automatically true when running `npm run dev`
2. `VITE_DEV_MODE=true` - Set in `.env` file

### Login Options

1. **Backend Available**: If your backend is running on `localhost:4001`, it will try to authenticate with it first
2. **Dummy Mode**: If backend is unavailable or auth fails, it creates dummy credentials

### Dummy Credentials Created

When using dummy login, the app creates:
- **Token**: A dummy JWT-like token (not verified by backend)
- **User**: A mock user with SUPER_ADMIN role
- **Flag**: Sets `dev_mode=true` in localStorage

### User Data Structure

```javascript
{
  id: 'dev-user-123',
  email: 'admin@dizzaroo.com', // or whatever email you enter
  firstName: 'Dev',
  lastName: 'User',
  role: 'SUPER_ADMIN',
  application: {
    id: 'platform',
    appCode: 'PLATFORM',
    name: 'Platform Services'
  }
}
```

## Features

- ✅ Works without backend connection
- ✅ Works without Hub-Login app
- ✅ Tries real backend first if available
- ✅ No password required
- ✅ Any email works
- ✅ Full SUPER_ADMIN access for development

## API Calls in Dev Mode

Even in dev mode, API calls will still try to reach your backend:
- If backend is running: Real API calls work
- If backend is down: You'll see errors in console, but the app still works

To fully mock the backend, you could:
1. Use MSW (Mock Service Worker)
2. Create a local mock server
3. Use browser DevTools to mock API responses

## Disabling Dev Mode

Set in `.env`:
```env
VITE_DEV_MODE=false
```

Or remove the variable entirely. The app will then:
- Redirect to Hub-Login app if no token
- Require real authentication

## Troubleshooting

### Login Page Not Showing

**Problem**: Still redirects to Hub

**Solution**: 
1. Check `.env` has `VITE_DEV_MODE=true`
2. Restart dev server after changing `.env`
3. Clear localStorage: `localStorage.clear()` in browser console

### Backend Verification Failing

**Problem**: Login tries backend but fails

**Solution**: 
- This is expected if backend is not running
- The dummy login will activate automatically
- Check console for warnings (they're harmless in dev mode)

### Want to Test Real Authentication

**Solution**:
1. Set `VITE_DEV_MODE=false` in `.env`
2. Start your backend on `localhost:4001`
3. Use a real login endpoint or Hub-Login app

## Security Note

⚠️ **This feature is for DEVELOPMENT ONLY!**

- Never enable `VITE_DEV_MODE=true` in production
- Dummy tokens are not secure
- No real authentication happens
- Anyone can login with any email

The dummy login is automatically disabled in production builds.

## Accessing the Login Page Directly

You can also access the dummy login directly:
- URL: `http://localhost:5001/dev-login`
- Only available when `VITE_DEV_MODE=true` or in development

---

**Happy coding!** 🚀















