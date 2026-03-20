import { create } from 'zustand'

interface UIState {
  activeFilters: {
    category?: string
    area?: string
    minPrice?: number
    maxPrice?: number
    condition?: string
    size?: string
    sort: string
  }
  setFilter: (key: string, value: unknown) => void
  clearFilters: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeFilters: { sort: 'newest' },

  setFilter: (key, value) =>
    set((state) => ({
      activeFilters: { ...state.activeFilters, [key]: value },
    })),

  clearFilters: () => set({ activeFilters: { sort: 'newest' } }),
}))
