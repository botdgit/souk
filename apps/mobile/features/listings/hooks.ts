import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Listing {
  id: string
  sellerId: string
  title: string
  description?: string
  category: string
  brand?: string
  size?: string
  condition: string
  priceAed: number
  openToOffers: boolean
  openToSwaps: boolean
  area: string
  status: string
  images: Array<{ url: string; order: number; width?: number; height?: number }>
  seller?: {
    id: string
    displayName: string
    avatarUrl?: string
    isVerified: boolean
    ratingAvg: number
    ratingCount: number
  }
  createdAt: string
}

export interface ListingsFilter {
  q?: string
  category?: string
  area?: string
  minPrice?: number
  maxPrice?: number
  condition?: string
  size?: string
  sort?: string
}

export function useListings(filters: ListingsFilter = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })

  return useInfiniteQuery({
    queryKey: ['listings', filters],
    queryFn: ({ pageParam = 1 }) =>
      api.get<{ listings: Listing[]; total: number; page: number }>(
        `/listings?${params}&page=${pageParam}`
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const total = lastPage.total ?? 0
      const fetched = (lastPage.page ?? 1) * 20
      return fetched < total ? (lastPage.page ?? 1) + 1 : undefined
    },
  })
}

export function useListing(id: string) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: () => api.get<{ listing: Listing }>(`/listings/${id}`),
  })
}

export function useCreateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Listing>) => api.post('/listings', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['listings'] }),
  })
}

export function useUpdateListing(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Listing>) => api.patch(`/listings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', id] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

export function useSaveListing(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ saved: boolean }>(`/listings/${id}/save`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['listing', id] }),
  })
}

export function useSubmitOffer(listingId: string) {
  return useMutation({
    mutationFn: (data: { amountAed: number; message?: string }) =>
      api.post(`/listings/${listingId}/offer`, data),
  })
}
