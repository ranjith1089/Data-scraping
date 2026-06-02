import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Brain,
  Send,
  Bot,
  User,
  Loader2,
  Flame,
  Users,
  Zap,
  Phone,
  FileText,
  BarChart3,
  MessageSquare,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAIStore } from '@/store/aiStore'
import { useChat } from '@/hooks/useAI'
import { useDashboard } from '@/hooks/useAnalytics'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

const QUICK_CHIPS = [
  { label: 'Who should I call today?', icon: Phone },
  { label: 'Draft a follow-up email', icon: FileText },
  { label: 'Give me a sector brief for IT', icon: BarChart3 },
  { label: 'Summarize pipeline health', icon: Zap },
  { label: 'Which leads need attention?', icon: Users },
  { label: 'Analyze campaign performance', icon: MessageSquare },
] as const

const SUGGESTED_QUESTIONS = [
  'What are the top 5 hottest leads right now?',
  'Compare IT vs Manufacturing sector performance',
  'Suggest follow-up actions for stale leads',
  'What is the average deal close time?',
  'Which campaigns have the best ROI?',
  'Generate an outreach strategy for Education sector',
]

export default function AIAssistantPage() {
  const navigate = useNavigate()
  const { messages, isStreaming, currentLeadId } = useAIStore()
  const { sendMessage } = useChat()
  const { data: dashboardData } = useDashboard()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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

  // Derive hot leads from dashboard data. Defensively guard against a
  // missing leads_by_stage — previously `Object.entries(undefined)` threw
  // "Cannot convert undefined or null to object" and white-screened the page.
  const hotLeadsCount = Object.entries(
    dashboardData?.leads_by_stage ?? {}
  ).reduce((sum, [stage, count]) => {
    if (stage === 'qualified' || stage === 'proposal' || stage === 'negotiation') {
      return sum + (Number(count) || 0)
    }
    return sum
  }, 0)

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-6">
      {/* Left: Chat Interface (70%) */}
      <div className="flex flex-[7] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">AveonApex Assistant</h1>
            <p className="text-xs text-purple-200">
              {isStreaming ? 'Thinking...' : 'Ask me anything about your leads, campaigns, and pipeline'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-purple-50">
                <Bot className="h-10 w-10 text-purple-400" />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                How can I help you today?
              </h2>
              <p className="mb-8 max-w-md text-sm text-gray-500">
                I can help you with lead analysis, campaign insights, email drafting,
                sector intelligence, and much more.
              </p>

              {/* Quick action chips */}
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleChipClick(chip.label)}
                    disabled={isStreaming}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white',
                      'px-4 py-2.5 text-sm text-gray-700 transition-all',
                      'hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 hover:shadow-sm',
                      'disabled:cursor-not-allowed disabled:opacity-40'
                    )}
                  >
                    <chip.icon className="h-4 w-4" />
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-5">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'
              const isEmptyAssistant = msg.role === 'assistant' && msg.content === ''
              return (
                <div
                  key={msg.id}
                  className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
                      isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  {/* Bubble */}
                  <div className="max-w-[75%]">
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-3 text-sm leading-relaxed',
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
                    <p className={cn('mt-1 text-[10px] text-gray-400', isUser ? 'text-right' : 'text-left')}>
                      {formatTimestamp(msg.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AveonApex anything..."
              disabled={isStreaming}
              className={cn(
                'flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm',
                'placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={cn(
                'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
                'bg-gradient-to-br from-purple-600 to-indigo-600 text-white',
                'transition-all hover:shadow-md disabled:opacity-40 disabled:hover:shadow-none'
              )}
              aria-label="Send message"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Context Sidebar (30%) */}
      <div className="flex flex-[3] flex-col gap-4 overflow-y-auto">
        {/* Quick Stats */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Quick Stats</h3>
          <div className="space-y-3">
            <StatRow
              icon={Users}
              label="Total Leads"
              value={dashboardData?.total_leads?.toLocaleString('en-IN') || '-'}
              iconColor="text-blue-600"
              bgColor="bg-blue-50"
            />
            <StatRow
              icon={Flame}
              label="Hot Leads"
              value={hotLeadsCount.toLocaleString('en-IN')}
              iconColor="text-red-600"
              bgColor="bg-red-50"
            />
            <StatRow
              icon={Zap}
              label="This Week"
              value={dashboardData?.new_leads_this_week?.toLocaleString('en-IN') || '-'}
              iconColor="text-purple-600"
              bgColor="bg-purple-50"
            />
          </div>
        </div>

        {/* Recent Hot Leads */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Recent Hot Leads</h3>
          {dashboardData?.top_performing_sectors && dashboardData.top_performing_sectors.length > 0 ? (
            <div className="space-y-2">
              {dashboardData.top_performing_sectors.slice(0, 5).map((sector) => (
                <button
                  key={sector.sector_code}
                  onClick={() => navigate(`/leads?sector_code=${sector.sector_code}`)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {sector.sector_code.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sector.lead_count} leads, avg {sector.avg_score.toFixed(0)}
                    </p>
                  </div>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                    {sector.conversion_rate.toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data available</p>
          )}
        </div>

        {/* Suggested Questions */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Suggested Questions</h3>
          <div className="space-y-1.5">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                onClick={() => handleChipClick(question)}
                disabled={isStreaming}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:bg-purple-50 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatRow({
  icon: Icon,
  label,
  value,
  iconColor,
  bgColor,
}: {
  icon: React.ElementType
  label: string
  value: string
  iconColor: string
  bgColor: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bgColor)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
    </div>
  )
}
