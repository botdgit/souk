import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useWallet } from '@/features/wallet/hooks'

function ProfileMenuItem({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  onPress: () => void
  badge?: string
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-4 border-b border-souk-charcoal active:bg-souk-charcoal"
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color="#8A8A8A" />
      <Text className="text-souk-white text-base ml-3 flex-1">{label}</Text>
      {badge && <Badge label={badge} variant="gold" />}
      <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
    </TouchableOpacity>
  )
}

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore()
  const { data: wallet } = useWallet()

  if (!user) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center px-8">
        <Text className="text-souk-white text-xl font-bold text-center mb-2">
          Welcome to Souk
        </Text>
        <Text className="text-souk-muted text-center mb-6">
          Sign in to buy, sell, and connect with Dubai's fashion community.
        </Text>
        <Button title="Sign In / Register" fullWidth onPress={() => router.push('/auth')} />
      </View>
    )
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => clearAuth() },
    ])
  }

  const availableAed = ((wallet?.available ?? 0) / 100).toFixed(2)
  const pendingAed = ((wallet?.pending ?? 0) / 100).toFixed(2)

  return (
    <ScrollView className="flex-1 bg-souk-black">
      {/* Profile Header */}
      <View className="px-4 py-6 border-b border-souk-charcoal">
        <View className="flex-row items-center">
          <Avatar uri={user.avatarUrl} name={user.displayName} size="xl" showVerified={user.isVerified} />
          <View className="ml-4 flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-souk-white text-xl font-bold">{user.displayName}</Text>
              {user.isVerified && <Badge label="Verified" variant="gold" />}
            </View>
            {user.area && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="location-outline" size={13} color="#8A8A8A" />
                <Text className="text-souk-muted text-sm ml-0.5">{user.area}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Wallet Summary */}
      <TouchableOpacity
        className="mx-4 my-4 bg-souk-charcoal rounded-2xl p-4"
        onPress={() => router.push('/wallet')}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-souk-white font-semibold">Wallet</Text>
          <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
        </View>
        <View className="flex-row gap-4">
          <View>
            <Text className="text-souk-muted text-xs mb-0.5">Available</Text>
            <Text className="text-souk-gold font-bold text-lg">AED {availableAed}</Text>
          </View>
          <View className="w-px bg-souk-muted" />
          <View>
            <Text className="text-souk-muted text-xs mb-0.5">Pending</Text>
            <Text className="text-souk-white font-semibold text-lg">AED {pendingAed}</Text>
          </View>
        </View>
        {!user.stripeOnboardingComplete && (
          <View className="mt-3 bg-souk-gold rounded-lg px-3 py-2">
            <Text className="text-souk-black text-sm font-medium">
              Complete seller setup to receive payouts →
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Menu Items */}
      <View className="mb-4">
        <ProfileMenuItem
          icon="bag-outline"
          label="My Listings"
          onPress={() => router.push(`/users/${user.id}`)}
        />
        <ProfileMenuItem
          icon="receipt-outline"
          label="Orders"
          onPress={() => router.push('/wallet')}
        />
        {!user.stripeOnboardingComplete && (
          <ProfileMenuItem
            icon="shield-checkmark-outline"
            label="Become a Seller"
            onPress={() => router.push('/onboard')}
            badge="Required"
          />
        )}
        <ProfileMenuItem
          icon="map-outline"
          label="Souk Points"
          onPress={() => router.push('/souk-points')}
        />
        <ProfileMenuItem
          icon="settings-outline"
          label="Settings"
          onPress={() => router.push('/settings')}
        />
        <ProfileMenuItem
          icon="help-circle-outline"
          label="Help & Support"
          onPress={() => router.push('/help')}
        />
      </View>

      <TouchableOpacity
        className="mx-4 mb-8 py-3.5 rounded-xl border border-souk-error items-center"
        onPress={handleSignOut}
      >
        <Text className="text-souk-error font-medium">Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
