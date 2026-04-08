import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Eye, Sparkles } from 'lucide-react'
import { useSectorAnalytics } from '@/hooks/useAnalytics'
import SectorBriefCard from '@/components/ai/SectorBriefCard'
import { SECTOR_COLORS, SECTOR_NAMES, formatNumber } from '@/lib/utils'

const SECTORS = Object.entries(SECTOR_NAMES)

export default function SectorsPage() {
  const navigate = useNavigate()
  const { data: sectorData, isLoading } = useSectorAnalytics()
  const [briefSector, setBriefSector] = useState<string | null>(null)

  // Build a map from sector analytics array
  const sectorMap = new Map<string, { total_leads: number; average_score: number; conversion_rate: number }>()
  if (Array.isArray(sectorData)) {
    for (const s of sectorData) {
      sectorMap.set(s.sector_code, {
        total_leads: s.total_leads,
        average_score: s.average_score,
        conversion_rate: s.conversion_rate,
      })
    }
  }

  if (isLoading) {
    return <SectorsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Industry Sectors</h1>
        <p className="mt-1 text-sm text-gray-500">
          Explore sector performance, AI-generated briefs, and lead distribution across industries.
        </p>
      </div>

      {/* 3x3 Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SECTORS.map(([code, name]) => {
          const color = SECTOR_COLORS[code] || '#6B7280'
          const stats = sectorMap.get(code)

          return (
            <div
              key={code}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Top accent bar */}
              <div className="h-1.5" style={{ backgroundColor: color }} />

              <div className="p-5">
                {/* Sector Name */}
                <h3 className="text-lg font-semibold text-gray-900">{name}</h3>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Leads</p>
                    <p className="text-lg font-bold text-gray-900">
                      {stats ? formatNumber(stats.total_leads) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Avg Score</p>
                    <p className="text-lg font-bold text-gray-900">
                      {stats ? stats.average_score.toFixed(0) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Conv. Rate</p>
                    <p className="text-lg font-bold text-gray-900">
                      {stats ? `${stats.conversion_rate.toFixed(1)}%` : '-'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setBriefSector(code)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Brief
                  </button>
                  <button
                    onClick={() => navigate(`/leads?sector_code=${code}`)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Leads
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sector Brief Modal */}
      {briefSector && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setBriefSector(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {SECTOR_NAMES[briefSector] || briefSector} - AI Brief
                </h2>
                <button
                  onClick={() => setBriefSector(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <SectorBriefCard sectorCode={briefSector} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SectorsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-52 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
