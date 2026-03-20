import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface WalletBalance {
  available: number
  pending: number
  currency: string
  payoutsEnabled: boolean
  onboarded: boolean
}

export interface Transaction {
  id: string
  userId: string
  orderId?: string
  type: 'sale' | 'purchase' | 'payout' | 'refund'
  amountAed: number
  stripeReference?: string
  status: 'pending' | 'completed' | 'failed'
  description?: string
  createdAt: string
}

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get<WalletBalance>('/wallet'),
    staleTime: 60_000,
  })
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get<{ transactions: Transaction[] }>('/wallet/transactions'),
  })
}

export function useRequestPayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (amountAed?: number) => api.post('/stripe/payout', amountAed ? { amountAed } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
