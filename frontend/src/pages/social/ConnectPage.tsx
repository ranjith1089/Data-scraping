import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  Instagram,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useDisconnectInstagram,
  useInstagramStatus,
  useStartInstagramOAuth,
} from '@/hooks/social/useInstagramConnect'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ConnectPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data, isLoading, refetch } = useInstagramStatus()
  const startOAuth = useStartInstagramOAuth()
  const disconnect = useDisconnectInstagram()
  const [redirecting, setRedirecting] = useState(false)

  // Surface OAuth callback outcomes from the URL.
  useEffect(() => {
    if (searchParams.get('connected') === 'instagram') {
      toast.success('Instagram connected.')
      refetch()
    } else if (searchParams.get('error')) {
      toast.error(`Instagram OAuth failed: ${searchParams.get('error')}`)
    }
  }, [searchParams, refetch])

  async function handleConnect() {
    try {
      setRedirecting(true)
      const r = await startOAuth.mutateAsync()
      window.location.href = r.auth_url
    } catch {
      setRedirecting(false)
      toast.error('Could not start the Instagram connect flow.')
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Disconnect Instagram? Active automations will stop firing.'))
      return
    try {
      await disconnect.mutateAsync()
      toast.success('Disconnected.')
      refetch()
    } catch {
      toast.error('Failed to disconnect.')
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Connect Instagram</h1>
        <p className="text-muted-foreground mt-1">
          Approve our Meta App once, then your DM rules + campaigns can run.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {data?.connected ? (
            <>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold">
                    Connected{data.handle ? ` as @${data.handle}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.connected_at
                      ? `Since ${new Date(data.connected_at).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <Button onClick={() => navigate('/social/automations')}>
                  Build your first automation
                </Button>
                <Button variant="outline" onClick={() => navigate('/social/conversations')}>
                  Open inbox
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnect.isPending}
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                  <Instagram className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="font-semibold">Not connected</p>
                  <p className="text-xs text-muted-foreground">
                    You'll be redirected to Meta to grant permissions.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleConnect}
                disabled={startOAuth.isPending || redirecting}
                className="w-full sm:w-auto"
              >
                {(startOAuth.isPending || redirecting) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                <Instagram className="h-4 w-4 mr-2" />
                Connect Instagram
              </Button>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 mt-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">App Review status</p>
                    <p className="mt-0.5">
                      Until our Meta App review completes, only test users
                      added on the Meta App dashboard can connect. Have your
                      tenant added there before clicking Connect.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 text-sm space-y-2">
          <h3 className="font-semibold">What happens after you connect</h3>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex gap-2">
              <span>1.</span>
              <span>
                We store your Page Access Token Fernet-encrypted at rest. The
                plaintext token never leaves the backend.
              </span>
            </li>
            <li className="flex gap-2">
              <span>2.</span>
              <span>
                We subscribe your page to messages, comments, mentions, and
                reactions webhooks.
              </span>
            </li>
            <li className="flex gap-2">
              <span>3.</span>
              <span>
                Every comment / DM you receive lands in /social/conversations
                and triggers any matching automation.
              </span>
            </li>
          </ul>
          <a
            href="https://developers.facebook.com/docs/instagram-api/messaging"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 mt-2"
          >
            Meta Instagram Messaging docs
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
