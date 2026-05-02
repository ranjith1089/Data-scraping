import { useState } from 'react'
import { Plus, RefreshCw, Power, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useCreateSocialCampaign,
  useDeleteSocialCampaign,
  useRefreshPosts,
  useSocialCampaigns,
  useSocialPosts,
  useUpdateSocialCampaign,
} from '@/hooks/social/useSocialMisc'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function CampaignsPage() {
  const { data: campaigns = [], isLoading } = useSocialCampaigns()
  const { data: posts = [] } = useSocialPosts()
  const refreshPosts = useRefreshPosts()
  const create = useCreateSocialCampaign()
  const update = useUpdateSocialCampaign()
  const del = useDeleteSocialCampaign()
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        goal: 'lead_capture',
        post_ids: selectedPosts,
      })
      setName('')
      setSelectedPosts([])
      setShowNew(false)
      toast.success('Campaign created.')
    } catch {
      toast.error('Failed to create campaign.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Social campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Group automation rules + posts under one banner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await refreshPosts.mutateAsync()
                toast.success('Posts refreshed from Instagram.')
              } catch {
                toast.error('Refresh failed — check Connect status.')
              }
            }}
            disabled={refreshPosts.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh posts
          </Button>
          <Button onClick={() => setShowNew((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" />
            {showNew ? 'Cancel' : 'New campaign'}
          </Button>
        </div>
      </div>

      {showNew && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input
              placeholder="Campaign name (e.g. Q3 Course Launch)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                Attach posts ({selectedPosts.length} selected)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {posts.length === 0 ? (
                  <p className="col-span-full text-xs text-muted-foreground p-2">
                    No posts cached yet. Click "Refresh posts" first.
                  </p>
                ) : (
                  posts.map((p) => {
                    const checked = selectedPosts.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSelectedPosts((prev) =>
                            checked
                              ? prev.filter((x) => x !== p.id)
                              : [...prev, p.id],
                          )
                        }
                        className={`text-left rounded-lg border p-2 ${checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}
                      >
                        {p.media_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.media_url}
                            alt=""
                            className="w-full aspect-square object-cover rounded mb-1"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-muted rounded mb-1" />
                        )}
                        <p className="text-[11px] line-clamp-2">{p.caption ?? '(no caption)'}</p>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={create.isPending}>
              Create campaign
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No campaigns yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <Badge
                      variant={c.status === 'active' ? 'default' : 'secondary'}
                      className={c.status === 'active' ? 'bg-emerald-100 text-emerald-800' : ''}
                    >
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.posts.length} post{c.posts.length === 1 ? '' : 's'} ·{' '}
                    {c.rule_count} rule{c.rule_count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update.mutate({
                        id: c.id,
                        body: { status: c.status === 'active' ? 'paused' : 'active' },
                      })
                    }
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!window.confirm(`Delete campaign "${c.name}"?`)) return
                      await del.mutateAsync(c.id)
                      toast.success('Campaign deleted.')
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
    </div>
  )
}
