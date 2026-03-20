import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListingCard } from '@/components/listing/ListingCard'
import { useListings, type ListingsFilter } from '@/features/listings/hooks'
import { useUIStore } from '@/stores/uiStore'

const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'designer', label: 'Designer' },
  { key: 'abayas', label: 'Abayas' },
  { key: 'modest', label: 'Modest' },
  { key: 'streetwear', label: 'Streetwear' },
  { key: 'bags', label: 'Bags' },
  { key: 'shoes', label: 'Shoes' },
]

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()
  const [searchText, setSearchText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const { activeFilters, setFilter } = useUIStore()

  const filters: ListingsFilter = {
    ...(searchQuery ? { q: searchQuery } : {}),
    ...activeFilters,
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useListings(filters)

  const listings = data?.pages.flatMap(p => p.listings) ?? []

  const handleSearch = useCallback(() => {
    setSearchQuery(searchText.trim())
  }, [searchText])

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <View className="flex-1 bg-souk-black" style={{ paddingTop: insets.top }}>
      {/* Search Bar */}
      <View className="px-4 pb-3 pt-2">
        <View className="flex-row items-center bg-souk-charcoal rounded-xl px-3 py-2.5">
          <Ionicons name="search" size={18} color="#8A8A8A" />
          <TextInput
            className="flex-1 text-souk-white text-sm ml-2"
            placeholder="Search Dubai's fashion..."
            placeholderTextColor="#8A8A8A"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setSearchQuery('') }}>
              <Ionicons name="close-circle" size={18} color="#8A8A8A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={item => item.key}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
        renderItem={({ item }) => {
          const isActive = (activeFilters.category ?? '') === item.key
          return (
            <TouchableOpacity
              className={`px-4 py-1.5 rounded-full mr-2 ${
                isActive ? 'bg-souk-gold' : 'bg-souk-charcoal border border-souk-muted'
              }`}
              onPress={() => setFilter('category', item.key || undefined)}
            >
              <Text
                className={`text-sm font-medium ${isActive ? 'text-souk-black' : 'text-souk-muted-light'}`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        }}
      />

      {/* Listings Grid */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#D4A853" />
        </View>
      ) : listings.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-souk-muted text-center text-base">
            No listings found. Be the first to list something!
          </Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
          columnWrapperStyle={{ gap: 4 }}
          renderItem={({ item }) => <ListingCard listing={item} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#D4A853"
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#D4A853" />
              </View>
            ) : null
          }
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={8}
        />
      )}
    </View>
  )
}
