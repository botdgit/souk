import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Order {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  amountAed: number
  serviceFeeAed: number
  deliveryFeeAed: number
  totalAed: number
  stripePaymentIntentId?: string
  status: string
  deliveryMethod: 'meetup' | 'delivery'
  meetupPointId?: string
  createdAt: string
  listing?: {
    id: string
    title: string
    images: Array<{ url: string }>
  }
}

export function useOrders(role: 'buyer' | 'seller' = 'buyer') {
  return useQuery({
    queryKey: ['orders', role],
    queryFn: () => api.get<{ orders: Order[] }>(`/orders?role=${role}`),
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      listingId: string
      deliveryMethod: 'meetup' | 'delivery'
      meetupPointId?: string
      deliveryFeeAed?: number
    }) => api.post<{ order: Order; clientSecret: string }>('/orders', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useConfirmDelivery(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/confirm-delivery`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
}
