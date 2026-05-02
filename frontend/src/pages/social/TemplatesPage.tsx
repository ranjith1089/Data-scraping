import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
} from '@/hooks/social/useSocialMisc'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function TemplatesPage() {
  const { data = [], isLoading } = useTemplates()
  const create = useCreateTemplate()
  const del = useDeleteTemplate()
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [language, setLanguage] = useState<'en' | 'ta' | 'hi'>('en')

  async function handleCreate() {
    if (!name.trim() || !content.trim()) {
      toast.error('Name and content are required.')
      return
    }
    try {
      await create.mutateAsync({ name: name.trim(), content, language })
      setName('')
      setContent('')
      setShowNew(false)
      toast.success('Template created.')
    } catch {
      toast.error('Failed to create template.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DM templates</h1>
          <p className="text-muted-foreground mt-1">
            Reusable DM bodies. Reference them by name from any automation's
            send_dm action.
          </p>
        </div>
        <Button onClick={() => setShowNew((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" />
          {showNew ? 'Cancel' : 'New template'}
        </Button>
      </div>

      {showNew && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input
              placeholder="Template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Hi {{name}}, thanks for your interest in {{topic}}. Here's the link → …"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'ta' | 'hi')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ்</option>
                <option value="hi">हिन्दी</option>
              </select>
              <Button onClick={handleCreate} disabled={create.isPending}>
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No templates yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {data.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{t.name}</h3>
                    <Badge variant="outline">
                      {t.language === 'ta' ? 'தமிழ்' : t.language === 'hi' ? 'हिन्दी' : 'EN'}
                    </Badge>
                  </div>
                  <pre className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap break-words font-sans">
                    {t.content}
                  </pre>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm(`Delete template "${t.name}"?`)) return
                    await del.mutateAsync(t.id)
                    toast.success('Deleted.')
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
