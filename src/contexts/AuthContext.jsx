import { createContext, useEffect, useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import api from '../services/api'
import { getValidHubUrl } from '../utils/hubUrl'

export const AuthContext = createContext(null)

const PLATFORM_TOKEN_KEY = 'platform_token'
const PLATFORM_USER_KEY = 'platform_user'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState(null)

  const clearSession = () => {
    localStorage.removeItem(PLATFORM_TOKEN_KEY)
    localStorage.removeItem(PLATFORM_USER_KEY)
    localStorage.removeItem('dev_mode')
    setUser(null)
    setIsAuthenticated(false)
  }

  const normalizeUser = (backendUser) => {
    if (!backendUser.globalRole) {
      backendUser.globalRole = 'USER'
    }
    return backendUser
  }

  const verifyExistingToken = async () => {
    console.log('[IAM Auth] Calling GET /auth/verify...')
    const response = await api.get('/auth/verify', { timeout: 15000 })
    console.log('[IAM Auth] Verify response:', response.data)
    const data = response.data

    if (!data?.success || !data?.data?.user) {
      throw new Error('Invalid auth response')
    }

    const backendUser = normalizeUser(data.data.user)
    localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(backendUser))
    setUser(backendUser)
    setIsAuthenticated(true)
  }

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        console.log('[IAM Auth] Google login successful, exchanging code...')
        setLoading(true)
        setAuthError(null)

        const response = await api.post('/auth/google', { code: codeResponse.code })
        const data = response.data

        if (!data?.success || !data?.data?.token) {
          throw new Error('Invalid Google auth response')
        }

        console.log('[IAM Auth] Backend returned platform_token')
        localStorage.setItem(PLATFORM_TOKEN_KEY, data.data.token)

        if (data.data.user) {
          const backendUser = normalizeUser(data.data.user)
          localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(backendUser))
          setUser(backendUser)
          setIsAuthenticated(true)
          setLoading(false)
          console.log('[IAM Auth] User authenticated:', backendUser.email)
          return
        }

        console.log('[IAM Auth] No user in response, verifying token...')
        await verifyExistingToken()
        setLoading(false)
      } catch (error) {
        console.error('[IAM Auth] Google login failed:', error.message)
        clearSession()
        setAuthError('Google authentication failed. Please try again.')
        setLoading(false)
      }
    },
    onError: (error) => {
      console.error('[IAM Auth] Google login error:', error)
      clearSession()
      setAuthError('Google authentication failed. Please try again.')
      setLoading(false)
    },
  })

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('[IAM Auth] Initializing authentication...')
      const token = localStorage.getItem(PLATFORM_TOKEN_KEY)

      if (token) {
        console.log('[IAM Auth] Found existing token, verifying with backend...')
        try {
          await verifyExistingToken()
          console.log('[IAM Auth] Token verified successfully')
        } catch (error) {
          console.error('[IAM Auth] Backend verification failed:', error.message)
          clearSession()
          setAuthError('Could not verify your session. Please sign in again.')
        } finally {
          setLoading(false)
        }
        return
      }

      console.log('[IAM Auth] No token found, triggering Google login...')
      setLoading(false)
      setAuthError('Please sign in with Google to continue.')
    }

    initializeAuth()
  }, [])

  const logout = async () => {
    try {
      await api.post('/auth/logout').catch(() => {})
    } finally {
      clearSession()
      window.location.href = `${getValidHubUrl()}/logout`
    }
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-2xl mb-4">!</div>
          <h1 className="text-xl font-bold mb-2 text-gray-800">Authentication Failed</h1>
          <p className="text-gray-600 mb-6">{authError}</p>
          <button
            onClick={() => googleLogin()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Google Sign-In
          </button>
        </div>
      </div>
    )
  }

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