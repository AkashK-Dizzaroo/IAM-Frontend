import { createContext, useState, useEffect } from 'react'
import api from '../services/api'
import { getValidHubUrl } from '../utils/hubUrl'

export const AuthContext = createContext(null)

const TOKEN_FROM_URL_KEY = 'iam_token_from_url'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState(null)

  // Helper to redirect back to the Hub (source of truth for login)
  const redirectToHub = (path = '') => {
    const hubUrl = getValidHubUrl()
    window.location.href = path ? `${hubUrl}${path.startsWith('/') ? path : `/${path}`}` : hubUrl
  }

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('platform_token')
        const isDevEnv = import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true'
        // Clear any old dev_mode flag - we always verify with backend now
        if (localStorage.getItem('dev_mode') === 'true') {
          console.log('[Auth] Clearing old dev_mode flag')
          localStorage.removeItem('dev_mode')
        }
        
        console.log('[Auth] Initializing auth:', { 
          hasToken: !!token, 
          isDevEnv,
          tokenPreview: token ? token.substring(0, 30) + '...' : 'none'
        })

        // No token at all - redirect to hub for authentication
        if (!token) {
          setLoading(false)
          setIsAuthenticated(false)
          setUser(null)
          redirectToHub()
          return
        }

        // Always verify the token with the backend
        try {
          const response = await api.post('/auth/verify', {}, { timeout: 15000 })
          const data = response.data

          if (!data?.success || !data?.data?.user) {
            throw new Error('Invalid auth response')
          }

          const backendUser = data.data.user

          // Use backend-provided globalRole as the single source of truth.
          // Only default to 'USER' if globalRole is missing.
          if (!backendUser.globalRole) {
            backendUser.globalRole = 'USER'
          }

          // Persist normalized user for other apps if needed
          // This overwrites any old dummy data
          localStorage.setItem('platform_user', JSON.stringify(backendUser))
          
          console.log('[IAM Auth] User loaded from backend:', {
            email: backendUser.email,
            globalRole: backendUser.globalRole,
            id: backendUser.id,
            firstName: backendUser.firstName,
            lastName: backendUser.lastName
          })

          setUser(backendUser)
          setIsAuthenticated(true)
        } catch (error) {
          // Backend verification failed - clear session
          console.error('[IAM Auth] Backend verification failed:', error.message)
          const justReceivedFromUrl = sessionStorage.getItem(TOKEN_FROM_URL_KEY) !== null
          localStorage.removeItem('platform_token')
          localStorage.removeItem('platform_user')
          localStorage.removeItem('dev_mode')
          sessionStorage.removeItem(TOKEN_FROM_URL_KEY)
          setUser(null)
          setIsAuthenticated(false)

          // If we just received token from URL, show error instead of redirecting
          // to avoid redirect loop (Hub -> IAM -> verify fails -> Hub -> IAM...)
          if (justReceivedFromUrl) {
            setAuthError('Could not verify your session. The token may be invalid or the server is unreachable.')
            return
          }

          redirectToHub()
          return
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        const justReceivedFromUrl = sessionStorage.getItem(TOKEN_FROM_URL_KEY) !== null
        localStorage.removeItem('platform_token')
        localStorage.removeItem('platform_user')
        localStorage.removeItem('dev_mode')
        sessionStorage.removeItem(TOKEN_FROM_URL_KEY)
        setUser(null)
        setIsAuthenticated(false)
        if (justReceivedFromUrl) {
          setAuthError('An error occurred while verifying your session.')
        } else {
          redirectToHub()
        }
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const logout = async () => {
    try {
      // Best-effort backend logout for audit purposes
      await api.post('/auth/logout').catch(() => {})
    } finally {
      localStorage.removeItem('platform_token')
      localStorage.removeItem('platform_user')
      setUser(null)
      setIsAuthenticated(false)
      window.location.href = `${getValidHubUrl()}/logout`
    }
  }

  // Auth error (e.g. verification failed after token-from-URL)
  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2 text-gray-800">Authentication Failed</h1>
          <p className="text-gray-600 mb-6">{authError}</p>
          <button
            onClick={() => redirectToHub()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Hub
          </button>
        </div>
      </div>
    )
  }

  // Don't render children until auth check is complete
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Authenticating...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}