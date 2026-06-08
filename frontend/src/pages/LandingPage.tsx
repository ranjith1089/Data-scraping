/**
 * LandingPage — AveonApex public marketing homepage.
 * Sections: Navbar · Hero · Stats · Features · Solutions ·
 *           HowItWorks · Blog · Testimonials · CTA · Footer
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

// ─── Global animation styles injected once ───────────────────────────────────

const STYLES = `
  @keyframes float {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-14px); }
  }
  @keyframes float-slow {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    50%      { transform: translateY(-20px) rotate(3deg); }
  }
  @keyframes gradient-shift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes fade-in-up {
    from { opacity:0; transform:translateY(28px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes fade-in {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes pulse-ring {
    0%   { transform:scale(1);   opacity:.6; }
    100% { transform:scale(1.6); opacity:0; }
  }
  @keyframes slide-right {
    from { opacity:0; transform:translateX(-24px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes ticker {
    from { width:0; }
    to   { width:var(--w); }
  }
  @keyframes spin-slow {
    from { transform:rotate(0deg); }
    to   { transform:rotate(360deg); }
  }
  .anim-float      { animation: float 6s ease-in-out infinite; }
  .anim-float-slow { animation: float-slow 8s ease-in-out infinite; }
  .anim-gradient   {
    background-size: 200% 200%;
    animation: gradient-shift 8s ease infinite;
  }
  .reveal { opacity:0; transform:translateY(28px); transition:opacity .6s ease,transform .6s ease; }
  .reveal.visible { opacity:1; transform:translateY(0); }
  .reveal-delay-1 { transition-delay:.1s; }
  .reveal-delay-2 { transition-delay:.2s; }
  .reveal-delay-3 { transition-delay:.3s; }
  .reveal-delay-4 { transition-delay:.4s; }
  .reveal-delay-5 { transition-delay:.5s; }
  .reveal-delay-6 { transition-delay:.6s; }
  .card-hover {
    transition: transform .25s ease, box-shadow .25s ease;
  }
  .card-hover:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 40px -8px rgba(79,70,229,.18);
  }
  .glow-btn {
    box-shadow: 0 0 0 0 rgba(99,102,241,.5);
    transition: box-shadow .3s ease, transform .2s ease;
  }
  .glow-btn:hover {
    box-shadow: 0 0 0 8px rgba(99,102,241,0);
    transform: translateY(-1px);
  }
  .grid-bg {
    background-image:
      linear-gradient(rgba(99,102,241,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,102,241,.06) 1px, transparent 1px);
    background-size: 48px 48px;
  }
`

// ─── Scroll reveal hook ───────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const els = el.querySelectorAll<HTMLElement>('.reveal')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible')
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
  return ref
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-bold text-xl text-gray-900">Aveon<span className="text-indigo-600">Apex</span></span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {[['features','Features'],['solutions','Solutions'],['how-it-works','How It Works'],['blog','Blog']].map(([id,label]) => (
            <button key={id} onClick={() => scrollTo(id)}
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
              {label}
            </button>
          ))}
        </nav>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors px-4 py-2">
            Sign In
          </Link>
          <Link to="/register"
            className="glow-btn inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
            Get Started Free
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden p-2 text-gray-600" onClick={() => setMenuOpen((v) => !v)}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            {menuOpen
              ? <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
          {[['features','Features'],['solutions','Solutions'],['how-it-works','How It Works'],['blog','Blog']].map(([id,label]) => (
            <button key={id} onClick={() => scrollTo(id)}
              className="block w-full text-left text-sm font-medium text-gray-700 py-2">
              {label}
            </button>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link to="/login" className="block text-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700">Sign In</Link>
            <Link to="/register" className="block text-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Get Started Free</Link>
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function ProductMockup() {
  return (
    <div className="relative w-full max-w-xl mx-auto">
      {/* Glow behind */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 to-violet-500/30 blur-3xl rounded-3xl" />

      {/* Browser chrome */}
      <div className="relative rounded-2xl border border-white/20 bg-gray-900/95 shadow-2xl overflow-hidden">
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 mx-3 rounded-md bg-gray-700/60 px-3 py-1 text-xs text-gray-400 font-mono">
            app.aveonapex.com/dashboard
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-4 space-y-3">
          {/* Top stat row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total Leads', value: '2,847', color: 'from-indigo-500 to-indigo-600' },
              { label: 'Hot Leads', value: '142', color: 'from-rose-500 to-rose-600' },
              { label: 'Pipeline', value: '₹48L', color: 'from-emerald-500 to-emerald-600' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl bg-gradient-to-br ${s.color} p-3`}>
                <p className="text-[10px] text-white/70 font-medium">{s.label}</p>
                <p className="text-lg font-bold text-white mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Pipeline stages */}
          <div className="rounded-xl bg-gray-800/60 p-3">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">Pipeline Stage</p>
            <div className="space-y-2">
              {[
                { stage: 'Proposal', count: 24, w: '75%', color: 'bg-indigo-500' },
                { stage: 'Negotiation', count: 11, w: '45%', color: 'bg-violet-500' },
                { stage: 'Won', count: 8, w: '30%', color: 'bg-emerald-500' },
              ].map((row) => (
                <div key={row.stage} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-20 shrink-0">{row.stage}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-700">
                    <div className={`h-2 rounded-full ${row.color} transition-all`} style={{ width: row.w }} />
                  </div>
                  <span className="text-[10px] text-gray-300 font-medium w-4 text-right">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="rounded-xl bg-gray-800/60 p-3">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">Recent Activity</p>
            <div className="space-y-1.5">
              {[
                { icon: '🤖', text: 'AI scored 12 new leads', time: '2m ago', dot: 'bg-indigo-400' },
                { icon: '✉️', text: 'Sequence step sent to Ranjith', time: '5m ago', dot: 'bg-emerald-400' },
                { icon: '📞', text: 'Call logged — TechSpark Ltd.', time: '12m ago', dot: 'bg-amber-400' },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${a.dot} shrink-0`} />
                  <span className="text-[10px] text-gray-300 flex-1 truncate">{a.icon} {a.text}</span>
                  <span className="text-[10px] text-gray-500 shrink-0">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating notification badge */}
      <div className="absolute -top-3 -right-3 anim-float rounded-2xl bg-white shadow-xl border border-gray-100 px-3 py-2 flex items-center gap-2">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <span className="text-sm">🧠</span>
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900">Lead Scored!</p>
          <p className="text-[10px] text-gray-500">Score: 92 · Hot 🔥</p>
        </div>
      </div>

      {/* Floating WhatsApp badge */}
      <div className="absolute -bottom-4 -left-4 anim-float-slow rounded-2xl bg-white shadow-xl border border-gray-100 px-3 py-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <span className="text-sm">💬</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900">Message Sent</p>
          <p className="text-[10px] text-gray-500">WhatsApp · Delivered ✓✓</p>
        </div>
      </div>
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0a0a14]">
      {/* Background grid */}
      <div className="absolute inset-0 grid-bg opacity-40" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-16 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5">
              <div className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" style={{ animation: 'pulse-ring 1.5s cubic-bezier(0,0,.2,1) infinite' }} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
              </div>
              <span className="text-sm font-medium text-indigo-300">AI-Powered · Built for India</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.08] tracking-tight">
              Close Deals
              <span className="block">
                <span className="anim-gradient bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                  3× Faster
                </span>
              </span>
              with AI Sales
              <span className="block text-white/90">Automation</span>
            </h1>

            {/* Sub */}
            <p className="text-lg text-gray-400 leading-relaxed max-w-lg">
              AveonApex combines <strong className="text-white font-semibold">AI lead scoring</strong>, automated outreach across
              <strong className="text-white font-semibold"> Email, WhatsApp & LinkedIn</strong>, and a real-time revenue pipeline —
              everything your B2B sales team needs to grow faster.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link to="/register"
                className="glow-btn inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-4 text-base font-semibold text-white hover:bg-indigo-500 transition-colors">
                Start for Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link to="/login"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-base font-semibold text-white hover:bg-white/10 transition-colors backdrop-blur-sm">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
                </svg>
                View Demo
              </Link>
            </div>

            {/* Social proof avatars */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0a0a14] flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: c }}>
                    {['R','S','A','M','P'][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((s) => <span key={s} className="text-amber-400 text-sm">★</span>)}
                </div>
                <p className="text-xs text-gray-400">Trusted by 500+ sales teams</p>
              </div>
            </div>
          </div>

          {/* Right: product mockup */}
          <div className="hidden lg:block">
            <ProductMockup />
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 inset-x-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 80L1440 80L1440 40C1200 0 720 80 0 40L0 80Z" fill="white" />
        </svg>
      </div>
    </section>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

const STATS = [
  { value: '500+',  label: 'Sales Teams',        icon: '🏢' },
  { value: '2M+',   label: 'Leads Managed',       icon: '👥' },
  { value: '3×',    label: 'Faster Outreach',     icon: '⚡' },
  { value: '45%',   label: 'Higher Conversion',   icon: '📈' },
  { value: '5',     label: 'Outreach Channels',   icon: '📡' },
  { value: '99.9%', label: 'Uptime SLA',          icon: '🛡️' },
]

function StatsSection() {
  const ref = useReveal()
  return (
    <section ref={ref} className="py-16 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 text-center">
          {STATS.map((s, i) => (
            <div key={s.label} className={`reveal reveal-delay-${i + 1}`}>
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-3xl font-extrabold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features section ─────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI Lead Scoring & Enrichment',
    desc: 'Automatically score every lead 0–100 using Claude AI. Enrich with company data, LinkedIn profiles, and emails via Apollo.io & Hunter.io — in one click.',
    color: 'from-indigo-500/10 to-indigo-600/10 border-indigo-200',
    badge: 'AI-Powered',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    icon: '💬',
    title: 'Multi-Channel Outreach',
    desc: 'Reach prospects on Email, WhatsApp Cloud API, and LinkedIn — all from one platform. AI writes personalized messages for every channel and tone.',
    color: 'from-green-500/10 to-emerald-600/10 border-green-200',
    badge: 'WhatsApp · LinkedIn · Email',
    badgeColor: 'bg-green-100 text-green-700',
  },
  {
    icon: '📧',
    title: 'Email Sequences & Drip Campaigns',
    desc: 'Build automated multi-step drip campaigns with per-step delays. APScheduler sends emails every 5 min. Track opens, replies, and bounces via SendGrid webhooks.',
    color: 'from-violet-500/10 to-purple-600/10 border-violet-200',
    badge: 'Automated',
    badgeColor: 'bg-violet-100 text-violet-700',
  },
  {
    icon: '💰',
    title: 'Revenue Pipeline & Deals',
    desc: 'Visualize your sales pipeline with a Kanban board and 3D funnel. Track deals from open to won/lost. Get weighted revenue forecasts and win-rate analytics.',
    color: 'from-amber-500/10 to-orange-600/10 border-amber-200',
    badge: 'Forecasting',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    icon: '📊',
    title: 'Reports & Analytics',
    desc: 'Deep-dive dashboards for leads, revenue, outreach channels, and team activity. Area charts, bar charts, and pipeline breakdowns — refreshed in real-time.',
    color: 'from-sky-500/10 to-blue-600/10 border-sky-200',
    badge: 'Real-Time',
    badgeColor: 'bg-sky-100 text-sky-700',
  },
  {
    icon: '✅',
    title: 'Tasks & Follow-ups',
    desc: 'Never let a follow-up slip. Create tasks linked to leads and deals, set due dates, get overdue alerts, and track calls, emails, and meetings in a single view.',
    color: 'from-rose-500/10 to-pink-600/10 border-rose-200',
    badge: 'Reminders',
    badgeColor: 'bg-rose-100 text-rose-700',
  },
]

function FeaturesSection() {
  const ref = useReveal()
  return (
    <section id="features" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-4">
            ⚡ Core Features
          </div>
          <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight">
            Everything Your Sales Team Needs
          </h2>
          <p className="reveal reveal-delay-2 mt-4 text-lg text-gray-500">
            One platform to discover, score, engage, and close — powered by AI and built for speed.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className={`reveal reveal-delay-${(i % 3) + 1} card-hover rounded-2xl border bg-gradient-to-br ${f.color} p-7 space-y-4`}
            >
              <div className="flex items-start justify-between">
                <div className="text-4xl">{f.icon}</div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${f.badgeColor}`}>
                  {f.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Solutions section ────────────────────────────────────────────────────────

const SOLUTIONS = [
  {
    emoji: '🚀',
    title: 'SaaS & Technology',
    subtitle: 'Scale outbound faster',
    desc: 'Automate your entire SDR workflow. AI scores inbound leads, sequences follow-ups, and keeps your pipeline full — without hiring more reps.',
    bullets: ['AI-generated cold emails', 'LinkedIn prospecting automation', 'Deal forecasting by stage', 'CRM for remote-first teams'],
    gradient: 'from-indigo-600 to-violet-600',
  },
  {
    emoji: '📣',
    title: 'Marketing Agencies',
    subtitle: 'Manage every client in one place',
    desc: 'Run multi-tenant campaigns for all your clients from a single AveonApex workspace. Track email open rates, WhatsApp reply rates, and conversions per client.',
    bullets: ['Multi-channel campaign builder', 'WhatsApp broadcast sequences', 'Per-client pipeline views', 'Open & reply rate reporting'],
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    emoji: '🌱',
    title: 'SMBs & Startups',
    subtitle: 'Punch above your weight',
    desc: "Enterprise-grade sales automation without the enterprise price tag. AveonApex gives your small team the AI tools only large companies could afford — until now.",
    bullets: ['Lead enrichment in one click', 'Email sequences on autopilot', 'Revenue pipeline & deal tracking', 'Task & follow-up reminders'],
    gradient: 'from-emerald-500 to-teal-600',
  },
]

function SolutionsSection() {
  const ref = useReveal()
  return (
    <section id="solutions" ref={ref} className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-4">
            🎯 Solutions
          </div>
          <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900">
            Built for Every Sales Team
          </h2>
          <p className="reveal reveal-delay-2 mt-4 text-lg text-gray-500">
            Whether you're a 2-person startup or a 50-person sales org, AveonApex scales with you.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {SOLUTIONS.map((s, i) => (
            <article
              key={s.title}
              className={`reveal reveal-delay-${i + 1} card-hover rounded-3xl overflow-hidden bg-white border border-gray-200 flex flex-col`}
            >
              {/* Gradient header */}
              <div className={`bg-gradient-to-br ${s.gradient} p-7`}>
                <div className="text-5xl mb-4">{s.emoji}</div>
                <h3 className="text-xl font-bold text-white">{s.title}</h3>
                <p className="text-sm text-white/70 mt-1 font-medium">{s.subtitle}</p>
              </div>
              {/* Body */}
              <div className="p-7 flex-1 space-y-5">
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                <ul className="space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`block text-center rounded-xl bg-gradient-to-r ${s.gradient} py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity mt-auto`}>
                  Get Started →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    num: '01',
    icon: '🔍',
    title: 'Discover & Import Leads',
    desc: 'Search Apollo.io\'s database of 200M+ contacts directly from AveonApex. Or import your existing list via CSV. Every lead is automatically deduplicated.',
    color: 'border-indigo-300 bg-indigo-50',
    numColor: 'text-indigo-400',
  },
  {
    num: '02',
    icon: '🧠',
    title: 'AI Scores & Enriches',
    desc: 'Claude AI analyses each lead\'s profile and scores them 0–100 with ICP fit labels. Hunter.io and ProxyCurl fill in missing emails, company data, and LinkedIn profiles.',
    color: 'border-violet-300 bg-violet-50',
    numColor: 'text-violet-400',
  },
  {
    num: '03',
    icon: '✉️',
    title: 'Automate Outreach',
    desc: 'Enrol hot leads into multi-step email sequences. Ping them on WhatsApp. Connect on LinkedIn — all with AI-written personalised messages. Tasks ensure nothing slips.',
    color: 'border-emerald-300 bg-emerald-50',
    numColor: 'text-emerald-400',
  },
  {
    num: '04',
    icon: '🏆',
    title: 'Close & Track Revenue',
    desc: 'Move deals through your pipeline with drag-and-drop Kanban. Mark deals won or lost, log activities, and watch your revenue forecast update in real-time.',
    color: 'border-amber-300 bg-amber-50',
    numColor: 'text-amber-500',
  },
]

function HowItWorksSection() {
  const ref = useReveal()
  return (
    <section id="how-it-works" ref={ref} className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700 mb-4">
            🔄 How It Works
          </div>
          <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900">
            From Zero to Closed Deal
          </h2>
          <p className="reveal reveal-delay-2 mt-4 text-lg text-gray-500">
            Four steps to transform your B2B sales process — most teams are up and running in under an hour.
          </p>
        </div>

        <div className="relative">
          {/* Connector line (desktop only) */}
          <div className="hidden lg:block absolute top-16 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-indigo-200 via-violet-200 to-amber-200" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_STEPS.map((s, i) => (
              <div key={s.num} className={`reveal reveal-delay-${i + 1} text-center`}>
                <div className={`relative inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 ${s.color} text-3xl mb-5 mx-auto`}>
                  {s.icon}
                  <span className={`absolute -top-3 -right-3 text-xs font-black ${s.numColor}`}>{s.num}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Blog section ─────────────────────────────────────────────────────────────

const BLOG_POSTS = [
  {
    category: 'AI & Sales',
    categoryColor: 'bg-indigo-50 text-indigo-700',
    date: 'May 28, 2025',
    readTime: '6 min read',
    title: '5 Ways AI Is Transforming B2B Sales in India in 2025',
    excerpt: 'From automated lead scoring to AI-written outreach messages, artificial intelligence is no longer a luxury for large enterprises. Here\'s how Indian SMBs are using AI to outpace bigger competitors and close deals in half the time.',
    author: 'Priya Sharma',
    authorRole: 'Head of Product',
    emoji: '🧠',
    bg: 'from-indigo-500 to-violet-600',
  },
  {
    category: 'Outreach',
    categoryColor: 'bg-green-50 text-green-700',
    date: 'May 15, 2025',
    readTime: '5 min read',
    title: 'WhatsApp for B2B Sales: Why India\'s Top Teams Are Switching',
    excerpt: 'WhatsApp has a 95%+ open rate in India compared to email\'s 20%. Discover why forward-thinking sales teams are moving their follow-up cadences to WhatsApp — and how to do it without spamming your prospects.',
    author: 'Arjun Mehta',
    authorRole: 'Sales Strategy',
    emoji: '💬',
    bg: 'from-green-500 to-emerald-600',
  },
  {
    category: 'Email Sequences',
    categoryColor: 'bg-amber-50 text-amber-700',
    date: 'May 3, 2025',
    readTime: '8 min read',
    title: 'How to Build a 3-Step Email Drip That Converts in 2025',
    excerpt: 'A well-designed drip sequence can convert a cold lead into a warm conversation in under two weeks. We break down the exact subject lines, timing, and call-to-action formulas used by high-performing B2B sales teams.',
    author: 'Sneha Iyer',
    authorRole: 'Content Lead',
    emoji: '📧',
    bg: 'from-amber-500 to-orange-500',
  },
]

function BlogSection() {
  const ref = useReveal()
  return (
    <section id="blog" ref={ref} className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-14">
          <div>
            <div className="reveal inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-100 px-4 py-1.5 text-sm font-medium text-amber-700 mb-4">
              📚 Blog
            </div>
            <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900">
              Sales Insights & Guides
            </h2>
            <p className="reveal reveal-delay-2 mt-3 text-lg text-gray-500">
              Practical tips to level up your B2B sales process.
            </p>
          </div>
          <a href="#blog" className="reveal reveal-delay-3 shrink-0 text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            View all posts
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BLOG_POSTS.map((post, i) => (
            <article key={post.title} className={`reveal reveal-delay-${i + 1} card-hover rounded-3xl overflow-hidden bg-white border border-gray-200 flex flex-col`}>
              {/* Thumbnail */}
              <div className={`bg-gradient-to-br ${post.bg} h-44 flex items-center justify-center`}>
                <span className="text-7xl">{post.emoji}</span>
              </div>
              {/* Content */}
              <div className="p-6 flex-1 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${post.categoryColor}`}>
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-400">{post.readTime}</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 leading-snug">{post.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{post.excerpt}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                      {post.author[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{post.author}</p>
                      <p className="text-[10px] text-gray-400">{post.authorRole}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{post.date}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: 'AveonApex cut our SDR\'s manual work by 70%. The AI scoring immediately tells us which leads to call first — our conversion rate went from 8% to 21% in 90 days.',
    name: 'Ranjith Kumar',
    title: 'VP Sales · TechSpark Solutions',
    avatar: 'R',
    rating: 5,
    color: 'from-indigo-500 to-violet-500',
  },
  {
    quote: 'We run campaigns for 15 clients and AveonApex is the only platform that handles multi-tenant outreach this cleanly. The WhatsApp integration alone saved us 3 hours a day.',
    name: 'Sneha Agarwal',
    title: 'Founder · GrowthLab Agency',
    avatar: 'S',
    rating: 5,
    color: 'from-rose-500 to-pink-500',
  },
  {
    quote: 'The email sequences with AI-written personalisation increased our reply rate from 2% to 11%. I honestly thought those numbers were only for big tech companies.',
    name: 'Arjun Pillai',
    title: 'Head of Growth · Finvesta',
    avatar: 'A',
    rating: 5,
    color: 'from-emerald-500 to-teal-500',
  },
]

function TestimonialsSection() {
  const ref = useReveal()
  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-14">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-100 px-4 py-1.5 text-sm font-medium text-rose-600 mb-4">
            ❤️ Customer Stories
          </div>
          <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900">
            Loved by Sales Teams
          </h2>
          <p className="reveal reveal-delay-2 mt-3 text-lg text-gray-500">
            Real results from real sales teams across India.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t, i) => (
            <blockquote
              key={t.name}
              className={`reveal reveal-delay-${i + 1} card-hover rounded-3xl border border-gray-200 bg-white p-8 space-y-5 flex flex-col`}
            >
              {/* Stars */}
              <div className="flex gap-1">
                {Array(t.rating).fill(0).map((_, j) => (
                  <span key={j} className="text-amber-400 text-base">★</span>
                ))}
              </div>
              {/* Quote */}
              <p className="text-gray-700 leading-relaxed text-sm flex-1">"{t.quote}"</p>
              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-sm font-bold text-white`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.title}</p>
                </div>
              </div>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA section ──────────────────────────────────────────────────────────────

function CTASection() {
  const ref = useReveal()
  return (
    <section ref={ref} className="py-24 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="reveal rounded-3xl bg-[#0a0a14] overflow-hidden relative text-center px-8 py-20">
          {/* Background orbs */}
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl" />
          {/* Grid bg */}
          <div className="absolute inset-0 grid-bg opacity-30" />

          <div className="relative space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-indigo-300">
              🚀 Free forever plan available
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Ready to Close More Deals?
            </h2>
            <p className="text-lg text-gray-400 max-w-xl mx-auto">
              Join 500+ sales teams using AveonApex to discover, score, and engage leads — on autopilot. No credit card required.
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-2">
              <Link to="/register"
                className="glow-btn inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white hover:bg-indigo-500 transition-colors">
                Start for Free →
              </Link>
              <Link to="/login"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-colors">
                Sign In
              </Link>
            </div>
            <p className="text-xs text-gray-500 pt-2">
              No credit card · Setup in 5 minutes · Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

const FOOTER_LINKS = {
  Product:   ['Lead Management', 'AI Scoring', 'Email Sequences', 'WhatsApp Outreach', 'LinkedIn Prospecting', 'Revenue Pipeline', 'Reports', 'Tasks'],
  Solutions: ['SaaS & Technology', 'Marketing Agencies', 'SMBs & Startups', 'Enterprise Sales'],
  Resources: ['Blog', 'Documentation', 'API Reference', 'Changelog', 'Status Page'],
  Company:   ['About Us', 'Careers', 'Privacy Policy', 'Terms of Service', 'Contact'],
}

function Footer() {
  return (
    <footer className="bg-[#0a0a14] border-t border-white/10 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="font-bold text-xl text-white">Aveon<span className="text-indigo-400">Apex</span></span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              AI-powered CRM built for B2B sales teams in India. Close deals faster with intelligent automation.
            </p>
            {/* Social */}
            <div className="flex gap-3 pt-2">
              {[
                { label: 'Twitter / X', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
                { label: 'LinkedIn', path: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
              ].map((s) => (
                <a key={s.label} href="#" aria-label={s.label}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={s.path} /></svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([col, links]) => (
            <div key={col}>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">{col}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">© 2025 AveonApex. All rights reserved. Built in India 🇮🇳</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Terms of Service</a>
            <a href="#" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <style>{STYLES}</style>
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <SolutionsSection />
        <HowItWorksSection />
        <BlogSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
