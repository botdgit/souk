import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useListing, useSaveListing, useSubmitOffer } from '@/features/listings/hooks'
import { useCreateOrder } from '@/features/orders/hooks'
import { useStartConversation } from '@/features/messages/hooks'
import { ConditionBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'

const { width } = Dimensions.get('window')

function formatPrice(fils: number) {
  return `AED ${(fils / 100).toFixed(0)}`
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()

  const { data, isLoading } = useListing(id)
  const { mutate: toggleSave } = useSaveListing(id)
  const { mutate: submitOffer, isPending: isSubmittingOffer } = useSubmitOffer(id)
  const { mutate: createOrder, isPending: isCreatingOrder } = useCreateOrder()
  const { mutate: startConvo } = useStartConversation()

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [showOfferInput, setShowOfferInput] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')

  if (isLoading) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center">
        <ActivityIndicator color="#D4A853" />
      </View>
    )
  }

  const listing = data?.listing
  if (!listing) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center">
        <Text className="text-souk-muted">Listing not found.</Text>
      </View>
    )
  }

  const isOwner = user?.id === listing.sellerId
  const serviceFee = Math.round(listing.priceAed * 0.05)
  const totalAed = listing.priceAed + serviceFee

  function handleBuyNow() {
    if (!user) return router.push('/auth')

    createOrder(
      { listingId: listing!.id, deliveryMethod: 'meetup' },
      {
        onSuccess: (data) => {
          router.push({
            pathname: '/checkout/[orderId]',
            params: { orderId: data.order.id, clientSecret: data.clientSecret },
          })
        },
        onError: (err) => Alert.alert('Error', err.message),
      }
    )
  }

  function handleMessage() {
    if (!user) return router.push('/auth')
    startConvo(listing!.id, {
      onSuccess: (data) => {
        router.push(`/listing/${listing!.id}`)
      },
      onError: (err) => Alert.alert('Error', err.message),
    })
  }

  function handleSubmitOffer() {
    const amount = parseFloat(offerAmount)
    if (isNaN(amount) || amount <= 0) {
      return Alert.alert('Invalid offer', 'Please enter a valid amount.')
    }
    submitOffer(
      { amountAed: Math.round(amount * 100) },
      {
        onSuccess: () => {
          Alert.alert('Offer sent!', `Your offer of AED ${amount.toFixed(2)} has been sent.`)
          setShowOfferInput(false)
          setOfferAmount('')
        },
        onError: (err) => Alert.alert('Error', err.message),
      }
    )
  }

  return (
    <View className="flex-1 bg-souk-black">
      <ScrollView>
        {/* Image Gallery */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            const index = Math.round(nativeEvent.contentOffset.x / width)
            setActiveImageIndex(index)
          }}
          scrollEventThrottle={16}
        >
          {listing.images.map((img, i) => (
            <Image
              key={i}
              source={{ uri: img.url }}
              style={{ width, height: width * 1.25 }}
              contentFit="cover"
            />
          ))}
        </ScrollView>

        {/* Image Dots */}
        {listing.images.length > 1 && (
          <View className="flex-row justify-center mt-3 gap-1.5">
            {listing.images.map((_, i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full ${i === activeImageIndex ? 'w-4 bg-souk-gold' : 'w-1.5 bg-souk-muted'}`}
              />
            ))}
          </View>
        )}

        <View className="px-4 pt-4 pb-6">
          {/* Title & Price */}
          <View className="flex-row items-start justify-between mb-2">
            <Text className="text-souk-white text-xl font-bold flex-1 pr-2">
              {listing.title}
            </Text>
            <TouchableOpacity onPress={() => toggleSave()}>
              <Ionicons name="heart-outline" size={24} color="#D4A853" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center gap-3 mb-4">
            <Text className="text-souk-gold text-2xl font-bold">
              {formatPrice(listing.priceAed)}
            </Text>
            <ConditionBadge condition={listing.condition} />
            {listing.brand && (
              <Text className="text-souk-muted text-sm">{listing.brand}</Text>
            )}
          </View>

          {/* Tags */}
          <View className="flex-row flex-wrap gap-2 mb-4">
            <View className="bg-souk-charcoal px-2.5 py-1 rounded-lg flex-row items-center gap-1">
              <Ionicons name="location-outline" size={12} color="#8A8A8A" />
              <Text className="text-souk-muted text-xs">{listing.area}</Text>
            </View>
            {listing.size && (
              <View className="bg-souk-charcoal px-2.5 py-1 rounded-lg">
                <Text className="text-souk-muted text-xs">Size {listing.size}</Text>
              </View>
            )}
            {listing.openToSwaps && (
              <View className="bg-souk-charcoal px-2.5 py-1 rounded-lg">
                <Text className="text-souk-gold text-xs">Open to swaps</Text>
              </View>
            )}
          </View>

          {/* Buyer Protection */}
          <View className="bg-souk-charcoal rounded-xl p-3.5 flex-row items-center gap-3 mb-4">
            <Ionicons name="shield-checkmark" size={20} color="#D4A853" />
            <View className="flex-1">
              <Text className="text-souk-white text-sm font-medium">Buyer Protection</Text>
              <Text className="text-souk-muted text-xs">
                Payment held in escrow until you confirm receipt
              </Text>
            </View>
          </View>

          {/* Description */}
          {listing.description && (
            <View className="mb-4">
              <Text className="text-souk-white font-semibold mb-1.5">Description</Text>
              <Text className="text-souk-muted leading-5">{listing.description}</Text>
            </View>
          )}

          {/* Seller */}
          <TouchableOpacity
            className="bg-souk-charcoal rounded-xl p-3.5 flex-row items-center gap-3 mb-6"
            onPress={() => router.push(`/users/${listing.seller?.id}`)}
          >
            <Avatar
              uri={listing.seller?.avatarUrl}
              name={listing.seller?.displayName}
              size="md"
              showVerified={listing.seller?.isVerified}
            />
            <View className="flex-1">
              <Text className="text-souk-white font-semibold">{listing.seller?.displayName}</Text>
              {(listing.seller?.ratingCount ?? 0) > 0 && (
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Ionicons name="star" size={12} color="#D4A853" />
                  <Text className="text-souk-muted text-xs">
                    {listing.seller?.ratingAvg} ({listing.seller?.ratingCount} reviews)
                  </Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
          </TouchableOpacity>

          {/* Price Breakdown */}
          <View className="bg-souk-charcoal rounded-xl p-3.5 mb-4">
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-souk-muted text-sm">Item price</Text>
              <Text className="text-souk-white text-sm">{formatPrice(listing.priceAed)}</Text>
            </View>
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-souk-muted text-sm">Service fee (5%)</Text>
              <Text className="text-souk-white text-sm">{formatPrice(serviceFee)}</Text>
            </View>
            <View className="h-px bg-souk-muted my-2" />
            <View className="flex-row justify-between">
              <Text className="text-souk-white font-semibold">Total</Text>
              <Text className="text-souk-gold font-bold">{formatPrice(totalAed)}</Text>
            </View>
          </View>

          {/* Offer input */}
          {showOfferInput && (
            <View className="bg-souk-charcoal rounded-xl p-3.5 mb-4">
              <Text className="text-souk-white font-semibold mb-2">Make an offer</Text>
              <TextInput
                className="bg-souk-black text-souk-white rounded-lg px-3 py-2.5 mb-3"
                placeholder="Your offer (AED)"
                placeholderTextColor="#8A8A8A"
                keyboardType="decimal-pad"
                value={offerAmount}
                onChangeText={setOfferAmount}
              />
              <View className="flex-row gap-2">
                <Button
                  title="Cancel"
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowOfferInput(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Send offer"
                  size="sm"
                  loading={isSubmittingOffer}
                  onPress={handleSubmitOffer}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      {!isOwner && listing.status === 'active' && (
        <View
          className="px-4 pt-3 pb-safe border-t border-souk-charcoal bg-souk-black"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="flex-row gap-3">
            <Button
              title="Message"
              variant="secondary"
              size="md"
              onPress={handleMessage}
              style={{ flex: 1 }}
            />
            {listing.openToOffers && !showOfferInput && (
              <Button
                title="Offer"
                variant="ghost"
                size="md"
                onPress={() => setShowOfferInput(true)}
                style={{ flex: 1 }}
              />
            )}
            <Button
              title="Buy Now"
              size="md"
              loading={isCreatingOrder}
              onPress={handleBuyNow}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </View>
  )
}
