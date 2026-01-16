import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Bootstrap auth from Hub query params (token & user)
function bootstrapAuthFromQuery() {
  try {
    const url = new URL(window.location.href)
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

