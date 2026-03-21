import React from 'react'
import { View, Text, FlatList, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'

interface MeetupPoint {
  id: string
  name: string
  address: string
  area: string
  verified: boolean
}

function useMeetupPoints() {
  // For now, use static data matching the seeded DB points
  // Replace with api.get('/meetup-points') when endpoint is added
  return useQuery({
    queryKey: ['meetup-points'],
    queryFn: async (): Promise<MeetupPoint[]> => [
      { id: '1', name: 'Dubai Mall Main Entrance', address: 'Financial Centre Road, Downtown Dubai', area: 'Downtown Dubai', verified: true },
      { id: '2', name: 'Mall of the Emirates Food Court', address: 'Sheikh Zayed Road, Al Barsha', area: 'Al Barsha', verified: true },
      { id: '3', name: 'JBR The Walk — Roxy Cinemas', address: 'Jumeirah Beach Residence', area: 'JBR', verified: true },
      { id: '4', name: 'City Walk Entrance', address: 'Al Safa Street, Al Wasl', area: 'City Walk', verified: true },
      { id: '5', name: 'Global Village Main Gate', address: 'Sheikh Mohammed Bin Zayed Road', area: 'Global Village', verified: true },
      { id: '6', name: 'Dubai Marina Mall', address: 'Sheikh Zayed Road, Dubai Marina', area: 'Dubai Marina', verified: true },
      { id: '7', name: 'Ibn Battuta Mall Gate 1', address: 'Sheikh Zayed Road, Jebel Ali', area: 'Ibn Battuta', verified: true },
      { id: '8', name: 'Deira City Centre Entrance', address: 'Garhoud Road, Deira', area: 'Deira', verified: true },
    ],
    staleTime: Infinity,
  })
}

export default function SoukPointsScreen() {
  const { data: points, isLoading } = useMeetupPoints()

  if (isLoading) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center">
        <ActivityIndicator color="#D4A853" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-souk-black">
      <FlatList
        data={points}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View className="mb-4">
            <Text className="text-souk-white text-xl font-bold mb-1">Souk Points</Text>
            <Text className="text-souk-muted text-sm">
              Verified safe meetup locations across Dubai for exchanging items.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-souk-charcoal rounded-xl p-4 mb-2 flex-row items-start gap-3">
            <View className="w-10 h-10 bg-souk-gold rounded-full items-center justify-center mt-0.5">
              <Ionicons name="location" size={20} color="#0F0E0E" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-souk-white font-semibold text-sm">{item.name}</Text>
                {item.verified && (
                  <View className="bg-souk-gold rounded-full px-1.5 py-0.5">
                    <Text className="text-souk-black text-xs font-bold" style={{ fontSize: 9 }}>Verified</Text>
                  </View>
                )}
              </View>
              <Text className="text-souk-muted text-xs mt-1">{item.address}</Text>
              <Text className="text-souk-muted text-xs mt-0.5">{item.area}</Text>
            </View>
          </View>
        )}
      />
    </View>
  )
}
