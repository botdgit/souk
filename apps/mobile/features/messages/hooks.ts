import { useQuery, useMutation, useQueryClient, useInfiniteQuery, InfiniteData } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export interface Message {
  id: string
  conversationId: string
  senderId: string
  body?: string
  imageUrl?: string
  type: 'text' | 'image' | 'offer' | 'system'
  offerId?: string
  readAt?: string
  createdAt: string
  sender?: {
    id: string
    displayName: string
    avatarUrl?: string
  }
}

export interface Conversation {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  lastMessageAt: string
  unreadCountBuyer: number
  unreadCountSeller: number
  listing?: { id: string; title: string; images: Array<{ url: string }> }
  buyer?: { id: string; displayName: string; avatarUrl?: string }
  seller?: { id: string; displayName: string; avatarUrl?: string }
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ conversations: Conversation[] }>('/conversations'),
  })
}

export function useMessages(conversationId: string) {
  const queryClient = useQueryClient()

  const query = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam = 1 }) =>
      api.get<{ messages: Message[]; total: number }>(
        `/conversations/${conversationId}/messages?page=${pageParam}`
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.flatMap(p => p.messages).length
      return fetched < (lastPage.total ?? 0) ? allPages.length + 1 : undefined
    },
  })

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          queryClient.setQueryData(
            ['messages', conversationId],
            (old: InfiniteData<{ messages: Message[]; total: number }> | undefined) => {
              if (!old) return old
              const firstPage = old.pages[0]
              return {
                ...old,
                pages: [
                  {
                    ...firstPage,
                    messages: [...firstPage.messages, payload.new as Message],
                  },
                  ...old.pages.slice(1),
                ],
              }
            }
          )
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, queryClient])

  return query
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { body?: string; imageUrl?: string }) =>
      api.post<{ message: Message }>(`/conversations/${conversationId}/messages`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })
}

export function useStartConversation() {
  return useMutation({
    mutationFn: (listingId: string) =>
      api.post<{ conversation: Conversation }>('/conversations', { listingId }),
  })
}
