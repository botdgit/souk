import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '@/components/ui/Button'
import { useCreateListing } from '@/features/listings/hooks'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

const CATEGORIES = ['designer', 'abayas', 'modest', 'streetwear', 'bags', 'shoes']
const CONDITIONS = ['new_with_tags', 'like_new', 'excellent', 'good', 'fair']
const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: 'New with tags',
  like_new: 'Like new',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
}

const DUBAI_AREAS = [
  'Downtown Dubai', 'Dubai Marina', 'JBR', 'Business Bay', 'DIFC',
  'Al Barsha', 'Jumeirah', 'Deira', 'Bur Dubai', 'Palm Jumeirah',
  'Arabian Ranches', 'Mirdif', 'Al Qusais', 'Karama', 'Satwa',
]

export default function SellScreen() {
  const { user } = useAuthStore()
  const { mutate: createListing, isPending } = useCreateListing()

  const [images, setImages] = useState<Array<{ url: string; key: string }>>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [condition, setCondition] = useState('')
  const [price, setPrice] = useState('')
  const [area, setArea] = useState('')
  const [openToOffers, setOpenToOffers] = useState(false)
  const [openToSwaps, setOpenToSwaps] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)

  if (!user) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center px-8">
        <Text className="text-souk-white text-xl font-semibold text-center mb-3">
          Sign in to sell on Souk
        </Text>
        <Text className="text-souk-muted text-center mb-6">
          Join Dubai's fashion community and start earning from your wardrobe.
        </Text>
        <Button title="Sign In" onPress={() => router.push('/auth')} />
      </View>
    )
  }

  if (!user.stripeOnboardingComplete) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center px-8">
        <Text className="text-souk-white text-xl font-semibold text-center mb-3">
          Become a verified seller
        </Text>
        <Text className="text-souk-muted text-center mb-6">
          Complete identity verification to start listing and receiving payments.
        </Text>
        <Button title="Complete Seller Setup" onPress={() => router.push('/onboard')} />
      </View>
    )
  }

  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - images.length,
    })

    if (result.canceled || !result.assets?.length) return

    setUploadingImages(true)
    try {
      const presignRes = await api.post<{ uploads: Array<{ key: string; uploadUrl: string; publicUrl: string }> }>(
        '/media/presign',
        { contentType: 'image/jpeg', count: result.assets.length }
      )

      const uploaded: Array<{ url: string; key: string }> = []

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i]
        const { key, uploadUrl, publicUrl } = presignRes.uploads[i]

        const fileRes = await fetch(asset.uri)
        const blob = await fileRes.blob()

        await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        })

        uploaded.push({ key, url: publicUrl })
      }

      setImages(prev => [...prev, ...uploaded])
    } catch {
      Alert.alert('Upload failed', 'Could not upload images. Please try again.')
    } finally {
      setUploadingImages(false)
    }
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    if (!title.trim()) return Alert.alert('Missing field', 'Please enter a title.')
    if (!category) return Alert.alert('Missing field', 'Please select a category.')
    if (!condition) return Alert.alert('Missing field', 'Please select a condition.')
    if (!price || isNaN(Number(price))) return Alert.alert('Invalid price', 'Please enter a valid price.')
    if (!area) return Alert.alert('Missing field', 'Please select a meetup area.')
    if (images.length === 0) return Alert.alert('Missing photos', 'Please add at least one photo.')

    const priceAed = Math.round(parseFloat(price) * 100)
    if (priceAed < 100) return Alert.alert('Invalid price', 'Minimum price is AED 1.')

    createListing(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        brand: brand.trim() || undefined,
        size: size.trim() || undefined,
        condition,
        priceAed,
        openToOffers,
        openToSwaps,
        area,
        images: images.map((img, i) => ({ url: img.url, order: i })),
      },
      {
        onSuccess: () => {
          Alert.alert('Listed!', 'Your item is now live on Souk.', [
            { text: 'View', onPress: () => router.push('/') },
          ])
          // Reset form
          setImages([]); setTitle(''); setDescription(''); setCategory(''); setBrand('')
          setSize(''); setCondition(''); setPrice(''); setArea('')
          setOpenToOffers(false); setOpenToSwaps(false)
        },
        onError: (err) => Alert.alert('Error', err.message),
      }
    )
  }

  const priceNum = parseFloat(price)
  const serviceFee = isNaN(priceNum) ? 0 : priceNum * 0.05
  const totalBuyerPays = isNaN(priceNum) ? 0 : priceNum * 1.05

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-souk-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="text-souk-white text-2xl font-bold mb-6">List an item</Text>

        {/* Photos */}
        <Text className="text-souk-white font-semibold mb-2">Photos *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {images.map((img, i) => (
            <View key={img.key} className="mr-2 relative">
              <Image source={{ uri: img.url }} style={{ width: 80, height: 80, borderRadius: 8 }} contentFit="cover" />
              <TouchableOpacity
                className="absolute -top-1.5 -right-1.5 bg-souk-error rounded-full w-5 h-5 items-center justify-center"
                onPress={() => removeImage(i)}
              >
                <Ionicons name="close" size={12} color="white" />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 10 && (
            <TouchableOpacity
              className="w-20 h-20 bg-souk-charcoal rounded-lg items-center justify-center border border-dashed border-souk-muted"
              onPress={pickImages}
              disabled={uploadingImages}
            >
              {uploadingImages ? (
                <ActivityIndicator color="#D4A853" />
              ) : (
                <Ionicons name="add" size={28} color="#8A8A8A" />
              )}
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Title */}
        <Text className="text-souk-white font-semibold mb-1.5">Title *</Text>
        <TextInput
          className="bg-souk-charcoal text-souk-white rounded-xl px-3.5 py-3 mb-4"
          placeholder="e.g. Chanel Boy Bag — Beige"
          placeholderTextColor="#8A8A8A"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* Category */}
        <Text className="text-souk-white font-semibold mb-1.5">Category *</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              className={`px-3 py-1.5 rounded-full border ${category === cat ? 'bg-souk-gold border-souk-gold' : 'border-souk-muted bg-souk-charcoal'}`}
              onPress={() => setCategory(cat)}
            >
              <Text className={`text-sm capitalize ${category === cat ? 'text-souk-black font-semibold' : 'text-souk-muted-light'}`}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Condition */}
        <Text className="text-souk-white font-semibold mb-1.5">Condition *</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {CONDITIONS.map(c => (
            <TouchableOpacity
              key={c}
              className={`px-3 py-1.5 rounded-full border ${condition === c ? 'bg-souk-gold border-souk-gold' : 'border-souk-muted bg-souk-charcoal'}`}
              onPress={() => setCondition(c)}
            >
              <Text className={`text-sm ${condition === c ? 'text-souk-black font-semibold' : 'text-souk-muted-light'}`}>
                {CONDITION_LABELS[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Brand & Size */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-souk-white font-semibold mb-1.5">Brand</Text>
            <TextInput
              className="bg-souk-charcoal text-souk-white rounded-xl px-3.5 py-3"
              placeholder="e.g. Gucci"
              placeholderTextColor="#8A8A8A"
              value={brand}
              onChangeText={setBrand}
            />
          </View>
          <View className="flex-1">
            <Text className="text-souk-white font-semibold mb-1.5">Size</Text>
            <TextInput
              className="bg-souk-charcoal text-souk-white rounded-xl px-3.5 py-3"
              placeholder="S, M, 38, OS…"
              placeholderTextColor="#8A8A8A"
              value={size}
              onChangeText={setSize}
            />
          </View>
        </View>

        {/* Price */}
        <Text className="text-souk-white font-semibold mb-1.5">Price (AED) *</Text>
        <TextInput
          className="bg-souk-charcoal text-souk-white rounded-xl px-3.5 py-3 mb-1.5"
          placeholder="0.00"
          placeholderTextColor="#8A8A8A"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />
        {!isNaN(priceNum) && priceNum > 0 && (
          <View className="bg-souk-charcoal rounded-xl p-3 mb-4">
            <View className="flex-row justify-between mb-1">
              <Text className="text-souk-muted text-sm">Platform fee (5%)</Text>
              <Text className="text-souk-muted text-sm">AED {serviceFee.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-souk-white text-sm font-medium">You receive</Text>
              <Text className="text-souk-gold text-sm font-semibold">AED {priceNum.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-souk-muted text-xs">Buyer pays</Text>
              <Text className="text-souk-muted text-xs">AED {totalBuyerPays.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Area */}
        <Text className="text-souk-white font-semibold mb-1.5">Meetup Area *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {DUBAI_AREAS.map(a => (
            <TouchableOpacity
              key={a}
              className={`px-3 py-1.5 rounded-full mr-2 border ${area === a ? 'bg-souk-gold border-souk-gold' : 'border-souk-muted bg-souk-charcoal'}`}
              onPress={() => setArea(a)}
            >
              <Text className={`text-sm ${area === a ? 'text-souk-black font-semibold' : 'text-souk-muted-light'}`}>
                {a}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Description */}
        <Text className="text-souk-white font-semibold mb-1.5">Description</Text>
        <TextInput
          className="bg-souk-charcoal text-souk-white rounded-xl px-3.5 py-3 mb-4"
          placeholder="Add more details about the item…"
          placeholderTextColor="#8A8A8A"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={{ height: 100, textAlignVertical: 'top' }}
          maxLength={2000}
        />

        {/* Toggles */}
        <View className="bg-souk-charcoal rounded-xl p-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-souk-white font-medium">Open to offers</Text>
              <Text className="text-souk-muted text-xs">Allow buyers to negotiate</Text>
            </View>
            <Switch
              value={openToOffers}
              onValueChange={setOpenToOffers}
              trackColor={{ false: '#2A2A2A', true: '#D4A853' }}
              thumbColor="white"
            />
          </View>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-souk-white font-medium">Open to swaps</Text>
              <Text className="text-souk-muted text-xs">Exchange for other items</Text>
            </View>
            <Switch
              value={openToSwaps}
              onValueChange={setOpenToSwaps}
              trackColor={{ false: '#2A2A2A', true: '#D4A853' }}
              thumbColor="white"
            />
          </View>
        </View>

        <Button
          title="List Item"
          size="lg"
          fullWidth
          loading={isPending}
          onPress={handleSubmit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
