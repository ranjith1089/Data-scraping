import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { SECTOR_COLORS } from '@/lib/utils'

interface SectorData {
  sector: string
  sector_name: string
  count: number
  hot_count: number
  avg_score: number
}

interface SectorBarChartProps {
  data: SectorData[]
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: SectorData }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-gray-900">{d.sector_name}</p>
      <div className="mt-1.5 space-y-1 text-xs text-gray-600">
        <p>
          Total Leads: <span className="font-medium text-gray-900">{d.count}</span>
        </p>
        <p>
          Hot Leads:{' '}
          <span className="font-medium text-red-600">{d.hot_count}</span>
        </p>
        <p>
          Avg Score:{' '}
          <span className="font-medium text-gray-900">
            {d.avg_score.toFixed(1)}
          </span>
        </p>
      </div>
    </div>
  )
}

export default function SectorBarChart({ data }: SectorBarChartProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-5 text-sm font-semibold text-gray-900">
        Leads by Sector
      </h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          No sector data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
          >
            <XAxis
              dataKey="sector_name"
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((entry) => (
                <Cell
                  key={entry.sector}
                  fill={SECTOR_COLORS[entry.sector] || '#6B7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
