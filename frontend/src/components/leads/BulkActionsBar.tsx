import { useState } from 'react'
import {
  X,
  ChevronDown,
  Brain,
  Megaphone,
  Download,
  Trash2,
  UserPlus,
  GitBranch,
  Loader2,
} from 'lucide-react'
import { useBulkUpdateLeads, useDeleteLead } from '@/hooks/useLeads'
import { STAGE_LABELS, STAGE_COLORS } from '@/lib/utils'
import toast from 'react-hot-toast'

interface BulkActionsBarProps {
  selectedIds: string[]
  onClear: () => void
  onOpenAIScore?: (ids: string[]) => void
}

export default function BulkActionsBar({ selectedIds, onClear, onOpenAIScore }: BulkActionsBarProps) {
  const bulkUpdate = useBulkUpdateLeads()
  const deleteLead = useDeleteLead()

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleStageChange(stage: string) {
    setOpenDropdown(null)
    try {
      await bulkUpdate.mutateAsync({
        lead_ids: selectedIds,
        updates: { stage },
      })
      toast.success(`Updated ${selectedIds.length} leads to ${STAGE_LABELS[stage]}`)
      onClear()
    } catch {
      toast.error('Failed to update leads')
    }
  }

  async function handleAssign(userId: string) {
    setOpenDropdown(null)
    try {
      await bulkUpdate.mutateAsync({
        lead_ids: selectedIds,
        updates: { assigned_to: userId },
      })
      toast.success(`Assigned ${selectedIds.length} leads`)
      onClear()
    } catch {
      toast.error('Failed to assign leads')
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} leads? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      // Delete sequentially
      for (const id of selectedIds) {
        await deleteLead.mutateAsync(id)
      }
      toast.success(`Deleted ${selectedIds.length} leads`)
      onClear()
    } catch {
      toast.error('Some leads could not be deleted')
    } finally {
      setIsDeleting(false)
    }
  }

  function handleExport() {
    toast.success('Export started - file will download shortly')
    // Trigger a CSV export via the API
    const idsParam = selectedIds.join(',')
    window.open(`/api/v1/leads/export?ids=${idsParam}`, '_blank')
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-xl">
        {/* Count */}
        <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {selectedIds.length}
          </span>
          <span className="text-sm font-medium text-gray-700">
            lead{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
        </div>

        {/* Change Stage */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'stage' ? null : 'stage')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <GitBranch className="h-4 w-4" />
            Stage
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'stage' && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {Object.entries(STAGE_LABELS).map(([code, name]) => (
                  <button
                    key={code}
                    onClick={() => handleStageChange(code)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: STAGE_COLORS[code] }}
                    />
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Assign To */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'assign' ? null : 'assign')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <UserPlus className="h-4 w-4" />
            Assign
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'assign' && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => handleAssign('unassigned')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                >
                  Unassign
                </button>
                <div className="my-1 border-t border-gray-100" />
                <p className="px-3 py-1.5 text-[10px] font-medium uppercase text-gray-400">Team Members</p>
                {['Me', 'Team Member 1', 'Team Member 2'].map((name) => (
                  <button
                    key={name}
                    onClick={() => handleAssign(name.toLowerCase().replace(/\s/g, '_'))}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                      {name[0]}
                    </div>
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Score with AI */}
        <button
          onClick={() => onOpenAIScore?.(selectedIds)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Brain className="h-4 w-4" />
          Score with AI
        </button>

        {/* Add to Campaign */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'campaign' ? null : 'campaign')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Megaphone className="h-4 w-4" />
            Campaign
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openDropdown === 'campaign' && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <p className="px-3 py-2 text-xs text-gray-400">No active campaigns</p>
              </div>
            </>
          )}
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Export
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete
        </button>

        {/* Divider + Clear */}
        <div className="border-l border-gray-200 pl-3">
          <button
            onClick={onClear}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
