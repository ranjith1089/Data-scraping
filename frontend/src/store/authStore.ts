import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  tenant_id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  // Platform super-admin flag. Added in migration 004 — older
  // persisted sessions may not carry it, so the UI must treat it as
  // optional/defaulting to false.
  is_superuser?: boolean
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (user: User) => void
  login: (user: User, access: string, refresh: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      login: (user, access, refresh) =>
        set({
          user,
          accessToken: access,
          refreshToken: refresh,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    { name: 'aveonapex-auth' }
  )
)
