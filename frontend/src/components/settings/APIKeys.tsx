import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Loader2,
  Inbox,
  Shield,
} from 'lucide-react'

interface APIKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at?: string
}

export default function APIKeys() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data } = await api.get<APIKey[]>('/api-keys/')
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<{ key: string; id: string }>(
        '/api-keys/',
        { name }
      )
      return data
    },
    onSuccess: (data) => {
      setNewlyCreatedKey(data.key)
      setKeyName('')
      setShowCreate(false)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`)
    },
    onSuccess: () => {
      setDeleteConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyName.trim()) return
    createMutation.mutate(keyName.trim())
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Key className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        </div>
        <button
          onClick={() => {
            setShowCreate(!showCreate)
            setNewlyCreatedKey(null)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Generate New Key
        </button>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-900">
            API keys are shown only once
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            Store your keys securely. We cannot retrieve them after initial
            creation. If you lose a key, you will need to generate a new one.
          </p>
        </div>
      </div>

      {/* Newly Created Key */}
      {newlyCreatedKey && (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-green-600" />
            <p className="text-sm font-semibold text-green-900">
              Your new API key
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-green-200 bg-white px-4 py-2.5 font-mono text-sm text-gray-900 select-all">
              {newlyCreatedKey}
            </code>
            <button
              onClick={() => handleCopy(newlyCreatedKey)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-green-700">
            Copy this key now. It will not be shown again.
          </p>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-gray-200 bg-white p-5"
        >
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Key Name
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., Production API, Staging Webhook"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Generate
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
          {createMutation.isError && (
            <p className="mt-2 text-xs text-red-600">
              Failed to generate key. Please try again.
            </p>
          )}
        </form>
      )}

      {/* Keys Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-10 w-10 text-gray-200" />
            <p className="mt-3 text-sm font-medium text-gray-400">
              No API keys yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Generate your first API key to integrate with external services.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Key Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {keys.map((apiKey) => (
                  <tr
                    key={apiKey.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {apiKey.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-600">
                        {apiKey.key_prefix}...
                      </code>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {formatDate(apiKey.created_at)}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {apiKey.last_used_at
                        ? formatDateTime(apiKey.last_used_at)
                        : 'Never'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {deleteConfirm === apiKey.id ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            Delete?
                          </span>
                          <button
                            onClick={() =>
                              deleteMutation.mutate(apiKey.id)
                            }
                            disabled={deleteMutation.isPending}
                            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleteMutation.isPending ? 'Deleting...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(apiKey.id)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Delete key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
