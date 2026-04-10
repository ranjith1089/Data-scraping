import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [tenantName, setTenantName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-generate slug from tenant name unless user has manually edited it
  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(tenantName))
    }
  }, [tenantName, slugTouched])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // IMPORTANT: backend RegisterRequest schema (schemas/auth.py)
      // expects ``tenant_slug``, not ``slug``. Sending the wrong key
      // makes Pydantic return 422 Unprocessable Entity and the form
      // appears to silently fail (the user just sees their inputs sit
      // there). Keep the local state name as `slug` for brevity but
      // map it on the wire.
      const { data } = await api.post('/auth/register', {
        tenant_name: tenantName,
        tenant_slug: slug,
        email,
        password,
        full_name: fullName,
      })

      // The backend returns a TokenResponse — {access_token,
      // refresh_token, token_type, expires_in} — NOT a wrapped
      // {user, access_token, refresh_token}. The previous code
      // assumed the wrapped shape, which would have white-screened
      // immediately after a successful register because data.user
      // was undefined. Fetch /auth/me with the new token before
      // calling login() so the auth store gets a real User object.
      const accessToken = data.access_token as string
      const refreshToken = data.refresh_token as string

      // Temporarily set the bearer header so /auth/me succeeds.
      const meResp = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      login(meResp.data, accessToken, refreshToken)
      toast.success('Account created! Welcome to LeadForge AI.')
      navigate('/')
    } catch (err: any) {
      // FastAPI 422 returns ``detail`` as an array of
      // ValidationError objects, not a string — joining naively
      // produced ``[object Object]`` and made debugging painful.
      // Surface the first ``msg`` field if it's an array.
      const detail = err.response?.data?.detail
      let msg: string
      if (Array.isArray(detail)) {
        msg = detail
          .map((d: any) => `${d.loc?.slice(1).join('.') ?? ''}: ${d.msg}`)
          .join('; ')
      } else if (typeof detail === 'string') {
        msg = detail
      } else {
        msg =
          err.response?.data?.message ||
          'Registration failed. Please try again.'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            LeadForge <span className="text-indigo-400">AI</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Create your workspace in seconds
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-1 text-xl font-semibold text-white">
            Create your account
          </h2>
          <p className="mb-6 text-sm text-slate-400">
            Set up your team workspace and start closing deals
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Organization name
              </label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Acme Solutions Pvt Ltd"
                required
                className={cn(
                  'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white',
                  'placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
                )}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Workspace URL
              </label>
              <div className="flex items-center gap-0">
                <span className="rounded-l-lg border border-r-0 border-white/10 bg-white/10 px-3 py-2.5 text-sm text-slate-400">
                  leadforge.ai/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value))
                    setSlugTouched(true)
                  }}
                  placeholder="acme-solutions"
                  required
                  className={cn(
                    'w-full rounded-r-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white',
                    'placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
                  )}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Your full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rajesh Kumar"
                required
                className={cn(
                  'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white',
                  'placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
                )}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rajesh@acme.in"
                required
                className={cn(
                  'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white',
                  'placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
                )}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  className={cn(
                    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white',
                    'placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white',
                'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30',
                'transition-all hover:shadow-xl hover:shadow-indigo-500/40',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-indigo-400 hover:text-indigo-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
