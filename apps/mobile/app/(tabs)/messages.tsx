import React from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { formatDistanceToNow } from 'date-fns'
import { Image } from 'expo-image'
import { Avatar } from '@/components/ui/Avatar'
import { useConversations, type Conversation } from '@/features/messages/hooks'
import { useAuthStore } from '@/stores/authStore'

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { user } = useAuthStore()
  const isbuyer = user?.id === conversation.buyerId
  const otherUser = isbuyer ? conversation.seller : conversation.buyer
  const unread = isbuyer ? conversation.unreadCountBuyer : conversation.unreadCountSeller
  const coverImage = conversation.listing?.images?.[0]?.url

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 border-b border-souk-charcoal active:bg-souk-charcoal"
      onPress={() => router.push(`/listing/${conversation.listingId}`)}
    >
      <View className="relative mr-3">
        <Avatar uri={otherUser?.avatarUrl} name={otherUser?.displayName} size="md" />
      </View>
      <View className="flex-1 mr-2">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-souk-white font-semibold text-sm" numberOfLines={1}>
            {otherUser?.displayName ?? 'Unknown'}
          </Text>
          <Text className="text-souk-muted text-xs">
            {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
          </Text>
        </View>
        <Text className="text-souk-muted text-xs" numberOfLines={1}>
          {conversation.listing?.title ?? 'Listing'}
        </Text>
      </View>
      {coverImage && (
        <Image source={{ uri: coverImage }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" />
      )}
      {unread > 0 && (
        <View className="absolute right-14 top-3 bg-souk-gold rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-souk-black text-xs font-bold" style={{ fontSize: 10 }}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function MessagesScreen() {
  const { data, isLoading, refetch, isRefetching } = useConversations()
  const { user } = useAuthStore()

  if (!user) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center px-8">
        <Text className="text-souk-muted text-center">Sign in to view your messages.</Text>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center">
        <ActivityIndicator color="#D4A853" />
      </View>
    )
  }

  const conversations = data?.conversations ?? []

  return (
    <View className="flex-1 bg-souk-black">
      {conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-souk-muted text-center text-base">
            No conversations yet. Message a seller about a listing you love!
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ConversationRow conversation={item} />}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </View>
  )
}
