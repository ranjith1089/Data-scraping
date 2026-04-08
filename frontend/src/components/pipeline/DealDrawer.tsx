import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn, formatINR } from '@/lib/utils'
import {
  X,
  Loader2,
  Trash2,
  Save,
  ExternalLink,
  AlertTriangle,
  IndianRupee,
  Target,
  CalendarDays,
  Layers,
  FileText,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface PipelineStage {
  id: string
  name: string
  order_index: number
  color: string
  is_default: boolean
}

interface DealDetail {
  id: string
  title: string
  lead_id: string
  stage_id: string
  assigned_to: string | null
  value_inr: number
  probability: number
  close_date: string | null
  notes: string | null
  company_name?: string
  lead_name?: string
  lead_email?: string
  created_at?: string
  updated_at?: string
}

interface DealDrawerProps {
  dealId: string
  onClose: () => void
}

export default function DealDrawer({ dealId, onClose }: DealDrawerProps) {
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [form, setForm] = useState({
    title: '',
    value_inr: 0,
    probability: 50,
    close_date: '',
    stage_id: '',
    notes: '',
  })

  const { data: deal, isLoading: dealLoading } = useQuery<DealDetail>({
    queryKey: ['pipeline-deal', dealId],
    queryFn: async () => {
      const { data } = await api.get(`/pipeline/deals/${dealId}`)
      return data
    },
  })

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data } = await api.get('/pipeline/stages')
      return data
    },
  })

  useEffect(() => {
    if (deal) {
      setForm({
        title: deal.title || '',
        value_inr: deal.value_inr || 0,
        probability: deal.probability ?? 50,
        close_date: deal.close_date
          ? format(new Date(deal.close_date), 'yyyy-MM-dd')
          : '',
        stage_id: deal.stage_id || '',
        notes: deal.notes || '',
      })
    }
  }, [deal])

  const updateDeal = useMutation({
    mutationFn: async (payload: Partial<DealDetail>) => {
      const { data } = await api.patch(`/pipeline/deals/${dealId}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-deal', dealId] })
      toast.success('Deal updated')
    },
    onError: () => {
      toast.error('Failed to update deal')
    },
  })

  const deleteDeal = useMutation({
    mutationFn: async () => {
      await api.delete(`/pipeline/deals/${dealId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] })
      toast.success('Deal deleted')
      onClose()
    },
    onError: () => {
      toast.error('Failed to delete deal')
    },
  })

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error('Deal title is required')
      return
    }

    updateDeal.mutate({
      title: form.title.trim(),
      value_inr: form.value_inr,
      probability: form.probability,
      close_date: form.close_date || null,
      stage_id: form.stage_id,
      notes: form.notes.trim() || null,
    })
  }

  const handleDelete = () => {
    deleteDeal.mutate()
  }

  const updateField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const currentStage = stages.find((s) => s.id === form.stage_id)
  const sortedStages = [...stages].sort((a, b) => a.order_index - b.order_index)

  const hasChanges =
    deal &&
    (form.title !== (deal.title || '') ||
      form.value_inr !== (deal.value_inr || 0) ||
      form.probability !== (deal.probability ?? 50) ||
      form.close_date !==
        (deal.close_date
          ? format(new Date(deal.close_date), 'yyyy-MM-dd')
          : '') ||
      form.stage_id !== (deal.stage_id || '') ||
      form.notes !== (deal.notes || ''))

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[500px] max-w-full bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            {currentStage && (
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: currentStage.color || '#6B7280' }}
              />
            )}
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {dealLoading ? 'Loading...' : form.title || 'Deal Details'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {dealLoading ? (
            <DrawerSkeleton />
          ) : (
            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Deal Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter deal title"
                />
              </div>

              {/* Value & Probability row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                    <IndianRupee className="w-3.5 h-3.5" />
                    Value (INR)
                  </label>
                  <input
                    type="number"
                    value={form.value_inr}
                    onChange={(e) =>
                      updateField('value_inr', parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min={0}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Probability
                  </label>
                  <div className="space-y-1">
                    <input
                      type="range"
                      value={form.probability}
                      onChange={(e) =>
                        updateField('probability', parseInt(e.target.value, 10))
                      }
                      min={0}
                      max={100}
                      step={5}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0%</span>
                      <span
                        className={cn(
                          'font-semibold text-sm',
                          form.probability >= 70
                            ? 'text-green-600'
                            : form.probability >= 40
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        )}
                      >
                        {form.probability}%
                      </span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weighted value display */}
              {form.value_inr > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Weighted value</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {formatINR(Math.round(form.value_inr * (form.probability / 100)))}
                  </span>
                </div>
              )}

              {/* Close Date */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Expected Close Date
                </label>
                <input
                  type="date"
                  value={form.close_date}
                  onChange={(e) => updateField('close_date', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Stage */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Pipeline Stage
                </label>
                <select
                  value={form.stage_id}
                  onChange={(e) => updateField('stage_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="" disabled>
                    Select a stage
                  </option>
                  {sortedStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Add notes about this deal..."
                />
              </div>

              {/* Lead info */}
              {deal && (deal.lead_name || deal.lead_id) && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Associated Lead
                  </h3>
                  <div className="space-y-1">
                    {deal.lead_name && (
                      <p className="text-sm text-gray-900">{deal.lead_name}</p>
                    )}
                    {deal.company_name && (
                      <p className="text-xs text-gray-500">{deal.company_name}</p>
                    )}
                    {deal.lead_email && (
                      <p className="text-xs text-gray-500">{deal.lead_email}</p>
                    )}
                  </div>
                  <a
                    href={`/leads/${deal.lead_id}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium"
                  >
                    View lead details
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Timestamps */}
              {deal && (deal.created_at || deal.updated_at) && (
                <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-100">
                  {deal.created_at && (
                    <p>
                      Created:{' '}
                      {format(new Date(deal.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  )}
                  {deal.updated_at && (
                    <p>
                      Updated:{' '}
                      {format(new Date(deal.updated_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!dealLoading && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-gray-700 flex-1">
                  Delete this deal permanently?
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteDeal.isPending}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleteDeal.isPending ? 'Deleting...' : 'Confirm'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateDeal.isPending || !hasChanges}
                  className={cn(
                    'flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors',
                    hasChanges
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {updateDeal.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {updateDeal.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function DrawerSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
        <div className="h-9 bg-gray-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
          <div className="h-9 bg-gray-200 rounded-lg" />
        </div>
        <div>
          <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
          <div className="h-9 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div>
        <div className="h-4 w-28 bg-gray-200 rounded mb-2" />
        <div className="h-9 bg-gray-200 rounded-lg" />
      </div>
      <div>
        <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
        <div className="h-9 bg-gray-200 rounded-lg" />
      </div>
      <div>
        <div className="h-4 w-12 bg-gray-200 rounded mb-2" />
        <div className="h-24 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-24 bg-gray-200 rounded-lg" />
    </div>
  )
}
