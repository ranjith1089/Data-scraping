import { Plus } from 'lucide-react'
import KanbanBoard from '@/components/pipeline/KanbanBoard'
import { usePipeline } from '@/hooks/useAnalytics'
import { formatINR } from '@/lib/utils'

export default function PipelinePage() {
  const { data } = usePipeline()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
          {data && (
            <p className="mt-1 text-sm text-gray-500">
              Total pipeline value: <span className="font-semibold text-gray-900">{formatINR(data.total_pipeline_value)}</span>
              {data.weighted_pipeline_value > 0 && (
                <span className="ml-3">
                  Weighted: <span className="font-semibold text-gray-900">{formatINR(data.weighted_pipeline_value)}</span>
                </span>
              )}
            </p>
          )}
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          Add Deal
        </button>
      </div>

      {/* Kanban Board */}
      <KanbanBoard />
    </div>
  )
}
