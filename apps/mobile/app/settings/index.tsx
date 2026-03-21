import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/authStore'

function SettingsRow({
  icon,
  label,
  sublabel,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  sublabel?: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-4 border-b border-souk-charcoal active:bg-souk-charcoal"
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color="#8A8A8A" style={{ marginRight: 12 }} />
      <View className="flex-1">
        <Text className="text-souk-white text-sm">{label}</Text>
        {sublabel && <Text className="text-souk-muted text-xs mt-0.5">{sublabel}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
    </TouchableOpacity>
  )
}

export default function SettingsScreen() {
  const { user } = useAuthStore()

  return (
    <ScrollView className="flex-1 bg-souk-black">
      <View className="mt-4 bg-souk-black">
        <Text className="text-souk-muted text-xs uppercase px-4 mb-2">Account</Text>
        <SettingsRow
          icon="person-outline"
          label="Edit Profile"
          sublabel="Name, photo, bio, area"
          onPress={() => Alert.alert('Coming soon', 'Profile editing will be available shortly.')}
        />
        <SettingsRow
          icon="notifications-outline"
          label="Notification Preferences"
          sublabel="Push notifications, email alerts"
          onPress={() => Alert.alert('Coming soon', 'Notification preferences will be available shortly.')}
        />
        <SettingsRow
          icon="card-outline"
          label="Payment Methods"
          sublabel="Manage your saved cards"
          onPress={() => Alert.alert('Coming soon', 'Payment method management will be available shortly.')}
        />
      </View>

      <View className="mt-6">
        <Text className="text-souk-muted text-xs uppercase px-4 mb-2">Legal</Text>
        <SettingsRow
          icon="document-text-outline"
          label="Terms of Service"
          onPress={() => Linking.openURL('https://souk.ae/terms')}
        />
        <SettingsRow
          icon="shield-outline"
          label="Privacy Policy"
          onPress={() => Linking.openURL('https://souk.ae/privacy')}
        />
      </View>

      <View className="mt-6 mb-8">
        <Text className="text-souk-muted text-xs uppercase px-4 mb-2">About</Text>
        <SettingsRow
          icon="information-circle-outline"
          label="App Version"
          sublabel="1.0.0"
          onPress={() => {}}
        />
      </View>
    </ScrollView>
  )
}
