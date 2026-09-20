import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { subscribeToOwnProfile, upsertUserProfile } from '../lib/users'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
      if (firebaseUser) {
        // guarda/actualiza el email en Firestore, necesario para poder
        // revelar el contacto entre vendedor y ganador al cerrar una subasta.
        upsertUserProfile(firebaseUser).catch((err) =>
          console.error('No se pudo guardar el perfil de usuario:', err),
        )
      } else {
        setProfile(null)
      }
    })
    return unsubscribe
  }, [])

  // Escucha en tiempo real el propio perfil (necesario para saber el rol:
  // Araña se guarda en users/{uid}.role, no viene en el login de Google).
  useEffect(() => {
    if (!user) return
    const unsub = subscribeToOwnProfile(user.uid, setProfile)
    return unsub
  }, [user])

  async function loginWithGoogle() {
    await signInWithPopup(auth, googleProvider)
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
