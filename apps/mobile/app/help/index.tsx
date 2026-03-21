import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const FAQ = [
  {
    q: 'How does Souk protect buyers?',
    a: 'Payments are held in escrow until you confirm receipt of the item. If something goes wrong, you can raise a dispute and our team will help resolve it.',
  },
  {
    q: 'How do I get paid as a seller?',
    a: 'Complete your seller verification, then funds from completed sales appear in your wallet. You can withdraw to your UAE bank account anytime (minimum AED 50).',
  },
  {
    q: 'What are Souk Points?',
    a: 'Souk Points are verified, safe public locations across Dubai where buyers and sellers can meet to exchange items.',
  },
  {
    q: 'What is the service fee?',
    a: 'Souk charges a 5% service fee on each transaction, added to the buyer\'s total at checkout. Sellers receive the full listed price.',
  },
  {
    q: 'How do I report a problem?',
    a: 'Contact us at support@souk.ae or use the report button on any listing or message thread.',
  },
]

export default function HelpScreen() {
  return (
    <ScrollView className="flex-1 bg-souk-black" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-souk-white text-xl font-bold mb-6">Help & Support</Text>

      <TouchableOpacity
        className="bg-souk-gold rounded-xl p-4 flex-row items-center gap-3 mb-6"
        onPress={() => Linking.openURL('mailto:support@souk.ae')}
      >
        <Ionicons name="mail" size={22} color="#0F0E0E" />
        <View className="flex-1">
          <Text className="text-souk-black font-semibold">Contact Support</Text>
          <Text className="text-souk-black text-xs opacity-80">support@souk.ae</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#0F0E0E" />
      </TouchableOpacity>

      <Text className="text-souk-white font-semibold text-lg mb-3">
        Frequently Asked Questions
      </Text>

      {FAQ.map((item, i) => (
        <View key={i} className="bg-souk-charcoal rounded-xl p-4 mb-2">
          <Text className="text-souk-white font-medium text-sm mb-1.5">{item.q}</Text>
          <Text className="text-souk-muted text-sm leading-5">{item.a}</Text>
        </View>
      ))}
    </ScrollView>
  )
}
