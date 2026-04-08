import React from 'react'
import { cn, formatINR } from '@/lib/utils'
import { Calendar, User, GripVertical } from 'lucide-react'
import { format } from 'date-fns'

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

interface DealCardProps {
  deal: Deal
  isDragging: boolean
  onClick: () => void
}

function getProbabilityStyle(probability: number): string {
  if (probability >= 70) return 'text-green-600 bg-green-50'
  if (probability >= 40) return 'text-yellow-600 bg-yellow-50'
  return 'text-red-600 bg-red-50'
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

export default function DealCard({ deal, isDragging, onClick }: DealCardProps) {
  const probabilityColor = getProbabilityStyle(deal.probability)
  const overdue = deal.close_date ? isOverdue(deal.close_date) : false

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer transition-all hover:shadow-md group',
        isDragging && 'shadow-lg ring-2 ring-blue-300 rotate-2'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 line-clamp-1 flex-1">
          {deal.title}
        </h4>
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {deal.company_name && (
        <p className="text-xs text-gray-500 mb-2">{deal.company_name}</p>
      )}

      <div className="flex items-center justify-between">
        {deal.value_inr > 0 ? (
          <span className="text-sm font-semibold text-gray-800">
            {formatINR(deal.value_inr)}
          </span>
        ) : (
          <span />
        )}
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded-full font-medium',
            probabilityColor
          )}
        >
          {deal.probability}%
        </span>
      </div>

      {(deal.close_date || deal.assigned_to) && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
          {deal.close_date && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                overdue ? 'text-red-500' : 'text-gray-400'
              )}
            >
              <Calendar className="w-3 h-3" />
              {format(new Date(deal.close_date), 'MMM dd')}
            </div>
          )}
          {deal.assigned_to && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <User className="w-3 h-3" />
              <span>Assigned</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
