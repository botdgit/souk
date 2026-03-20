import React from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'

interface AvatarProps {
  uri?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showVerified?: boolean
}

const SIZES = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
}

export function Avatar({ uri, name, size = 'md', showVerified = false }: AvatarProps) {
  const px = SIZES[size]
  const initial = name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <View style={{ width: px, height: px, position: 'relative' }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: px, height: px, borderRadius: px / 2 }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={{ width: px, height: px, borderRadius: px / 2 }}
          className="bg-souk-charcoal items-center justify-center"
        >
          <Text className="text-souk-gold font-semibold" style={{ fontSize: px * 0.4 }}>
            {initial}
          </Text>
        </View>
      )}
      {showVerified && (
        <View
          className="absolute -bottom-0.5 -right-0.5 bg-souk-gold rounded-full items-center justify-center"
          style={{ width: px * 0.35, height: px * 0.35 }}
        >
          <Text style={{ fontSize: px * 0.2, color: '#0F0E0E' }}>✓</Text>
        </View>
      )}
    </View>
  )
}
