import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Send,
  X,
  Bot,
  User,
  Sparkles,
  Loader2,
  Zap,
  BarChart3,
  FileText,
  Phone,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAIStore } from '@/store/aiStore'
import { useChat } from '@/hooks/useAI'
import { cn } from '@/lib/utils'

const QUICK_CHIPS = [
  { label: 'Who to call today?', icon: Phone },
  { label: 'Draft follow-up', icon: FileText },
  { label: 'Sector brief', icon: BarChart3 },
  { label: 'Campaign analysis', icon: Zap },
] as const

export default function AIChatPanel() {
  const {
    chatOpen,
    messages,
    isStreaming,
    currentLeadId,
    toggleChat,
    closeChat,
  } = useAIStore()
  const { sendMessage } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [chatOpen])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    await sendMessage(text, currentLeadId ?? undefined, messages)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChipClick = async (chipText: string) => {
    if (isStreaming) return
    setInput('')
    await sendMessage(chipText, currentLeadId ?? undefined, messages)
  }

  const formatTimestamp = (ts: Date) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={toggleChat}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center',
          'rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg',
          'text-white transition-all duration-300 hover:scale-105 hover:shadow-xl',
          'focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2',
          chatOpen && 'scale-0 opacity-0'
        )}
        aria-label="Open AI Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>

      {/* Backdrop */}
      {chatOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={closeChat}
        />
      )}

      {/* Chat panel */}
      <div
        className={cn(
          'fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[400px] flex-col',
          'border-l border-gray-200 bg-white shadow-2xl',
          'transform transition-transform duration-300 ease-in-out',
          chatOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">LeadForge AI</h2>
              <p className="text-xs text-purple-200">
                {isStreaming ? 'Thinking...' : 'Ready to help'}
              </p>
            </div>
          </div>
          <button
            onClick={closeChat}
            className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-50">
                <MessageSquare className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="mb-1 text-sm font-medium text-gray-900">
                Start a conversation
              </h3>
              <p className="max-w-[260px] text-xs text-gray-500">
                Ask about leads, campaigns, sector insights, or use the quick
                actions below.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'
              const isEmptyAssistant =
                msg.role === 'assistant' && msg.content === ''
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2',
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  )}
                  onMouseEnter={() => setHoveredMsgId(msg.id)}
                  onMouseLeave={() => setHoveredMsgId(null)}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {isUser ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className="relative max-w-[85%]">
                    <div
                      className={cn(
                        'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                        isUser
                          ? 'rounded-br-md bg-blue-600 text-white'
                          : 'rounded-bl-md bg-gray-100 text-gray-800'
                      )}
                    >
                      {isEmptyAssistant && isStreaming ? (
                        <TypingIndicator />
                      ) : isUser ? (
                        <span>{msg.content}</span>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:mb-1 prose-headings:mt-2 prose-code:rounded prose-code:bg-gray-200 prose-code:px-1 prose-code:text-xs">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Timestamp tooltip */}
                    {hoveredMsgId === msg.id && (
                      <div
                        className={cn(
                          'absolute top-full mt-1 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-[10px] text-white',
                          isUser ? 'right-0' : 'left-0'
                        )}
                      >
                        {formatTimestamp(msg.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 pb-4 pt-3">
          {/* Lead context pill */}
          {currentLeadId && (
            <div className="mb-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                <Zap className="h-3 w-3" />
                Context: Lead
              </span>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask LeadForge AI..."
              disabled={isStreaming}
              className={cn(
                'flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm',
                'placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                'bg-gradient-to-br from-purple-600 to-indigo-600 text-white',
                'transition-all hover:shadow-md disabled:opacity-40 disabled:hover:shadow-none'
              )}
              aria-label="Send message"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Quick action chips */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleChipClick(chip.label)}
                disabled={isStreaming}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white',
                  'px-2.5 py-1 text-xs text-gray-600 transition-colors',
                  'hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700',
                  'disabled:cursor-not-allowed disabled:opacity-40'
                )}
              >
                <chip.icon className="h-3 w-3" />
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
    </div>
  )
}
