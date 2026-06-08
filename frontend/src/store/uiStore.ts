import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  selectedSector: string | null
  globalSearch: string
  toggleSidebar: () => void
  toggleMobileSidebar: () => void
  closeMobileSidebar: () => void
  setSelectedSector: (sector: string | null) => void
  setGlobalSearch: (search: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  selectedSector: null,
  globalSearch: '',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  setSelectedSector: (sector) => set({ selectedSector: sector }),
  setGlobalSearch: (search) => set({ globalSearch: search }),
}))
