import { useState } from 'react'
import { Plus, Copy, Trash2, Power, ExternalLink, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useForms,
  useCreateForm,
  useUpdateForm,
  useDeleteForm,
  useFormEmbed,
} from '@/hooks/useForms'
import { SECTOR_NAMES } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function FormsPage() {
  const { data: forms = [], isLoading } = useForms()
  const createForm = useCreateForm()
  const updateForm = useUpdateForm()
  const deleteForm = useDeleteForm()
  const [showCreate, setShowCreate] = useState(false)
  const [showEmbed, setShowEmbed] = useState<string | null>(null)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Public Forms
          </h1>
          <p className="text-muted-foreground mt-1">
            Embed a form on your website to capture leads straight into AveonApex.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New form
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-foreground">No forms yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a form and paste the embed snippet on your website to start
              capturing leads.
            </p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create your first form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardContent className="flex items-center justify-between p-4 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">
                      {form.name}
                    </h3>
                    <Badge
                      variant={form.is_active ? 'default' : 'secondary'}
                      className={form.is_active ? 'bg-emerald-100 text-emerald-800' : ''}
                    >
                      {form.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {SECTOR_NAMES[form.sector_code] ?? form.sector_code} ·{' '}
                    {form.submission_count} submission{form.submission_count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEmbed(form.id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Embed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateForm.mutate({
                        id: form.id,
                        is_active: !form.is_active,
                      })
                    }
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${form.name}"? The embed will stop working immediately.`)) return
                      await deleteForm.mutateAsync(form.id)
                      toast.success('Form deleted')
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
        <CreateFormModal
          onClose={() => setShowCreate(false)}
          onCreate={async (payload) => {
            try {
              const created = await createForm.mutateAsync(payload)
              toast.success('Form created')
              setShowCreate(false)
              setShowEmbed(created.id)
            } catch (err: unknown) {
              const detail =
                (err as { response?: { data?: { detail?: unknown } } }).response
                  ?.data?.detail
              toast.error(
                typeof detail === 'string' ? detail : 'Failed to create form',
              )
            }
          }}
          isPending={createForm.isPending}
        />
      )}

      {showEmbed && (
        <EmbedModal id={showEmbed} onClose={() => setShowEmbed(null)} />
      )}
    </div>
  )
}

function CreateFormModal({
  onClose,
  onCreate,
  isPending,
}: {
  onClose: () => void
  onCreate: (p: { name: string; sector_code: string; redirect_url?: string }) => Promise<void>
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [sectorCode, setSectorCode] = useState('education')
  const [redirect, setRedirect] = useState('')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            onCreate({
              name: name.trim(),
              sector_code: sectorCode,
              redirect_url: redirect.trim() || undefined,
            })
          }}
          className="w-full max-w-md rounded-xl bg-white shadow-xl"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Create a new form</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Website contact form"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Default sector <span className="text-red-500">*</span>
              </label>
              <select
                value={sectorCode}
                onChange={(e) => setSectorCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {Object.entries(SECTOR_NAMES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Redirect URL (optional)
              </label>
              <Input
                value={redirect}
                onChange={(e) => setRedirect(e.target.value)}
                placeholder="https://your-site.com/thanks"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Visitor is redirected here after a successful submission.
              </p>
            </div>
          </div>
          <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create form
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

function EmbedModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useFormEmbed(id)

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
            <h2 className="text-lg font-semibold">Embed this form</h2>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="p-6 space-y-5">
            {isLoading || !data ? (
              <p className="text-center text-muted-foreground">Loading…</p>
            ) : (
              <>
                <Snippet
                  label="1) Script tag (recommended)"
                  help="Paste this anywhere in your page HTML. The form mounts itself next to the script."
                  code={data.script_snippet}
                  onCopy={() => copy(data.script_snippet)}
                />
                <Snippet
                  label="2) iframe"
                  help="Use this if your site disallows inline scripts."
                  code={data.iframe_snippet}
                  onCopy={() => copy(data.iframe_snippet)}
                />
                <Snippet
                  label="3) Direct submit URL"
                  help="POST JSON {name, email, phone, company, ...} here from your own form."
                  code={data.submit_url}
                  onCopy={() => copy(data.submit_url)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Snippet({
  label,
  help,
  code,
  onCopy,
}: {
  label: string
  help: string
  code: string
  onCopy: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </p>
        <Button variant="outline" size="sm" onClick={onCopy}>
          <Copy className="h-3 w-3 mr-1.5" />
          Copy
        </Button>
      </div>
      <p className="text-[11px] text-gray-500 mb-2">{help}</p>
      <pre className="rounded-lg bg-gray-900 text-gray-100 text-xs p-3 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  )
}
