import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Bootstrap auth from Hub query params (accessToken, or token & user)
// Runs before React mounts so AuthContext finds the token when it initializes
function bootstrapAuthFromQuery() {
  try {
    const url = new URL(window.location.href)

    // 1. Check for accessToken (cross-domain login flow from Hub)
    const accessToken = url.searchParams.get('accessToken')
    if (accessToken) {
      localStorage.setItem('platform_token', accessToken)
      sessionStorage.setItem('iam_token_from_url', '1')
      const userParam = url.searchParams.get('user')
      if (userParam) {
        try {
          const decodedUserJson = atob(decodeURIComponent(userParam))
          const userObject = JSON.parse(decodedUserJson)
          localStorage.setItem('platform_user', JSON.stringify(userObject))
        } catch (e) {
          // User param invalid; token alone is sufficient
        }
      }
      url.searchParams.delete('accessToken')
      url.searchParams.delete('user')
      window.history.replaceState({}, '', url.toString())
      return
    }

    // 2. Legacy: token + user params
    const tokenParam = url.searchParams.get('token')
    const userParam = url.searchParams.get('user')

    if (!tokenParam || !userParam) {
      return
    }

    // Decode user payload
    let userObject = null
    try {
      const decodedUserJson = atob(decodeURIComponent(userParam))
      userObject = JSON.parse(decodedUserJson)
    } catch (e) {
      return
    }

    // Persist token and user to IAM localStorage
    localStorage.setItem('platform_token', tokenParam)
    localStorage.setItem('platform_user', JSON.stringify(userObject))
    sessionStorage.setItem('iam_token_from_url', '1')

    // Clean URL to avoid leaking token in history
    url.searchParams.delete('token')
    url.searchParams.delete('user')
    window.history.replaceState({}, '', url.toString())
  } catch {
    // Ignore bootstrap errors
  }
}

bootstrapAuthFromQuery()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

