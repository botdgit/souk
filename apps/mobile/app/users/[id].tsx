import React from 'react'
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ListingCard } from '@/components/listing/ListingCard'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { Listing } from '@/features/listings/hooks'

interface UserProfile {
  id: string
  display_name: string
  avatar_url?: string
  bio?: string
  area?: string
  is_verified: boolean
  rating_avg: number
  rating_count: number
  followers_count: number
  created_at: string
}

interface Review {
  rating: number
  comment?: string
  created_at: string
  reviewer?: {
    id: string
    display_name: string
    avatar_url?: string
  }
}

function useUserProfile(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () =>
      api.get<{ user: UserProfile; listings: Listing[]; reviews: Review[] }>(`/users/${id}`),
  })
}

function useFollowUser(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ following: boolean }>(`/users/${id}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', id] }),
  })
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View className="flex-row gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= Math.round(rating) ? 'star' : 'star-outline'}
          size={14}
          color="#D4A853"
        />
      ))}
    </View>
  )
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user: currentUser } = useAuthStore()
  const { data, isLoading } = useUserProfile(id)
  const { mutate: toggleFollow, isPending: isFollowing } = useFollowUser(id)

  if (isLoading) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center">
        <ActivityIndicator color="#D4A853" />
      </View>
    )
  }

  if (!data?.user) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center">
        <Text className="text-souk-muted">User not found.</Text>
      </View>
    )
  }

  const { user: profile, listings, reviews } = data
  const isOwnProfile = currentUser?.id === profile.id

  return (
    <View className="flex-1 bg-souk-black">
      <Stack.Screen options={{ title: profile.display_name }} />

      <ScrollView>
        {/* Header */}
        <View className="px-4 py-6 border-b border-souk-charcoal">
          <View className="flex-row items-center">
            <Avatar
              uri={profile.avatar_url}
              name={profile.display_name}
              size="xl"
              showVerified={profile.is_verified}
            />
            <View className="ml-4 flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-souk-white text-xl font-bold">{profile.display_name}</Text>
                {profile.is_verified && <Badge label="Verified" variant="gold" />}
              </View>
              {profile.area && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location-outline" size={13} color="#8A8A8A" />
                  <Text className="text-souk-muted text-sm ml-0.5">{profile.area}</Text>
                </View>
              )}
              <Text className="text-souk-muted text-xs mt-1">
                Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
              </Text>
            </View>
          </View>

          {profile.bio && (
            <Text className="text-souk-muted mt-3 leading-5">{profile.bio}</Text>
          )}

          {/* Stats */}
          <View className="flex-row gap-6 mt-4">
            <View className="items-center">
              <Text className="text-souk-white font-bold text-lg">{listings.length}</Text>
              <Text className="text-souk-muted text-xs">Listings</Text>
            </View>
            <View className="items-center">
              <Text className="text-souk-white font-bold text-lg">{profile.followers_count}</Text>
              <Text className="text-souk-muted text-xs">Followers</Text>
            </View>
            <View className="items-center">
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={14} color="#D4A853" />
                <Text className="text-souk-white font-bold text-lg">
                  {profile.rating_avg > 0 ? profile.rating_avg : '--'}
                </Text>
              </View>
              <Text className="text-souk-muted text-xs">
                {profile.rating_count > 0 ? `${profile.rating_count} reviews` : 'No reviews'}
              </Text>
            </View>
          </View>

          {/* Follow button */}
          {!isOwnProfile && currentUser && (
            <Button
              title="Follow"
              variant="secondary"
              size="sm"
              loading={isFollowing}
              fullWidth
              onPress={() => toggleFollow()}
              style={{ marginTop: 16 }}
            />
          )}
        </View>

        {/* Listings */}
        <View className="px-4 pt-4">
          <Text className="text-souk-white font-semibold text-lg mb-3">
            {isOwnProfile ? 'My Listings' : 'Listings'} ({listings.length})
          </Text>
        </View>

        {listings.length === 0 ? (
          <View className="items-center py-8 px-8">
            <Text className="text-souk-muted text-center">
              {isOwnProfile ? "You haven't listed anything yet." : 'No active listings.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
            columnWrapperStyle={{ gap: 4 }}
            renderItem={({ item }) => <ListingCard listing={item} />}
          />
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View className="px-4 pt-6 pb-8">
            <Text className="text-souk-white font-semibold text-lg mb-3">
              Reviews ({profile.rating_count})
            </Text>
            {reviews.map((review, i) => (
              <View key={i} className="bg-souk-charcoal rounded-xl p-3.5 mb-2">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Avatar
                      uri={review.reviewer?.avatar_url}
                      name={review.reviewer?.display_name}
                      size="sm"
                    />
                    <Text className="text-souk-white text-sm font-medium">
                      {review.reviewer?.display_name ?? 'User'}
                    </Text>
                  </View>
                  <StarRating rating={review.rating} />
                </View>
                {review.comment && (
                  <Text className="text-souk-muted text-sm leading-5">{review.comment}</Text>
                )}
                <Text className="text-souk-muted text-xs mt-2">
                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
