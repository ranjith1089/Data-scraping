import { useState } from 'react'
import {
  Plus,
  Power,
  Trash2,
  Sparkles,
  Loader2,
  Filter,
  Edit3,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useUpdateAutomation,
  useTestAutomation,
  type AutomationRule,
  type AutomationRuleCreatePayload,
  type RuleAction,
  type RuleCondition,
  type SocialActionType,
  type SocialTriggerType,
} from '@/hooks/social/useAutomations'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const TRIGGER_LABELS: Record<SocialTriggerType, string> = {
  'comment.received': 'Post comment',
  'dm.received': 'Direct message',
  'story_reply.received': 'Story reply',
  'story_reaction.received': 'Story reaction',
  'mention.received': 'Mention',
}

const ACTION_LABELS: Record<SocialActionType, string> = {
  send_dm: 'Send DM',
  send_dm_with_quick_replies: 'Send DM (quick replies)',
  create_lead: 'Create lead',
  tag_lead: 'Tag lead',
  assign_lead: 'Assign lead',
  update_stage: 'Update stage',
  apply_follow_gate: 'Apply follow-gate',
  wait_for_event: 'Wait for event',
  create_activity: 'Log activity',
  send_email: 'Send email',
  send_whatsapp: 'Send WhatsApp',
  webhook_publish: 'Publish webhook',
}

