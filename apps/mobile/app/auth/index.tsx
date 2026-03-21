import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { router } from 'expo-router'
import { useSendOtp, useVerifyOtp } from '@/features/auth/hooks'
import { Button } from '@/components/ui/Button'

const PRIVACY_URL = 'https://souk.ae/privacy'
const TERMS_URL = 'https://souk.ae/terms'
const RESEND_COOLDOWN_SECONDS = 30

export default function AuthScreen() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('+971')
  const [otp, setOtp] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRef = useRef<TextInput>(null)

  const { mutate: sendOtp, isPending: isSendingOtp } = useSendOtp()
  const { mutate: verifyOtp, isPending: isVerifyingOtp } = useVerifyOtp()

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleSendOtp = useCallback(() => {
    if (phone.length < 12) return Alert.alert('Invalid number', 'Enter a valid UAE mobile number.')
    sendOtp(phone, {
      onSuccess: () => {
        setStep('otp')
        setResendCooldown(RESEND_COOLDOWN_SECONDS)
        setTimeout(() => otpRef.current?.focus(), 300)
      },
      onError: (err) => Alert.alert('Error', err.message),
    })
  }, [phone, sendOtp])

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
              disabled={isSendingOtp || resendCooldown > 0}
            >
              {isSendingOtp ? (
                <ActivityIndicator color="#D4A853" />
              ) : resendCooldown > 0 ? (
                <Text className="text-souk-muted">Resend code in {resendCooldown}s</Text>
              ) : (
                <Text className="text-souk-gold">Resend code</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text className="text-souk-muted text-xs text-center mt-12 px-4">
          By continuing, you agree to Souk's{' '}
          <Text className="text-souk-gold underline" onPress={() => Linking.openURL(TERMS_URL)}>
            Terms of Service
          </Text>{' '}and{' '}
          <Text className="text-souk-gold underline" onPress={() => Linking.openURL(PRIVACY_URL)}>
            Privacy Policy
          </Text>.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}
