import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  leadId?: string
}

interface AIState {
  chatOpen: boolean
  messages: ChatMessage[]
  isStreaming: boolean
  currentLeadId: string | null
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  addMessage: (msg: ChatMessage) => void
  appendToLastMessage: (text: string) => void
  setStreaming: (val: boolean) => void
  setCurrentLeadId: (id: string | null) => void
  clearMessages: () => void
}

export const useAIStore = create<AIState>((set) => ({
  chatOpen: false,
  messages: [],
  isStreaming: false,
  currentLeadId: null,
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendToLastMessage: (text) =>
    set((s) => {
      const msgs = [...s.messages]
      if (msgs.length && msgs[msgs.length - 1].role === 'assistant') {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: msgs[msgs.length - 1].content + text,
        }
      }
      return { messages: msgs }
    }),
  setStreaming: (val) => set({ isStreaming: val }),
  setCurrentLeadId: (id) => set({ currentLeadId: id }),
  clearMessages: () => set({ messages: [] }),
}))
