import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Auth0Provider } from '@auth0/auth0-react'

const THEME_STORAGE_KEY = 'client-theme'

const applyInitialTheme = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const root = document.documentElement
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
  const nextTheme = storedTheme === 'dark' || storedTheme === 'light'
    ? storedTheme
    : systemTheme

  root.classList.remove('dark', 'light')
  root.classList.add(nextTheme)
}

applyInitialTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Auth0Provider
      domain="dev-3s241877k6ba3txd.us.auth0.com"
      clientId="yO5ENS7oTRD4e6ciHKThACZFFAxB6duh"
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
      <App />
    </Auth0Provider>
  </StrictMode>,
)
