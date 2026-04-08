import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  selectedSector: string | null
  globalSearch: string
  toggleSidebar: () => void
  setSelectedSector: (sector: string | null) => void
  setGlobalSearch: (search: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  selectedSector: null,
  globalSearch: '',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSelectedSector: (sector) => set({ selectedSector: sector }),
  setGlobalSearch: (search) => set({ globalSearch: search }),
}))
