import React, { useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn, formatINR } from '@/lib/utils'
import DealCard from './DealCard'
import DealDrawer from './DealDrawer'
import { Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface PipelineStage {
  id: string
  name: string
  order_index: number
  color: string
  is_default: boolean
}

interface Deal {
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
}

export default function KanbanBoard() {
  const queryClient = useQueryClient()
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [showNewDeal, setShowNewDeal] = useState<string | null>(null)

  const { data: stages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data } = await api.get('/pipeline/stages')
      return data
    },
  })

  const { data: deals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ['pipeline-deals'],
    queryFn: async () => {
      const { data } = await api.get('/pipeline/deals')
      return data
    },
  })

  const updateDeal = useMutation({
    mutationFn: async ({ id, stage_id }: { id: string; stage_id: string }) => {
      const { data } = await api.patch(`/pipeline/deals/${id}`, { stage_id })
      return data
    },
    onMutate: async ({ id, stage_id }) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline-deals'] })
      const previous = queryClient.getQueryData<Deal[]>(['pipeline-deals'])
      queryClient.setQueryData<Deal[]>(['pipeline-deals'], (old) =>
        old?.map((d) => (d.id === id ? { ...d, stage_id } : d)) ?? []
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['pipeline-deals'], context.previous)
      }
      toast.error('Failed to move deal')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] })
    },
  })

  const createDeal = useMutation({
    mutationFn: async (deal: Partial<Deal>) => {
      const { data } = await api.post('/pipeline/deals', deal)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] })
      setShowNewDeal(null)
      toast.success('Deal created')
    },
    onError: () => {
      toast.error('Failed to create deal')
    },
  })

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const dealId = result.draggableId
    const newStageId = result.destination.droppableId

    if (result.source.droppableId === newStageId) return

    updateDeal.mutate({ id: dealId, stage_id: newStageId })
  }

  const getDealsByStage = (stageId: string) =>
    deals.filter((d) => d.stage_id === stageId)

  const getStageTotal = (stageId: string) =>
    getDealsByStage(stageId).reduce((sum, d) => sum + (d.value_inr || 0), 0)

  if (stagesLoading || dealsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const sortedStages = [...stages].sort((a, b) => a.order_index - b.order_index)

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
          {sortedStages.map((stage) => {
            const stageDeals = getDealsByStage(stage.id)
            const total = getStageTotal(stage.id)

            return (
              <div key={stage.id} className="flex-shrink-0 w-72">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color || '#6B7280' }}
                    />
                    <h3 className="font-semibold text-sm text-gray-700">
                      {stage.name}
                    </h3>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowNewDeal(stage.id)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={`Add deal to ${stage.name}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {total > 0 && (
                  <p className="text-xs text-gray-500 mb-2 px-1">
                    {formatINR(total)}
                  </p>
                )}

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'min-h-[200px] rounded-lg p-2 transition-colors space-y-2',
                        snapshot.isDraggingOver
                          ? 'bg-blue-50 border-2 border-dashed border-blue-200'
                          : 'bg-gray-50'
                      )}
                    >
                      {stageDeals.map((deal, index) => (
                        <Draggable
                          key={deal.id}
                          draggableId={deal.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <DealCard
                                deal={deal}
                                isDragging={snapshot.isDragging}
                                onClick={() => setSelectedDealId(deal.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {showNewDeal === stage.id && (
                        <NewDealForm
                          stageId={stage.id}
                          onSubmit={(deal) => createDeal.mutate(deal)}
                          onCancel={() => setShowNewDeal(null)}
                          isLoading={createDeal.isPending}
                        />
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {selectedDealId && (
        <DealDrawer
          dealId={selectedDealId}
          onClose={() => setSelectedDealId(null)}
        />
      )}
    </>
  )
}

function NewDealForm({
  stageId,
  onSubmit,
  onCancel,
  isLoading,
}: {
  stageId: string
  onSubmit: (deal: Partial<{ title: string; stage_id: string; value_inr: number; probability: number }>) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      stage_id: stageId,
      value_inr: value ? parseInt(value, 10) : 0,
      probability: 20,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg p-3 shadow-sm border space-y-2"
    >
      <input
        type="text"
        placeholder="Deal title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoFocus
      />
      <input
        type="number"
        placeholder="Value (INR)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        min={0}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          className="flex-1 text-xs bg-blue-600 text-white rounded py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Adding...' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-xs bg-gray-100 text-gray-600 rounded py-1.5 hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
