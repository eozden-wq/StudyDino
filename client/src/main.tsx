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

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE
const auth0RedirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI

const root = createRoot(document.getElementById('root')!)

if (!auth0Domain || !auth0ClientId) {
  root.render(
    <StrictMode>
      <div className="h-[100dvh] w-full flex items-center justify-center bg-background text-foreground">
        Missing Auth0 configuration.
      </div>
    </StrictMode>
  )
} else {
  root.render(
    <StrictMode>
      <Auth0Provider
        domain={auth0Domain}
        clientId={auth0ClientId}
        authorizationParams={{
          redirect_uri: auth0RedirectUri ?? window.location.origin,
          audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? "https://studydino-api",
        }}
      >
        <App />
      </Auth0Provider>
    </StrictMode>
  )
}
