import React, { useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Stack, ErrorBoundaryProps } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from '@tanstack/react-query'
import { StripeProvider } from '@stripe/stripe-react-native'
import * as SecureStore from 'expo-secure-store'
import * as SplashScreen from 'expo-splash-screen'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import './global.css'

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0E0E', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ color: '#FAFAFA', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ color: '#8A8A8A', textAlign: 'center', marginBottom: 24 }}>
        {error.message}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: '#D4A853', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ color: '#0F0E0E', fontWeight: '600' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  )
}

SplashScreen.preventAutoHideAsync()

function AppInit() {
  const { setAuth, clearAuth } = useAuthStore()

  const restoreSession = useCallback(async () => {
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
    } finally {
      await SplashScreen.hideAsync()
    }
  }, [setAuth, clearAuth])

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  return null
}

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StripeProvider
          publishableKey={STRIPE_KEY}
          merchantIdentifier="merchant.ae.souk.app"
        >
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
            <Stack.Screen name="users/[id]" options={{ title: 'Profile' }} />
            <Stack.Screen name="souk-points" options={{ title: 'Souk Points' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="help" options={{ title: 'Help & Support' }} />
          </Stack>
        </StripeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