export default function AutomationsPage() {
  const { data = [], isLoading } = useAutomations()
  const update = useUpdateAutomation()
  const del = useDeleteAutomation()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<AutomationRule | null>(null)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
          <p className="text-muted-foreground mt-1">
            Trigger → Condition → Action rules that run when something happens
            on your Instagram.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New automation
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">No automations yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a rule to automatically reply when followers comment a
              keyword on your posts.
            </p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first automation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="flex items-center justify-between p-4 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{rule.name}</h3>
                    <Badge
                      variant={rule.enabled ? 'default' : 'secondary'}
                      className={rule.enabled ? 'bg-emerald-100 text-emerald-800' : ''}
                    >
                      {rule.enabled ? 'Active' : 'Paused'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {TRIGGER_LABELS[rule.trigger_type as SocialTriggerType] ?? rule.trigger_type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(rule.conditions ?? []).length} condition
                    {(rule.conditions ?? []).length === 1 ? '' : 's'} ·{' '}
                    {(rule.actions ?? []).length} action
                    {(rule.actions ?? []).length === 1 ? '' : 's'} · fired{' '}
                    {rule.run_count}×
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(rule)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update.mutate({
                        id: rule.id,
                        body: { enabled: !rule.enabled },
                      })
                    }
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${rule.name}"?`)) return
                      await del.mutateAsync(rule.id)
                      toast.success('Rule deleted')
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <RuleEditor
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            toast.success('Automation created.')
          }}
        />
      )}
      {editing && (
        <RuleEditor
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast.success('Automation updated.')
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

const TRIGGER_OPTIONS: SocialTriggerType[] = [
  'comment.received',
  'dm.received',
  'story_reply.received',
  'story_reaction.received',
  'mention.received',
]

const ACTION_OPTIONS: SocialActionType[] = [
  'send_dm',
  'create_lead',
  'tag_lead',
  'apply_follow_gate',
  'create_activity',
]

function RuleEditor({
  existing,
  onClose,
  onSaved,
}: {
  existing?: AutomationRule
  onClose: () => void
  onSaved: () => void
}) {
  const create = useCreateAutomation()
  const update = useUpdateAutomation()
  const test = useTestAutomation()

  const [name, setName] = useState(existing?.name ?? '')
  const [trigger, setTrigger] = useState<SocialTriggerType>(
    (existing?.trigger_type as SocialTriggerType) ?? 'comment.received',
  )
  const [keywords, setKeywords] = useState<string>(
    (() => {
      // Try to extract a keyword condition from existing rule
      const cond = (existing?.conditions ?? []).find(
        (c) => c.op === 'contains_any',
      )
      if (cond && Array.isArray(cond.value))
        return (cond.value as string[]).join(', ')
      return ''
    })(),
  )
  const [actions, setActions] = useState<RuleAction[]>(
    existing?.actions ?? [
      { type: 'send_dm', config: { content: 'Hi {{name}}, here’s the link → https://...' } },
      { type: 'create_lead', config: { sector_code: 'education', tags: ['instagram'] } },
    ],
  )
  const [cooldown, setCooldown] = useState(existing?.cooldown_minutes ?? 60)
  const [priority, setPriority] = useState(existing?.priority ?? 100)

  function buildPayload(): AutomationRuleCreatePayload {
    const keywordList = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    const conditions: RuleCondition[] = []
    if (keywordList.length > 0) {
      const field =
        trigger === 'comment.received' ? 'comment_text' : 'message_text'
      conditions.push({ field, op: 'contains_any', value: keywordList })
    }
    return {
      name: name.trim(),
      platform: 'instagram',
      trigger_type: trigger,
      conditions,
      actions,
      priority,
      cooldown_minutes: cooldown,
      enabled: true,
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Give your automation a name.')
      return
    }
    if (actions.length === 0) {
      toast.error('Add at least one action.')
      return
    }
    try {
      const payload = buildPayload()
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          body: {
            name: payload.name,
            conditions: payload.conditions,
            actions: payload.actions,
            priority: payload.priority,
            cooldown_minutes: payload.cooldown_minutes,
          },
        })
      } else {
        await create.mutateAsync(payload)
      }
      onSaved()
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: unknown } } }).response?.data
          ?.detail
      toast.error(typeof detail === 'string' ? detail : 'Save failed')
    }
  }

  async function handleTest() {
    if (!existing) {
      toast.error('Save the rule first, then test it.')
      return
    }
    const sample =
      trigger === 'comment.received'
        ? {
            comment_text: keywords.split(',')[0]?.trim() || 'course',
            post_id: 'sample_media_id',
            commenter: { handle: '@sample_user' },
          }
        : {
            message_text: keywords.split(',')[0]?.trim() || 'hi',
            sender: { id: 'sample' },
          }
    const r = await test.mutateAsync({ id: existing.id, sample_event: sample })
    if (r.matched) toast.success(`Matched. ${r.simulated_actions.length} actions.`)
    else toast.error(`Did not match: ${r.reasons.join('; ')}`)
  }

  function patchAction(i: number, patch: Partial<RuleAction>) {
    setActions((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    )
  }
  function patchActionConfig(i: number, key: string, value: unknown) {
    setActions((prev) =>
      prev.map((a, idx) =>
        idx === i ? { ...a, config: { ...a.config, [key]: value } } : a,
      ),
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold">
                {existing ? 'Edit automation' : 'New automation'}
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Course launch — comment "course" → DM link'
              />
            </div>

            {/* Trigger */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                When this happens (Trigger)
              </label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as SocialTriggerType)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {TRIGGER_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* Conditions */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Match keywords (comma-separated, case-insensitive)
              </label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="course, courses, join"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Leave empty to match every event of this type.
              </p>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-700">
                  Then do this (Actions)
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setActions((prev) => [
                      ...prev,
                      { type: 'create_activity', config: {} },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {actions.map((a, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={a.type}
                          onChange={(e) =>
                            patchAction(i, { type: e.target.value as SocialActionType })
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        >
                          {ACTION_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {ACTION_LABELS[t]}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          onClick={() =>
                            setActions((prev) => prev.filter((_, idx) => idx !== i))
                          }
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>

                      {a.type === 'send_dm' && (
                        <textarea
                          value={(a.config.content as string) ?? ''}
                          onChange={(e) =>
                            patchActionConfig(i, 'content', e.target.value)
                          }
                          rows={3}
                          placeholder="Hi {{name}}, here's the link → https://…"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      )}

                      {a.type === 'create_lead' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={(a.config.sector_code as string) ?? 'education'}
                            onChange={(e) =>
                              patchActionConfig(i, 'sector_code', e.target.value)
                            }
                            placeholder="sector_code"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <input
                            value={
                              Array.isArray(a.config.tags)
                                ? (a.config.tags as string[]).join(',')
                                : ''
                            }
                            onChange={(e) =>
                              patchActionConfig(
                                i,
                                'tags',
                                e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              )
                            }
                            placeholder="tags (comma)"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      )}

                      {a.type === 'tag_lead' && (
                        <input
                          value={
                            Array.isArray(a.config.tags)
                              ? (a.config.tags as string[]).join(',')
                              : ''
                          }
                          onChange={(e) =>
                            patchActionConfig(
                              i,
                              'tags',
                              e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                          placeholder="hot-lead, instagram"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      )}

                      {a.type === 'apply_follow_gate' && (
                        <div className="space-y-2">
                          <textarea
                            value={(a.config.message_if_not_following as string) ?? ''}
                            onChange={(e) =>
                              patchActionConfig(i, 'message_if_not_following', e.target.value)
                            }
                            rows={2}
                            placeholder="Hi 👋 Follow us first to get the link"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                          <textarea
                            value={(a.config.message_if_following as string) ?? ''}
                            onChange={(e) =>
                              patchActionConfig(i, 'message_if_following', e.target.value)
                            }
                            rows={2}
                            placeholder="Thanks for following! Here's the link → …"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      )}

                      {a.type === 'create_activity' && (
                        <input
                          value={(a.config.note as string) ?? ''}
                          onChange={(e) =>
                            patchActionConfig(i, 'note', e.target.value)
                          }
                          placeholder="Activity note (supports {{placeholders}})"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Advanced */}
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <Filter className="h-3 w-3" /> Advanced
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500">
                      Cooldown (minutes per recipient)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={10080}
                      value={cooldown}
                      onChange={(e) => setCooldown(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500">
                      Priority (lower wins)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
            <Button variant="outline" onClick={handleTest} disabled={!existing}>
              Test
            </Button>
            <Button
              onClick={handleSave}
              disabled={create.isPending || update.isPending}
            >
              {(create.isPending || update.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {existing ? 'Save changes' : 'Create automation'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
