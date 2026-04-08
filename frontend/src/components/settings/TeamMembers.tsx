import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn, formatDateTime, getInitials } from '@/lib/utils'
import {
  Users,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Shield,
  ShieldCheck,
  User as UserIcon,
  Inbox,
} from 'lucide-react'

interface TeamUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  last_login?: string
  created_at: string
}

const ROLE_BADGE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  owner: {
    label: 'Owner',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    icon: ShieldCheck,
  },
  admin: {
    label: 'Admin',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    icon: Shield,
  },
  member: {
    label: 'Member',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    icon: UserIcon,
  },
}

export default function TeamMembers() {
  const queryClient = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'member' })

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<TeamUser[]>('/users/')
      return data
    },
  })

  const inviteMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await api.post('/users/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setForm({ email: '', full_name: '', role: 'member' })
      setShowInvite(false)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await api.patch(`/users/${id}`, { is_active })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email.trim() || !form.full_name.trim()) return
    inviteMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {users.length}
          </span>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
          {showInvite ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Invite New Team Member
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, full_name: e.target.value }))
                }
                placeholder="John Doe"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="john@company.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, role: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {inviteMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Send Invite
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
            {inviteMutation.isError && (
              <p className="text-xs text-red-600">
                Failed to invite user. Please try again.
              </p>
            )}
          </div>
        </form>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-10 w-10 text-gray-200" />
            <p className="mt-3 text-sm font-medium text-gray-400">
              No team members yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => {
                  const roleCfg = ROLE_BADGE[user.role] || ROLE_BADGE.member
                  const RoleIcon = roleCfg.icon
                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                            {getInitials(user.full_name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {user.full_name}
                            </p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                            roleCfg.color
                          )}
                        >
                          <RoleIcon className="h-3 w-3" />
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-medium',
                            user.is_active ? 'text-green-600' : 'text-gray-400'
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              user.is_active ? 'bg-green-500' : 'bg-gray-300'
                            )}
                          />
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-500">
                        {user.last_login
                          ? formatDateTime(user.last_login)
                          : 'Never'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {user.role !== 'owner' && (
                          <button
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: user.id,
                                is_active: !user.is_active,
                              })
                            }
                            disabled={toggleActiveMutation.isPending}
                            className={cn(
                              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                              user.is_active
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            )}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
