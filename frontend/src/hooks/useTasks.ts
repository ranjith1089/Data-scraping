import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  tenant_id: string
  created_by: string | null
  assigned_to: string | null
  lead_id: string | null
  deal_id: string | null
  title: string
  description: string | null
  task_type: 'follow_up' | 'call' | 'email' | 'meeting' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'done' | 'cancelled'
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string | null
  // enriched
  lead_company: string | null
  lead_contact: string | null
  deal_title: string | null
  assigned_to_name: string | null
  is_overdue: boolean
}

export interface TaskSummary {
  pending: number
  in_progress: number
  done: number
  cancelled: number
  overdue: number
  due_today: number
  due_this_week: number
  total: number
}

export interface CreateTaskRequest {
  title: string
  description?: string
  task_type?: Task['task_type']
  priority?: Task['priority']
  due_date?: string
  lead_id?: string
  deal_id?: string
  assigned_to?: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  task_type?: Task['task_type']
  priority?: Task['priority']
  status?: Task['status']
  due_date?: string
  lead_id?: string
  deal_id?: string
  assigned_to?: string
}

export interface ListTasksParams {
  status?: string
  priority?: string
  type?: string
  lead_id?: string
  deal_id?: string
  overdue?: boolean
  due_today?: boolean
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const TASK_KEYS = {
  all:      ['tasks'] as const,
  list:     (p?: ListTasksParams) => ['tasks', 'list', JSON.stringify(p ?? {})] as const,
  summary:  ['tasks', 'summary'] as const,
  detail:   (id: string) => ['tasks', id] as const,
  forLead:  (leadId: string) => ['tasks', 'lead', leadId] as const,
  forDeal:  (dealId: string) => ['tasks', 'deal', dealId] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTasks(params?: ListTasksParams) {
  return useQuery<Task[]>({
    queryKey: TASK_KEYS.list(params),
    queryFn: async () => {
      const p: Record<string, string> = {}
      if (params?.status)    p.status    = params.status
      if (params?.priority)  p.priority  = params.priority
      if (params?.type)      p.type      = params.type
      if (params?.lead_id)   p.lead_id   = params.lead_id
      if (params?.deal_id)   p.deal_id   = params.deal_id
      if (params?.overdue)   p.overdue   = 'true'
      if (params?.due_today) p.due_today = 'true'
      const { data } = await api.get<Task[]>('/tasks', { params: p })
      return data
    },
  })
}

export function useTaskSummary() {
  return useQuery<TaskSummary>({
    queryKey: TASK_KEYS.summary,
    queryFn: async () => {
      const { data } = await api.get<TaskSummary>('/tasks/summary')
      return data
    },
    staleTime: 60_000,
  })
}

export function useLeadTasks(leadId: string) {
  return useQuery<Task[]>({
    queryKey: TASK_KEYS.forLead(leadId),
    queryFn: async () => {
      const { data } = await api.get<Task[]>(`/tasks/lead/${leadId}`)
      return data
    },
    enabled: !!leadId,
  })
}

export function useDealTasks(dealId: string) {
  return useQuery<Task[]>({
    queryKey: TASK_KEYS.forDeal(dealId),
    queryFn: async () => {
      const { data } = await api.get<Task[]>(`/tasks/deal/${dealId}`)
      return data
    },
    enabled: !!dealId,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateTaskRequest) => {
      const { data } = await api.post<Task>('/tasks', req)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASK_KEYS.all }),
  })
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: UpdateTaskRequest) => {
      const { data } = await api.patch<Task>(`/tasks/${id}`, req)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASK_KEYS.all })
    },
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Task>(`/tasks/${id}/complete`, {})
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASK_KEYS.all }),
  })
}

export function useReopenTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Task>(`/tasks/${id}/reopen`, {})
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASK_KEYS.all }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASK_KEYS.all }),
  })
}

// ─── Static meta ─────────────────────────────────────────────────────────────

export const PRIORITY_META: Record<string, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-400' },
  high:   { label: 'High',   color: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-400' },
  urgent: { label: 'Urgent', color: 'bg-red-50 text-red-600',       dot: 'bg-red-500' },
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pending',     color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700' },
  done:        { label: 'Done',        color: 'bg-green-50 text-green-700' },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-50 text-red-400' },
}

export const TASK_TYPE_META: Record<string, { label: string; icon: string }> = {
  follow_up: { label: 'Follow-up', icon: '🔁' },
  call:      { label: 'Call',      icon: '📞' },
  email:     { label: 'Email',     icon: '✉️'  },
  meeting:   { label: 'Meeting',   icon: '🤝' },
  other:     { label: 'Other',     icon: '📌' },
}
