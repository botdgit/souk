import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { useWallet, useTransactions, useRequestPayout, type Transaction } from '@/features/wallet/hooks'
import { useOrders } from '@/features/orders/hooks'
import { useConfirmDelivery } from '@/features/orders/hooks'
import { useAuthStore } from '@/stores/authStore'

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  sale: 'arrow-down-circle',
  purchase: 'arrow-up-circle',
  payout: 'wallet-outline',
  refund: 'refresh-circle',
}

const STATUS_COLORS = {
  pending: '#8A8A8A',
  completed: '#38A169',
  failed: '#E53E3E',
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const isCredit = txn.type === 'sale' || txn.type === 'refund'
  const amountAed = Math.abs(txn.amountAed) / 100

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-souk-charcoal">
      <Ionicons
        name={TYPE_ICONS[txn.type] ?? 'ellipse-outline'}
        size={22}
        color={isCredit ? '#38A169' : '#8A8A8A'}
        style={{ marginRight: 12 }}
      />
      <View className="flex-1">
        <Text className="text-souk-white text-sm font-medium capitalize">{txn.type}</Text>
        <Text className="text-souk-muted text-xs mt-0.5">
          {formatDistanceToNow(new Date(txn.createdAt), { addSuffix: true })}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className={`font-semibold text-sm ${isCredit ? 'text-souk-success' : 'text-souk-white'}`}
        >
          {isCredit ? '+' : '-'}AED {amountAed.toFixed(2)}
        </Text>
        <Text className="text-xs" style={{ color: STATUS_COLORS[txn.status] }}>
          {txn.status}
        </Text>
      </View>
    </View>
  )
}

export default function WalletScreen() {
  const { user } = useAuthStore()
  const { data: wallet, isLoading: walletLoading } = useWallet()
  const { data: txnData, isLoading: txnLoading } = useTransactions()
  const { data: ordersData } = useOrders('buyer')
  const { mutate: requestPayout, isPending: isPayingOut } = useRequestPayout()
  const [showPayoutInput, setShowPayoutInput] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')

  if (!user) {
    return (
      <View className="flex-1 bg-souk-black items-center justify-center px-8">
        <Text className="text-souk-muted text-center">Sign in to view your wallet.</Text>
      </View>
    )
  }

  if (walletLoading) {
    return <View className="flex-1 bg-souk-black items-center justify-center"><ActivityIndicator color="#D4A853" /></View>
  }

  const availableAed = ((wallet?.available ?? 0) / 100).toFixed(2)
  const pendingAed = ((wallet?.pending ?? 0) / 100).toFixed(2)

  function handlePayout() {
    const amount = parseFloat(payoutAmount)
    if (!payoutAmount) {
      requestPayout(undefined, {
        onSuccess: () => Alert.alert('Payout requested', 'Your payout is being processed.'),
        onError: (err) => Alert.alert('Error', err.message),
      })
    } else {
      if (isNaN(amount) || amount < 50) {
        return Alert.alert('Invalid amount', 'Minimum payout is AED 50.')
      }
      requestPayout(Math.round(amount * 100), {
        onSuccess: () => {
          Alert.alert('Payout requested', 'Your payout is being processed.')
          setShowPayoutInput(false)
          setPayoutAmount('')
        },
        onError: (err) => Alert.alert('Error', err.message),
      })
    }
  }

  const pendingOrders = ordersData?.orders.filter(o => ['paid', 'shipped'].includes(o.status)) ?? []

  return (
    <ScrollView className="flex-1 bg-souk-black">
      {/* Balance Card */}
      <View className="mx-4 mt-4 mb-4 bg-souk-charcoal rounded-2xl p-5">
        <Text className="text-souk-muted text-sm mb-4">Your balance</Text>
        <View className="flex-row gap-6 mb-5">
          <View>
            <Text className="text-souk-muted text-xs mb-1">Available</Text>
            <Text className="text-souk-gold text-3xl font-bold">AED {availableAed}</Text>
          </View>
          <View className="w-px bg-souk-muted" />
          <View>
            <Text className="text-souk-muted text-xs mb-1">Pending</Text>
            <Text className="text-souk-white text-3xl font-semibold">AED {pendingAed}</Text>
          </View>
        </View>

        {!user.stripeOnboardingComplete ? (
          <Button
            title="Complete Seller Setup"
            size="md"
            fullWidth
            onPress={() => router.push('/onboard')}
          />
        ) : !user.stripePayoutsEnabled ? (
          <Text className="text-souk-muted text-xs text-center">
            Verification in progress — payouts will be enabled soon
          </Text>
        ) : (
          <View>
            {showPayoutInput ? (
              <View>
                <TextInput
                  className="bg-souk-black text-souk-white rounded-xl px-3.5 py-3 mb-3 text-center text-lg"
                  placeholder="Amount (AED) — leave blank for all"
                  placeholderTextColor="#8A8A8A"
                  keyboardType="decimal-pad"
                  value={payoutAmount}
                  onChangeText={setPayoutAmount}
                />
                <View className="flex-row gap-2">
                  <Button title="Cancel" variant="ghost" size="sm" onPress={() => setShowPayoutInput(false)} style={{ flex: 1 }} />
                  <Button title="Withdraw" size="sm" loading={isPayingOut} onPress={handlePayout} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <Button
                title="Withdraw Funds"
                size="md"
                fullWidth
                disabled={(wallet?.available ?? 0) < 5000}
                onPress={() => setShowPayoutInput(true)}
              />
            )}
            <Text className="text-souk-muted text-xs text-center mt-2">
              Min. AED 50 · Arrives in 1–2 business days
            </Text>
          </View>
        )}
      </View>

      {/* Pending Orders — Confirm Delivery */}
      {pendingOrders.length > 0 && (
        <View className="mx-4 mb-4">
          <Text className="text-souk-white font-semibold mb-2">Awaiting your confirmation</Text>
          {pendingOrders.map(order => (
            <PendingOrderCard key={order.id} order={order} />
          ))}
        </View>
      )}

      {/* Transaction History */}
      <View className="mb-6">
        <Text className="text-souk-white font-semibold px-4 mb-2">Transactions</Text>
        {txnLoading ? (
          <ActivityIndicator color="#D4A853" style={{ margin: 20 }} />
        ) : (txnData?.transactions?.length ?? 0) === 0 ? (
          <Text className="text-souk-muted text-center py-8">No transactions yet.</Text>
        ) : (
          txnData?.transactions.map(txn => <TransactionRow key={txn.id} txn={txn} />)
        )}
      </View>
    </ScrollView>
  )
}

function PendingOrderCard({ order }: { order: { id: string; listing?: { title: string; images: Array<{ url: string }> } } }) {
  const { mutate: confirmDelivery, isPending } = useConfirmDelivery(order.id)

  function handleConfirm() {
    Alert.alert(
      'Confirm receipt?',
      'Only confirm once you have received the item. Payment will be released to the seller.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => confirmDelivery(undefined, {
            onError: (err) => Alert.alert('Error', err.message),
          }),
        },
      ]
    )
  }

  return (
    <View className="bg-souk-charcoal rounded-xl p-3 mb-2 flex-row items-center gap-3">
      <View className="flex-1">
        <Text className="text-souk-white text-sm font-medium" numberOfLines={1}>
          {order.listing?.title ?? 'Item'}
        </Text>
        <Text className="text-souk-muted text-xs">Tap to confirm you've received this</Text>
      </View>
      <Button title="Confirm" size="sm" loading={isPending} onPress={handleConfirm} />
    </View>
  )
}
