import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext()

export function AppProvider({ children }) {
  // --- Theme State ---
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('wa_theme') || 'dark'
  })

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
  }

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark')
  }

  // Apply theme class to HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('wa_theme', theme)
  }, [theme])

  // --- Profile State ---
  const [profile, setProfileState] = useState(() => {
    const saved = localStorage.getItem('wa_profile')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        // Fallback to default if JSON parse fails
      }
    }
    return {
      name: 'Admin User',
      email: 'admin@example.com',
      company: 'WA Automate Inc.',
      role: 'Administrator'
    }
  })

  const updateProfile = (updatedFields) => {
    setProfileState(prev => {
      const next = { ...prev, ...updatedFields }
      localStorage.setItem('wa_profile', JSON.stringify(next))
      return next
    })
  }

  // Simulated Password Change
  const changePassword = async (oldPassword, newPassword) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!oldPassword || !newPassword) {
          reject(new Error('Password fields cannot be empty.'))
        } else if (oldPassword === newPassword) {
          reject(new Error('New password cannot be the same as old password.'))
        } else {
          // Success case
          resolve({ success: true, message: 'Password updated successfully!' })
        }
      }, 800)
    })
  }

  return (
    <AppContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      profile,
      updateProfile,
      changePassword
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
