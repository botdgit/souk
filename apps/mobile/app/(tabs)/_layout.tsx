import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, Text } from 'react-native'
import { useConversations } from '@/features/messages/hooks'
import { useAuthStore } from '@/stores/authStore'

function TabBarIcon({ name, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={24}
      color={focused ? '#D4A853' : '#8A8A8A'}
    />
  )
}

function MessagesTabIcon({ focused }: { focused: boolean }) {
  const { user } = useAuthStore()
  const { data } = useConversations()
  const unread = user
    ? (data?.conversations?.reduce((sum, c) => {
        return sum + (c.buyerId === user.id ? c.unreadCountBuyer : c.unreadCountSeller)
      }, 0) ?? 0)
    : 0

  return (
    <View>
      <TabBarIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} focused={focused} />
      {unread > 0 && (
        <View className="absolute -top-1 -right-1 bg-souk-gold rounded-full w-4 h-4 items-center justify-center">
          <Text className="text-souk-black text-xs font-bold" style={{ fontSize: 9 }}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      )}
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0F0E0E',
          borderTopColor: '#2A2A2A',
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#D4A853',
        tabBarInactiveTintColor: '#8A8A8A',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle: { backgroundColor: '#0F0E0E' },
        headerTintColor: '#FAFAFA',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          headerTitle: 'Souk',
          tabBarIcon: ({ focused }) => <TabBarIcon name={focused ? 'search' : 'search-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Sell',
          tabBarIcon: ({ focused }) => <TabBarIcon name={focused ? 'add-circle' : 'add-circle-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => <MessagesTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabBarIcon name={focused ? 'person' : 'person-outline'} focused={focused} />,
        }}
      />
    </Tabs>
  )
}
