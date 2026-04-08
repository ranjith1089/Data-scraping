import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Mail, Inbox } from 'lucide-react'

interface CampaignRow {
  name: string
  sent: number
  opened: number
  replied: number
  open_rate: number
}

interface CampaignTableProps {
  data: CampaignRow[]
}

export default function CampaignTable({ data }: CampaignTableProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.open_rate - a.open_rate),
    [data]
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Mail className="h-4 w-4 text-gray-400" />
          Campaign Performance
        </h3>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Inbox className="h-10 w-10 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-400">
            No campaign data yet
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Create and send your first campaign to see performance here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Campaign
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Sent
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Opened
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Replied
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 min-w-[180px]">
                  Open Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((row, idx) => (
                <tr
                  key={row.name}
                  className={cn(
                    'transition-colors hover:bg-gray-50',
                    idx % 2 === 1 && 'bg-gray-50/50'
                  )}
                >
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {row.name}
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-gray-700">
                    {row.sent.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-gray-700">
                    {row.opened.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-gray-700">
                    {row.replied.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            row.open_rate >= 50
                              ? 'bg-green-500'
                              : row.open_rate >= 25
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          )}
                          style={{
                            width: `${Math.min(row.open_rate, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="min-w-[40px] text-right text-sm font-semibold text-gray-900">
                        {row.open_rate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
