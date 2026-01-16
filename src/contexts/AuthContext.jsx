import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Helper to redirect back to the Hub (source of truth for login)
  const redirectToHub = () => {
    const hubUrl = import.meta.env.VITE_HUB_URL || 'http://localhost:5000'
    window.location.href = hubUrl
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
          const response = await api.post('/auth/verify')
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
          // Backend verification failed - clear session and redirect to hub
          console.error('[IAM Auth] Backend verification failed:', error.message)
          localStorage.removeItem('platform_token')
          localStorage.removeItem('platform_user')
          localStorage.removeItem('dev_mode')
          setUser(null)
          setIsAuthenticated(false)
          redirectToHub()
          return
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        localStorage.removeItem('platform_token')
        localStorage.removeItem('platform_user')
        localStorage.removeItem('dev_mode')
        setUser(null)
        setIsAuthenticated(false)
        redirectToHub()
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

      const hubUrl = import.meta.env.VITE_HUB_URL || 'http://localhost:5000'
      window.location.href = `${hubUrl}/logout`
    }
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

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}