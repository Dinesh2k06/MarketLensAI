import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import OnboardingWizard from './components/OnboardingWizard'
import Dashboard from './components/Dashboard'
import { getCurrentUser, onAuthStateChange } from './services/auth'
import { getUser } from './services/supabase'
import './App.css'

export default function App() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme')
      if (stored) return stored === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  const [authUser, setAuthUser] = useState(null)     // null = checking, false = not authenticated, object = authenticated
  const [business, setBusiness] = useState(null)     // null = needs onboarding, object = has business data
  const [loading, setLoading] = useState(true)       // true = checking auth state

  // Dark mode toggle
  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser()

      if (user) {
        // User is authenticated, check if they have business data
        setAuthUser(user)
        const businessData = await getUser(user.id)
        if (businessData) {
          setBusiness(businessData)
        }
        // If no businessData, user needs to complete onboarding
      } else {
        // User is not authenticated
        setAuthUser(false)
      }

      setLoading(false)
    }

    checkAuth()

    // Listen to auth state changes (login/logout)
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setAuthUser(session.user)
        const businessData = await getUser(session.user.id)
        if (businessData) {
          setBusiness(businessData)
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(false)
        setBusiness(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Not authenticated → show login page
  if (!authUser) {
    return (
      <LoginPage
        dark={dark}
        setDark={setDark}
        onAuthSuccess={async (user, needsOnboarding) => {
          setAuthUser(user)
          if (!needsOnboarding) {
            // User logged in, fetch their business data
            const businessData = await getUser(user.id)
            if (businessData) {
              setBusiness(businessData)
            }
          }
          // If needsOnboarding=true, business stays null → shows OnboardingWizard
        }}
      />
    )
  }

  // Authenticated but no business data → show onboarding wizard
  if (!business) {
    return (
      <OnboardingWizard
        dark={dark}
        setDark={setDark}
        authUser={authUser}
        onComplete={(data) => {
          setBusiness(data)
        }}
      />
    )
  }

  // Authenticated and has business data → show dashboard
  return <Dashboard dark={dark} setDark={setDark} business={business} authUser={authUser} />
}
