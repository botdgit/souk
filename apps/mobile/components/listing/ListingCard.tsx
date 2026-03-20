import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ConditionBadge } from '../ui/Badge'
import type { Listing } from '@/features/listings/hooks'

interface ListingCardProps {
  listing: Listing
  style?: 'grid' | 'list'
}

function formatPrice(fils: number): string {
  return `AED ${(fils / 100).toFixed(0)}`
}

export function ListingCard({ listing, style = 'grid' }: ListingCardProps) {
  const coverImage = listing.images?.[0]?.url

  if (style === 'list') {
    return (
      <TouchableOpacity
        className="flex-row bg-souk-charcoal rounded-2xl overflow-hidden mb-3 active:opacity-90"
        onPress={() => router.push(`/listing/${listing.id}`)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: coverImage }}
          style={{ width: 100, height: 100 }}
          contentFit="cover"
          placeholder={listing.images?.[0] ? undefined : undefined}
        />
        <View className="flex-1 p-3 justify-between">
          <View>
            <Text className="text-souk-white font-medium text-sm" numberOfLines={2}>
              {listing.title}
            </Text>
            {listing.brand && (
              <Text className="text-souk-muted text-xs mt-0.5">{listing.brand}</Text>
            )}
          </View>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-souk-gold font-bold text-base">
              {formatPrice(listing.priceAed)}
            </Text>
            <ConditionBadge condition={listing.condition} />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      className="flex-1 bg-souk-charcoal rounded-2xl overflow-hidden m-1 active:opacity-90"
      onPress={() => router.push(`/listing/${listing.id}`)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: coverImage }}
        style={{ width: '100%', aspectRatio: 3 / 4 }}
        contentFit="cover"
      />
      <View className="p-2.5">
        <Text className="text-souk-white font-medium text-sm" numberOfLines={1}>
          {listing.title}
        </Text>
        {listing.brand && (
          <Text className="text-souk-muted text-xs mt-0.5" numberOfLines={1}>
            {listing.brand}
          </Text>
        )}
        <View className="flex-row items-center justify-between mt-1.5">
          <Text className="text-souk-gold font-bold text-sm">
            {formatPrice(listing.priceAed)}
          </Text>
          {listing.openToOffers && (
            <Text className="text-souk-muted text-xs">Offers</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}
