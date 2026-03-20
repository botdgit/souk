import React, { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from '@tanstack/react-query'
import { StripeProvider } from '@stripe/stripe-react-native'
import * as SecureStore from 'expo-secure-store'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import '../global.css'

function AppInit() {
  const { setAuth, clearAuth } = useAuthStore()

  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await SecureStore.getItemAsync('access_token')
        if (!token) { clearAuth(); return }

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
          token
        )
      } catch {
        await clearAuth()
      }
    }

    restoreSession()
  }, [setAuth, clearAuth])

  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
          <AppInit />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0F0E0E' },
              headerTintColor: '#FAFAFA',
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: '#0F0E0E' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="listing/[id]" options={{ title: '' }} />
            <Stack.Screen name="checkout/[orderId]" options={{ title: 'Checkout', presentation: 'modal' }} />
            <Stack.Screen name="onboard" options={{ title: 'Become a Seller' }} />
            <Stack.Screen name="wallet" options={{ title: 'Wallet' }} />
          </Stack>
        </StripeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
