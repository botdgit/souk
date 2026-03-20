import React, { useState, useEffect } from 'react'
import { View, Text, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useStripe } from '@stripe/stripe-react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '@/components/ui/Button'

export default function CheckoutScreen() {
  const { orderId, clientSecret } = useLocalSearchParams<{
    orderId: string
    clientSecret: string
  }>()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Souk',
        style: 'alwaysDark',
        appearance: {
          colors: {
            primary: '#D4A853',
            background: '#0F0E0E',
            componentBackground: '#2A2A2A',
            componentText: '#FAFAFA',
            placeholderText: '#8A8A8A',
          },
        },
      })

      if (error) {
        Alert.alert('Setup failed', error.message)
        router.back()
        return
      }

      setReady(true)
      setLoading(false)
    }

    init()
  }, [clientSecret, initPaymentSheet])

  async function handlePay() {
    setLoading(true)
    const { error } = await presentPaymentSheet()
    setLoading(false)

    if (error) {
      if (error.code !== 'Canceled') {
        Alert.alert('Payment failed', error.message)
      }
      return
    }

    // Payment succeeded
    router.replace({
      pathname: '/checkout/[orderId]',
      params: { orderId, success: 'true' },
    })
  }

  if (loading && !ready) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center">
        <ActivityIndicator color="#D4A853" />
        <Text className="text-souk-muted mt-3">Preparing secure checkout…</Text>
      </View>
    )
  }

  const isSuccess = useLocalSearchParams<{ success?: string }>().success === 'true'

  if (isSuccess) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center px-8">
        <View className="w-20 h-20 bg-souk-gold rounded-full items-center justify-center mb-6">
          <Ionicons name="checkmark" size={40} color="#0F0E0E" />
        </View>
        <Text className="text-souk-white text-2xl font-bold text-center mb-2">
          Payment confirmed!
        </Text>
        <Text className="text-souk-muted text-center mb-8">
          Your payment is held securely until you confirm receipt of the item. Arrange meetup
          with the seller.
        </Text>
        <Button
          title="View Order"
          fullWidth
          onPress={() => router.replace('/wallet')}
        />
        <Button
          title="Continue Shopping"
          variant="ghost"
          fullWidth
          onPress={() => router.replace('/')}
          style={{ marginTop: 12 }}
        />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-souk-black px-4 pt-6">
      <View className="bg-souk-charcoal rounded-2xl p-4 mb-6">
        <View className="flex-row items-center gap-3 mb-3">
          <Ionicons name="shield-checkmark" size={22} color="#D4A853" />
          <Text className="text-souk-white font-semibold">Secure Escrow Payment</Text>
        </View>
        <Text className="text-souk-muted text-sm leading-5">
          Your payment will be held securely by Souk until you confirm you've received the item.
          The seller only gets paid after successful delivery.
        </Text>
      </View>

      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="card-outline" size={18} color="#8A8A8A" />
          <Text className="text-souk-white font-medium">Accepted payments</Text>
        </View>
        <View className="flex-row gap-3">
          <View className="bg-souk-charcoal rounded-lg px-3 py-2">
            <Text className="text-souk-muted text-xs">Visa / Mastercard</Text>
          </View>
          <View className="bg-souk-charcoal rounded-lg px-3 py-2">
            <Text className="text-souk-muted text-xs">Apple Pay</Text>
          </View>
          <View className="bg-souk-charcoal rounded-lg px-3 py-2">
            <Text className="text-souk-muted text-xs">Google Pay</Text>
          </View>
        </View>
      </View>

      <Button
        title="Pay Securely"
        size="lg"
        fullWidth
        loading={loading}
        disabled={!ready}
        onPress={handlePay}
      />
      <Text className="text-souk-muted text-xs text-center mt-3">
        Powered by Stripe — PCI DSS Level 1 certified
      </Text>
    </View>
  )
}
