import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  change?: number
  color?: string
}

export default function MetricCard({
  title,
  value,
  icon: Icon,
  change,
  color = 'bg-blue-500',
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 mt-2 text-xs font-medium',
                change >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {change >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(change)}% vs last week</span>
            </div>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg', color, 'bg-opacity-10')}>
          <Icon className={cn('w-5 h-5', color.replace('bg-', 'text-'))} />
        </div>
      </div>
    </div>
  )
}
