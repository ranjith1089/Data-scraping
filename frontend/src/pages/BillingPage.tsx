import { useState } from 'react'
import { CheckCircle2, Loader2, Zap, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useBillingCurrent,
  useRequestUpgrade,
  type BillingCurrent,
} from '@/hooks/useBilling'
import { cn, formatINR } from '@/lib/utils'

export default function BillingPage() {
  const { data, isLoading } = useBillingCurrent()

  if (isLoading || !data) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
        Loading billing data…
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          Billing & Usage
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 ml-10">
          Current plan, this month's usage, and upgrade options.
        </p>
      </div>

      <CurrentPlanCard data={data} />
      <UsageBars data={data} />
      <PlansGrid currentPlan={data.plan.code} />
    </div>
  )
}

function CurrentPlanCard({ data }: { data: BillingCurrent }) {
  const isFree = (data.plan.price_inr ?? 0) === 0
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-600" />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Current plan
          </p>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-extrabold text-foreground">
              {data.plan.name}
            </p>
            {!isFree && (
              <span className="text-sm font-medium text-muted-foreground">
                {formatINR(data.plan.price_inr)}/month
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
              <Zap className="h-3 w-3" /> Active
            </span>
          </div>
          {data.next_reset_at && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Usage resets {new Date(data.next_reset_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function UsageBars({ data }: { data: BillingCurrent }) {
  const rows = [
    {
      label: 'Users',
      used: data.usage.users,
      limit: data.limits.users,
      pct: data.percent_used.users,
    },
    {
      label: 'Leads',
      used: data.usage.leads,
      limit: data.limits.leads,
      pct: data.percent_used.leads,
    },
    {
      label: 'AI calls this month',
      used: data.usage.ai_calls_this_month,
      limit: data.limits.ai_calls_per_month,
      pct: data.percent_used.ai_calls,
    },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-sky-400 to-indigo-500" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Usage this month</p>
      <div className="space-y-5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-foreground">{r.label}</span>
              <span className="text-sm font-medium text-muted-foreground">
                {r.used.toLocaleString()} / {r.limit.toLocaleString()}
              </span>
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all rounded-full',
                  r.pct >= 95
                    ? 'bg-gradient-to-r from-rose-500 to-red-500'
                    : r.pct >= 80
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-500',
                )}
                style={{ width: `${Math.min(r.pct, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {r.pct.toFixed(1)}% used
            </p>
          </div>
        ))}
        <div className="pt-3 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            AI tokens this month:{' '}
            <span className="font-bold text-foreground">
              {data.usage.ai_tokens_this_month.toLocaleString()}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

const PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    price: 0,
    tagline: 'For small teams trying us out.',
    points: [
      '3 users',
      '1,000 leads',
      '500 AI calls/month',
      'Community support',
    ],
  },
  {
    code: 'growth',
    name: 'Growth',
    price: 4999,
    tagline: 'For growing sales teams.',
    points: [
      '10 users',
      '10,000 leads',
      '5,000 AI calls/month',
      'Email support',
      'Campaign A/B testing',
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 14999,
    tagline: 'For scale-up operations.',
    points: [
      'Unlimited users',
      '100,000 leads',
      '50,000 AI calls/month',
      'Priority support',
      'Custom AI integrations',
    ],
  },
] as const

function PlansGrid({ currentPlan }: { currentPlan: string }) {
  const upgrade = useRequestUpgrade()
  const [pending, setPending] = useState<string | null>(null)

  async function handleRequest(code: 'starter' | 'growth' | 'enterprise') {
    if (code === currentPlan) return
    if (
      !window.confirm(
        `Request upgrade to ${code.charAt(0).toUpperCase() + code.slice(1)}? Our team will reach out to confirm.`,
      )
    )
      return
    setPending(code)
    try {
      const r = await upgrade.mutateAsync(code)
      toast.success(r.message)
    } catch {
      toast.error('Failed to request upgrade')
    } finally {
      setPending(null)
    }
  }

  const PLAN_GRADIENTS: Record<string, string> = {
    starter:    'from-slate-400 to-gray-500',
    growth:     'from-indigo-500 to-violet-600',
    enterprise: 'from-amber-500 to-orange-500',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANS.map((p) => {
        const isCurrent = currentPlan === p.code
        const gradient = PLAN_GRADIENTS[p.code] || 'from-indigo-500 to-violet-600'
        return (
          <div
            key={p.code}
            className={cn(
              'relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all card-lift',
              isCurrent ? 'border-indigo-300 shadow-indigo-100' : 'border-border/60'
            )}
          >
            <div className={cn('absolute top-0 inset-x-0 h-1 bg-gradient-to-r rounded-t-2xl', gradient)} />
            <div className="p-5 pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm', gradient)}>
                  <Zap className="h-4 w-4 text-white" />
                </div>
                {isCurrent && (
                  <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-gradient-to-r text-white shadow-sm', gradient)}>
                    Active
                  </span>
                )}
              </div>
              <h3 className="text-lg font-extrabold text-foreground mt-3">{p.name}</h3>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">
                {p.price === 0 ? 'Free' : formatINR(p.price)}
                {p.price > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    /month
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {p.tagline}
              </p>
              <ul className="space-y-2 mb-5">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-foreground/80">{pt}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button
                  disabled
                  className="w-full rounded-xl border border-border/60 py-2 text-sm font-semibold text-muted-foreground cursor-default"
                >
                  Current plan
                </button>
              ) : (
                <button
                  disabled={pending === p.code}
                  onClick={() => handleRequest(p.code)}
                  className={cn(
                    'w-full rounded-xl py-2 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-all disabled:opacity-50 bg-gradient-to-r',
                    gradient
                  )}
                >
                  {pending === p.code ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Requesting…
                    </span>
                  ) : (
                    `Upgrade to ${p.name}`
                  )}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
