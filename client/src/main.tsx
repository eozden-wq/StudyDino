import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
    <App />
  </StrictMode>,
)
