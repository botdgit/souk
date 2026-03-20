import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

interface User {
  id: string
  displayName: string
  avatarUrl?: string
  area?: string
  isVerified: boolean
  stripeOnboardingComplete: boolean
  stripePayoutsEnabled: boolean
}

interface AuthState {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  setAuth: (user: User, token: string) => Promise<void>
  clearAuth: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync('access_token', token)
    set({ user, accessToken: token, isLoading: false })
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('access_token')
    set({ user: null, accessToken: null, isLoading: false })
  },

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}))
