import { useMutation } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

export function useSendOtp() {
  return useMutation({
    mutationFn: (phone: string) => api.post('/auth/phone-otp', { phone }),
  })
}

export function useVerifyOtp() {
  const { setAuth } = useAuthStore()

  return useMutation({
    mutationFn: ({ phone, token }: { phone: string; token: string }) =>
      api.post<{
        accessToken: string
        refreshToken: string
        user: { id: string; phone: string }
      }>('/auth/verify-otp', { phone, token }),

    onSuccess: async (data) => {
      await SecureStore.setItemAsync('refresh_token', data.refreshToken)

      // Fetch full user profile
      const profileRes = await api.get<{ user: {
        id: string
        display_name: string
        avatar_url?: string
        area?: string
        is_verified: boolean
        stripe_onboarding_complete: boolean
        stripe_payouts_enabled: boolean
      } }>('/users/me/profile')

      await setAuth(
        {
          id: profileRes.user.id,
          displayName: profileRes.user.display_name,
          avatarUrl: profileRes.user.avatar_url,
          area: profileRes.user.area,
          isVerified: profileRes.user.is_verified,
          stripeOnboardingComplete: profileRes.user.stripe_onboarding_complete,
          stripePayoutsEnabled: profileRes.user.stripe_payouts_enabled,
        },
        data.accessToken
      )
    },
  })
}
