import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

type Step = 'personal' | 'identity' | 'bank' | 'done'

export default function OnboardScreen() {
  const { updateUser } = useAuthStore()
  const [step, setStep] = useState<Step>('personal')
  const [loading, setLoading] = useState(false)

  // Step 1
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+971')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')

  // Step 2
  const [frontImage, setFrontImage] = useState<string | null>(null)
  const [frontFileId, setFrontFileId] = useState<string | null>(null)
  const [backImage, setBackImage] = useState<string | null>(null)
  const [backFileId, setBackFileId] = useState<string | null>(null)

  // Step 3
  const [holderName, setHolderName] = useState('')
  const [iban, setIban] = useState('AE')

  async function handlePersonal() {
    if (!firstName || !lastName || !email || !phone) {
      return Alert.alert('Missing fields', 'Please fill in all required fields.')
    }
    setLoading(true)
    try {
      await api.post('/stripe/onboard', {
        firstName, lastName, email, phone,
        dateOfBirth: {
          day: parseInt(dobDay, 10),
          month: parseInt(dobMonth, 10),
          year: parseInt(dobYear, 10),
        },
      })
      setStep('identity')
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function pickIdImage(side: 'front' | 'back') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    })
    if (result.canceled || !result.assets?.[0]) return

    setLoading(true)
    try {
      const asset = result.assets[0]
      const fileRes = await fetch(asset.uri)
      const blob = await fileRes.blob()
      const base64 = await blobToBase64(blob)

      const res = await api.post<{ fileId: string }>('/stripe/create-file', {
        base64,
        contentType: 'image/jpeg',
        purpose: 'identity_document',
      })

      if (side === 'front') {
        setFrontImage(asset.uri)
        setFrontFileId(res.fileId)
      } else {
        setBackImage(asset.uri)
        setBackFileId(res.fileId)
      }
    } catch (err: unknown) {
      Alert.alert('Upload failed', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleIdentity() {
    if (!frontFileId) return Alert.alert('Missing', 'Please upload the front of your ID.')
    setLoading(true)
    try {
      await api.patch('/stripe/onboard', {
        step: 'identity',
        frontFileId,
        backFileId: backFileId || undefined,
      })
      setStep('bank')
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleBank() {
    if (!holderName || !iban) return Alert.alert('Missing fields', 'Please fill in all bank details.')
    if (!iban.match(/^AE\d{21}$/)) {
      return Alert.alert('Invalid IBAN', 'Please enter a valid 23-character UAE IBAN starting with AE.')
    }
    setLoading(true)
    try {
      await api.patch('/stripe/onboard', {
        step: 'bank',
        accountHolderName: holderName,
        iban,
      })
      updateUser({ stripeOnboardingComplete: true })
      setStep('done')
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const STEPS: Step[] = ['personal', 'identity', 'bank']
  const stepIndex = STEPS.indexOf(step)

  if (step === 'done') {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center px-8">
        <View className="w-20 h-20 bg-souk-gold rounded-full items-center justify-center mb-6">
          <Ionicons name="checkmark" size={40} color="#0F0E0E" />
        </View>
        <Text className="text-souk-white text-2xl font-bold text-center mb-2">
          You're a verified seller!
        </Text>
        <Text className="text-souk-muted text-center mb-8">
          Your account is being reviewed by Stripe. You can start listing items now.
          Payouts will be enabled once verification completes (usually within 1–2 business days).
        </Text>
        <Button title="Start Listing" fullWidth onPress={() => router.replace('/(tabs)/sell')} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-souk-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Progress bar */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row gap-2">
          {STEPS.map((s, i) => (
            <View
              key={s}
              className={`flex-1 h-1 rounded-full ${i <= stepIndex ? 'bg-souk-gold' : 'bg-souk-charcoal'}`}
            />
          ))}
        </View>
        <Text className="text-souk-muted text-xs mt-1">
          Step {stepIndex + 1} of {STEPS.length}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {step === 'personal' && (
          <View>
            <Text className="text-souk-white text-xl font-bold mb-1">Personal details</Text>
            <Text className="text-souk-muted text-sm mb-6">Required for identity verification and tax compliance.</Text>

            {[
              ['First name', firstName, setFirstName],
              ['Last name', lastName, setLastName],
              ['Email address', email, setEmail],
              ['Phone number (+971…)', phone, setPhone],
            ].map(([label, value, setter]) => (
              <View key={label as string} className="mb-4">
                <Text className="text-souk-white font-medium mb-1.5">{label as string}</Text>
                <TextInput
                  className="bg-souk-charcoal text-souk-white rounded-xl px-3.5 py-3"
                  placeholderTextColor="#8A8A8A"
                  placeholder={label as string}
                  value={value as string}
                  onChangeText={setter as (t: string) => void}
                  keyboardType={label === 'Email address' ? 'email-address' : label === 'Phone number (+971…)' ? 'phone-pad' : 'default'}
                  autoCapitalize={label === 'Email address' ? 'none' : 'words'}
                />
              </View>
            ))}

            <Text className="text-souk-white font-medium mb-1.5">Date of birth</Text>
            <View className="flex-row gap-2 mb-6">
              {[['DD', dobDay, setDobDay], ['MM', dobMonth, setDobMonth], ['YYYY', dobYear, setDobYear]].map(
                ([ph, val, setter]) => (
                  <TextInput
                    key={ph as string}
                    className="flex-1 bg-souk-charcoal text-souk-white rounded-xl px-3 py-3 text-center"
                    placeholder={ph as string}
                    placeholderTextColor="#8A8A8A"
                    value={val as string}
                    onChangeText={setter as (t: string) => void}
                    keyboardType="number-pad"
                    maxLength={ph === 'YYYY' ? 4 : 2}
                  />
                )
              )}
            </View>

            <Button title="Continue" size="lg" fullWidth loading={loading} onPress={handlePersonal} />
          </View>
        )}

        {step === 'identity' && (
          <View>
            <Text className="text-souk-white text-xl font-bold mb-1">Identity verification</Text>
            <Text className="text-souk-muted text-sm mb-6">
              Upload your Emirates ID or passport. Images go directly to Stripe and are never stored on Souk's servers.
            </Text>

            {[
              ['Front of ID', frontImage, () => pickIdImage('front')],
              ['Back of ID (optional)', backImage, () => pickIdImage('back')],
            ].map(([label, img, onPress]) => (
              <View key={label as string} className="mb-4">
                <Text className="text-souk-white font-medium mb-1.5">{label as string}</Text>
                <Button
                  title={(img as string | null) ? 'Change photo' : 'Upload photo'}
                  variant="secondary"
                  size="md"
                  fullWidth
                  loading={loading}
                  onPress={onPress as () => void}
                />
                {(img as string | null) && (
                  <Image
                    source={{ uri: img as string }}
                    style={{ width: '100%', height: 140, borderRadius: 12, marginTop: 8 }}
                    contentFit="cover"
                  />
                )}
              </View>
            ))}

            <Button title="Continue" size="lg" fullWidth loading={loading} onPress={handleIdentity} />
          </View>
        )}

        {step === 'bank' && (
          <View>
            <Text className="text-souk-white text-xl font-bold mb-1">Bank account</Text>
            <Text className="text-souk-muted text-sm mb-6">
              Add your UAE bank account to receive payouts. Minimum payout is AED 50.
            </Text>

            <Text className="text-souk-white font-medium mb-1.5">Account holder name</Text>
            <TextInput
              className="bg-souk-charcoal text-souk-white rounded-xl px-3.5 py-3 mb-4"
              placeholder="Full name as on bank account"
              placeholderTextColor="#8A8A8A"
              value={holderName}
              onChangeText={setHolderName}
            />

            <Text className="text-souk-white font-medium mb-1.5">IBAN</Text>
            <TextInput
              className="bg-souk-charcoal text-souk-white rounded-xl px-3.5 py-3 mb-1.5 font-mono"
              placeholder="AE070331234567890123456"
              placeholderTextColor="#8A8A8A"
              value={iban}
              onChangeText={setIban}
              autoCapitalize="characters"
              maxLength={23}
            />
            <Text className="text-souk-muted text-xs mb-6">
              UAE IBAN: 23 characters starting with AE
            </Text>

            <Button title="Complete Setup" size="lg" fullWidth loading={loading} onPress={handleBank} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
