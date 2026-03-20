import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useSendOtp, useVerifyOtp } from '@/features/auth/hooks'
import { Button } from '@/components/ui/Button'

export default function AuthScreen() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('+971')
  const [otp, setOtp] = useState('')
  const otpRef = useRef<TextInput>(null)

  const { mutate: sendOtp, isPending: isSendingOtp } = useSendOtp()
  const { mutate: verifyOtp, isPending: isVerifyingOtp } = useVerifyOtp()

  function handleSendOtp() {
    if (phone.length < 12) return Alert.alert('Invalid number', 'Enter a valid UAE mobile number.')
    sendOtp(phone, {
      onSuccess: () => {
        setStep('otp')
        setTimeout(() => otpRef.current?.focus(), 300)
      },
      onError: (err) => Alert.alert('Error', err.message),
    })
  }

  function handleVerifyOtp() {
    if (otp.length !== 6) return Alert.alert('Invalid code', 'Enter the 6-digit code.')
    verifyOtp(
      { phone, token: otp },
      {
        onSuccess: () => router.replace('/'),
        onError: (err) => Alert.alert('Verification failed', err.message),
      }
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-souk-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 px-6 pt-16">
        {/* Logo / Brand */}
        <View className="mb-12">
          <Text className="text-souk-gold text-4xl font-bold tracking-wider">Souk</Text>
          <Text className="text-souk-muted mt-1">Dubai's Fashion Exchange</Text>
        </View>

        {step === 'phone' ? (
          <View>
            <Text className="text-souk-white text-2xl font-bold mb-2">
              Enter your number
            </Text>
            <Text className="text-souk-muted mb-6">
              We'll send a verification code to your UAE mobile number.
            </Text>

            <TextInput
              className="bg-souk-charcoal text-souk-white rounded-xl px-4 py-4 text-lg mb-6"
              placeholder="+971 50 000 0000"
              placeholderTextColor="#8A8A8A"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoFocus
            />

            <Button
              title="Send Code"
              size="lg"
              fullWidth
              loading={isSendingOtp}
              onPress={handleSendOtp}
            />
          </View>
        ) : (
          <View>
            <Text className="text-souk-white text-2xl font-bold mb-2">
              Enter verification code
            </Text>
            <Text className="text-souk-muted mb-6">
              Sent to {phone}.{' '}
              <Text className="text-souk-gold" onPress={() => setStep('phone')}>
                Change number
              </Text>
            </Text>

            <TextInput
              ref={otpRef}
              className="bg-souk-charcoal text-souk-white rounded-xl px-4 py-4 text-2xl tracking-widest text-center mb-6"
              placeholder="000000"
              placeholderTextColor="#8A8A8A"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <Button
              title="Verify & Continue"
              size="lg"
              fullWidth
              loading={isVerifyingOtp}
              onPress={handleVerifyOtp}
            />

            <TouchableOpacity
              className="mt-4 items-center"
              onPress={handleSendOtp}
              disabled={isSendingOtp}
            >
              {isSendingOtp ? (
                <ActivityIndicator color="#D4A853" />
              ) : (
                <Text className="text-souk-gold">Resend code</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text className="text-souk-muted text-xs text-center mt-12 px-4">
          By continuing, you agree to Souk's Terms of Service and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}
