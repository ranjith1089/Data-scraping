import { useState } from 'react'
import { Plus, Copy, Trash2, Power, ExternalLink, Loader2, FileCode2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useForms,
  useCreateForm,
  useUpdateForm,
  useDeleteForm,
  useFormEmbed,
} from '@/hooks/useForms'
import { SECTOR_NAMES, cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export default function FormsPage() {
  const { data: forms = [], isLoading } = useForms()
  const createForm = useCreateForm()
  const updateForm = useUpdateForm()
  const deleteForm = useDeleteForm()
  const [showCreate, setShowCreate] = useState(false)
  const [showEmbed, setShowEmbed] = useState<string | null>(null)

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-sm">
              <FileCode2 className="h-4 w-4 text-white" />
            </div>
            Public Forms
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 ml-10">
            Embed a form on your website to capture leads straight into AveonApex.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-orange-200 hover:opacity-90 hover:-translate-y-px transition-all"
        >
          <Plus className="h-4 w-4" />
          New form
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-white py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 shadow-md mb-4">
            <FileCode2 className="h-6 w-6 text-white" />
          </div>
          <p className="text-base font-bold text-foreground">No forms yet</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            Create a form and paste the embed snippet on your website to start capturing leads.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-orange-200 hover:opacity-90 transition-all"
          >
            <Plus className="h-4 w-4" /> Create your first form
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {forms.map((form) => (
            <div key={form.id} className="relative overflow-hidden flex items-center justify-between rounded-2xl border border-border/60 bg-white p-4 gap-4 shadow-sm card-lift">
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-orange-500 to-rose-500 rounded-t-2xl" />
              <div className="min-w-0 flex-1 mt-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground truncate">{form.name}</h3>
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                    form.is_active
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-muted text-muted-foreground ring-border/40'
                  )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', form.is_active ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                    {form.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {SECTOR_NAMES[form.sector_code] ?? form.sector_code} ·{' '}
                  {form.submission_count} submission{form.submission_count === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowEmbed(form.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Embed
                </button>
                <button
                  onClick={() => updateForm.mutate({ id: form.id, is_active: !form.is_active })}
                  className={cn(
                    'rounded-xl p-1.5 transition-all',
                    form.is_active
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                  title={form.is_active ? 'Disable form' : 'Enable form'}
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete "${form.name}"? The embed will stop working immediately.`)) return
                    await deleteForm.mutateAsync(form.id)
                    toast.success('Form deleted')
                  }}
                  className="rounded-xl p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
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
          className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60 bg-muted/30">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-sm">
              <FileCode2 className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-foreground">Create a new form</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Name <span className="text-rose-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Website contact form"
                required
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Default sector <span className="text-rose-500">*</span>
              </label>
              <select
                value={sectorCode}
                onChange={(e) => setSectorCode(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                {Object.entries(SECTOR_NAMES).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Redirect URL <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={redirect}
                onChange={(e) => setRedirect(e.target.value)}
                placeholder="https://your-site.com/thanks"
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Visitor is redirected here after a successful submission.
              </p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border/60 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-all">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-all">
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
              Create form
            </button>
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
        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-border/60 bg-muted/30 flex items-center justify-between sticky top-0 bg-white z-10">
            <h2 className="text-base font-bold text-foreground">Embed this form</h2>
            <button onClick={onClose} className="rounded-xl border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
              Close
            </button>
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
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <button onClick={onCopy} className="inline-flex items-center gap-1 rounded-xl border border-border/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
          <Copy className="h-3 w-3" />
          Copy
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{help}</p>
      <pre className="rounded-xl bg-slate-900 text-slate-100 text-xs p-4 overflow-x-auto whitespace-pre-wrap break-all shadow-inner">
        {code}
      </pre>
    </div>
  )
}
