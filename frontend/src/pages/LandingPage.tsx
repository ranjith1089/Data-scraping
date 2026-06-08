/**
 * LandingPage — AveonApex public marketing homepage.
 * Redesigned: lighter hero, high-contrast text, glassmorphism cards, vivid colors.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

// ─── Styles ──────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes float {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    50%      { transform: translateY(-16px) rotate(1deg); }
  }
  @keyframes float-slow {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    50%      { transform: translateY(-22px) rotate(-2deg); }
  }
  @keyframes gradient-x {
    0%,100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
  }
  @keyframes pulse-ring {
    0%   { transform:scale(1);   opacity:.7; }
    100% { transform:scale(1.8); opacity:0; }
  }
  @keyframes shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @keyframes orb-move {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(40px,-30px) scale(1.1); }
    66%      { transform: translate(-20px,20px) scale(0.95); }
  }
  @keyframes fade-up {
    from { opacity:0; transform:translateY(32px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .anim-float      { animation: float 7s ease-in-out infinite; }
  .anim-float-slow { animation: float-slow 9s ease-in-out infinite; }
  .anim-gradient   { background-size:200% 200%; animation: gradient-x 6s ease infinite; }
  .anim-orb        { animation: orb-move 12s ease-in-out infinite; }
  .anim-orb-2      { animation: orb-move 16s ease-in-out infinite reverse; }

  .reveal { opacity:0; transform:translateY(30px); transition: opacity .65s ease, transform .65s ease; }
  .reveal.visible  { opacity:1; transform:translateY(0); }
  .reveal-delay-1  { transition-delay: .08s; }
  .reveal-delay-2  { transition-delay: .16s; }
  .reveal-delay-3  { transition-delay: .24s; }
  .reveal-delay-4  { transition-delay: .32s; }
  .reveal-delay-5  { transition-delay: .40s; }
  .reveal-delay-6  { transition-delay: .48s; }

  .card-hover { transition: transform .28s ease, box-shadow .28s ease; }
  .card-hover:hover { transform: translateY(-7px); box-shadow: 0 24px 48px -10px rgba(99,102,241,.22); }

  .glow-btn { position:relative; overflow:hidden; transition: transform .2s ease, box-shadow .3s ease; }
  .glow-btn::after {
    content:''; position:absolute; inset:0;
    background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,.18) 50%, transparent 80%);
    transform: translateX(-100%);
  }
  .glow-btn:hover { transform:translateY(-2px); box-shadow: 0 8px 30px -4px rgba(99,102,241,.55); }
  .glow-btn:hover::after { animation: shimmer .7s forwards; }

  .glass {
    background: rgba(255,255,255,.07);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,.12);
  }
  .glass-light {
    background: rgba(255,255,255,.75);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,.9);
  }
  .dot-grid {
    background-image: radial-gradient(rgba(165,180,252,.25) 1px, transparent 1px);
    background-size: 28px 28px;
  }
  .line-grid {
    background-image:
      linear-gradient(rgba(129,140,248,.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(129,140,248,.07) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  /* Noise texture overlay */
  .noise::before {
    content:''; position:absolute; inset:0; pointer-events:none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E");
    opacity:.4; z-index:1;
  }
  .hero-gradient {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #3730a3 45%, #4c1d95 65%, #2e1065 85%, #1e1b4b 100%);
  }
`

// ─── Scroll reveal ─────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const nodes = container.querySelectorAll<HTMLElement>('.reveal')
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } }),
      { threshold: 0.12 }
    )
    nodes.forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [])
  return ref
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 32)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }, [])

  const NAV = [['features','Features'],['solutions','Solutions'],['how-it-works','How It Works'],['blog','Blog']]

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-400 ${
      scrolled ? 'bg-white/95 backdrop-blur-xl shadow-md shadow-indigo-100/40' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2.2}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className={`font-bold text-xl tracking-tight transition-colors ${scrolled ? 'text-gray-900' : 'text-white'}`}>
            Aveon<span className={scrolled ? 'text-indigo-600' : 'text-indigo-300'}>Apex</span>
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV.map(([id,label]) => (
            <button key={id} onClick={() => scrollTo(id)}
              className={`text-sm font-medium transition-colors hover:text-indigo-400 ${scrolled ? 'text-gray-600' : 'text-white/80'}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className={`text-sm font-medium px-4 py-2 transition-colors ${scrolled ? 'text-gray-700 hover:text-indigo-600' : 'text-white/80 hover:text-white'}`}>
            Sign In
          </Link>
          <Link to="/register"
            className="glow-btn inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25">
            Get Started Free
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <button className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-gray-600' : 'text-white'}`}
          onClick={() => setMenuOpen(v => !v)}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            {menuOpen
              ? <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 px-6 py-4 space-y-2">
          {NAV.map(([id,label]) => (
            <button key={id} onClick={() => scrollTo(id)}
              className="block w-full text-left py-3 text-sm font-medium text-gray-700 border-b border-gray-50 last:border-0">
              {label}
            </button>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link to="/login" className="block text-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700">Sign In</Link>
            <Link to="/register" className="block text-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white">Get Started Free</Link>
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Product Mockup ───────────────────────────────────────────────────────────
function ProductMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Layered glows */}
      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/25 via-violet-500/25 to-fuchsia-500/25 blur-3xl rounded-3xl" />
      <div className="absolute -inset-2 bg-gradient-to-br from-violet-600/15 to-indigo-600/15 blur-xl rounded-3xl" />

      {/* Browser window */}
      <div className="relative rounded-2xl border border-white/20 overflow-hidden shadow-2xl shadow-indigo-900/50"
        style={{ background: 'linear-gradient(145deg, #1e1035 0%, #0f0a23 100%)' }}>

        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10"
          style={{ background: 'rgba(255,255,255,.06)' }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/90" />
            <div className="w-3 h-3 rounded-full bg-amber-400/90" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/90" />
          </div>
          <div className="flex-1 mx-2 rounded-lg px-3 py-1 text-xs text-indigo-200/60 font-mono"
            style={{ background: 'rgba(255,255,255,.06)' }}>
            app.aveonapex.com/dashboard
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,.5)]" />
        </div>

        <div className="p-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total Leads', value: '2,847', g: 'from-indigo-500 to-indigo-700', glow: 'shadow-indigo-500/30' },
              { label: 'Hot Leads',   value: '142',   g: 'from-rose-500 to-pink-600',    glow: 'shadow-rose-500/30' },
              { label: 'Pipeline',    value: '₹48L',  g: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/30' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl bg-gradient-to-br ${s.g} p-3 shadow-lg ${s.glow}`}>
                <p className="text-[10px] text-white/65 font-semibold tracking-wide">{s.label}</p>
                <p className="text-[17px] font-extrabold text-white mt-0.5 leading-tight">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Pipeline bars */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.05)' }}>
            <p className="text-[9px] text-indigo-300/60 font-bold uppercase tracking-widest mb-2.5">Pipeline Stage</p>
            <div className="space-y-2">
              {[
                { stage:'Proposal',    pct:75, color:'bg-gradient-to-r from-indigo-500 to-indigo-400', n:24 },
                { stage:'Negotiation', pct:45, color:'bg-gradient-to-r from-violet-500 to-violet-400', n:11 },
                { stage:'Won',         pct:30, color:'bg-gradient-to-r from-emerald-500 to-teal-400',  n:8  },
              ].map(r => (
                <div key={r.stage} className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-200/60 w-20 shrink-0">{r.stage}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,.08)' }}>
                    <div className={`h-1.5 rounded-full ${r.color}`} style={{ width:`${r.pct}%` }} />
                  </div>
                  <span className="text-[10px] text-indigo-100/80 font-semibold w-4 text-right">{r.n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.05)' }}>
            <p className="text-[9px] text-indigo-300/60 font-bold uppercase tracking-widest mb-2">Recent Activity</p>
            <div className="space-y-2">
              {[
                { icon:'🤖', text:'AI scored 12 new leads',            time:'2m', dot:'bg-indigo-400' },
                { icon:'✉️', text:'Sequence step sent to Ranjith',      time:'5m', dot:'bg-emerald-400' },
                { icon:'📞', text:'Call logged — TechSpark Ltd.',       time:'12m',dot:'bg-amber-400' },
              ].map((a,i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${a.dot} shrink-0`} />
                  <span className="text-[10px] text-indigo-100/75 flex-1 truncate">{a.icon} {a.text}</span>
                  <span className="text-[10px] text-indigo-300/40 shrink-0">{a.time} ago</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating — Lead Scored badge */}
      <div className="absolute -top-4 -right-4 anim-float glass-light rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl shadow-indigo-200/40">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-base shadow-lg">🧠</div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow" />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-900 leading-none">Lead Scored!</p>
          <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">Score: 92 · Hot 🔥</p>
        </div>
      </div>

      {/* Floating — WhatsApp badge */}
      <div className="absolute -bottom-5 -left-4 anim-float-slow glass-light rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl shadow-green-200/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-base shadow-lg">💬</div>
        <div>
          <p className="text-xs font-bold text-gray-900 leading-none">Message Sent</p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">WhatsApp · Delivered ✓✓</p>
        </div>
      </div>

      {/* Floating — deal chip */}
      <div className="absolute top-1/2 -left-6 anim-float glass-light rounded-xl px-3 py-2 shadow-lg shadow-amber-200/30 hidden xl:flex items-center gap-2">
        <span className="text-base">🏆</span>
        <div>
          <p className="text-[10px] font-bold text-gray-900 leading-none">Deal Won</p>
          <p className="text-[9px] text-amber-600 font-semibold mt-0.5">+₹2.4L revenue</p>
        </div>
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden hero-gradient noise">
      {/* Animated orbs */}
      <div className="absolute top-16 left-1/4 w-[500px] h-[500px] rounded-full anim-orb"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,.35) 0%, transparent 70%)' }} />
      <div className="absolute bottom-16 right-1/4 w-[400px] h-[400px] rounded-full anim-orb-2"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,.30) 0%, transparent 70%)' }} />
      <div className="absolute top-1/3 right-1/3 w-[300px] h-[300px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(216,180,254,.12) 0%, transparent 70%)' }} />

      {/* Dot grid */}
      <div className="absolute inset-0 dot-grid" style={{ zIndex: 2 }} />

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 w-full" style={{ zIndex: 3 }}>
        <div className="grid lg:grid-cols-2 gap-14 xl:gap-20 items-center">

          {/* ── Left copy ── */}
          <div className="space-y-8">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 glass text-sm font-medium text-indigo-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-300 opacity-75"
                  style={{ animation: 'pulse-ring 1.5s cubic-bezier(0,0,.2,1) infinite' }} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-300" />
              </span>
              AI-Powered CRM · Built for India 🇮🇳
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-6xl xl:text-[4.25rem] font-black text-white leading-[1.06] tracking-tight">
              Close Deals
              <span className="block mt-1">
                <span className="anim-gradient bg-gradient-to-r from-indigo-300 via-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                  3× Faster
                </span>
              </span>
              <span className="block mt-1 text-white/90">with AI Sales</span>
              <span className="block mt-1 text-white/90">Automation</span>
            </h1>

            {/* Subtitle — full white so always visible */}
            <p className="text-[1.05rem] text-slate-200 leading-relaxed max-w-lg font-normal">
              AveonApex combines <strong className="text-white font-bold">AI lead scoring</strong>, automated outreach
              across <strong className="text-white font-bold">Email, WhatsApp & LinkedIn</strong>, and a
              real-time revenue pipeline — everything your B2B sales team needs to grow faster.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-4 pt-1">
              <Link to="/register"
                className="glow-btn inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-700/40">
                Start for Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link to="/login"
                className="inline-flex items-center gap-2.5 rounded-2xl glass px-8 py-4 text-base font-semibold text-white hover:bg-white/15 transition-colors">
                <svg className="w-5 h-5 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
                </svg>
                Watch Demo
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex -space-x-2.5">
                {['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981'].map((c, i) => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-indigo-800 flex items-center justify-center text-xs font-bold text-white shadow-md"
                    style={{ backgroundColor: c }}>
                    {['R','S','A','M','P'][i]}
                  </div>
                ))}
              </div>
              <div className="border-l border-white/15 pl-4">
                <div className="flex gap-0.5 mb-0.5">
                  {[1,2,3,4,5].map(s => <span key={s} className="text-amber-400 text-sm leading-none">★</span>)}
                </div>
                <p className="text-xs text-slate-300 font-medium">Trusted by <strong className="text-white">500+</strong> sales teams</p>
              </div>
            </div>

            {/* Trust chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {['🔒 SOC2 Compliant','⚡ 5-min Setup','🚀 No Credit Card','🇮🇳 India Servers'].map(t => (
                <span key={t} className="glass rounded-full px-3 py-1 text-xs text-slate-200 font-medium">{t}</span>
              ))}
            </div>
          </div>

          {/* ── Right: mockup ── */}
          <div className="hidden lg:block">
            <ProductMockup />
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 inset-x-0 z-10">
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="w-full h-16 sm:h-20">
          <path d="M0 90 L1440 90 L1440 35 C1100 90 700 0 320 50 L0 20 Z" fill="white" />
        </svg>
      </div>
    </section>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────
const STATS = [
  { value:'500+',  label:'Sales Teams',       icon:'🏢', color:'text-indigo-600' },
  { value:'2M+',   label:'Leads Managed',      icon:'👥', color:'text-violet-600' },
  { value:'3×',    label:'Faster Outreach',    icon:'⚡', color:'text-amber-500' },
  { value:'45%',   label:'Higher Conversion',  icon:'📈', color:'text-emerald-600' },
  { value:'5',     label:'Outreach Channels',  icon:'📡', color:'text-sky-600' },
  { value:'99.9%', label:'Uptime SLA',         icon:'🛡️', color:'text-rose-500' },
]

function StatsSection() {
  const ref = useReveal()
  return (
    <section ref={ref} className="py-14 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-10 gap-x-4 text-center">
          {STATS.map((s, i) => (
            <div key={s.label} className={`reveal reveal-delay-${i + 1} group`}>
              <div className="text-3xl mb-2 transition-transform group-hover:scale-110 duration-200">{s.icon}</div>
              <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-sm text-gray-500 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon:'🧠', title:'AI Lead Scoring',          desc:'Score every lead 0–100 with Claude AI. Enrich with company data, LinkedIn & verified emails via Apollo.io & Hunter.io — in one click.', accent:'indigo', badge:'AI-Powered' },
  { icon:'💬', title:'Multi-Channel Outreach',    desc:'Reach prospects via Email, WhatsApp Cloud API, and LinkedIn from one dashboard. AI generates personalised messages for every channel.', accent:'emerald', badge:'3 Channels' },
  { icon:'📧', title:'Email Sequences & Drips',   desc:'Build multi-step drip campaigns with custom delays. SendGrid webhooks track opens, replies & bounces. APScheduler fires every 5 min.', accent:'violet', badge:'Automated' },
  { icon:'💰', title:'Revenue Pipeline',          desc:'Kanban board + 3D funnel view. Track deals from open to won/lost. Get weighted forecasts, win-rate graphs, and overdue deal alerts.', accent:'amber', badge:'Forecasting' },
  { icon:'📊', title:'Deep Analytics',            desc:'Real-time dashboards: lead growth, outreach performance, revenue by month, activity feed. Recharts area/bar/pie — always fresh data.', accent:'sky', badge:'Real-Time' },
  { icon:'✅', title:'Tasks & Follow-ups',        desc:'Create tasks linked to leads or deals. Set due dates, get overdue badges, track calls, emails, and meetings — never miss a follow-up.', accent:'rose', badge:'Reminders' },
]

const ACCENT_MAP: Record<string,{card:string,icon:string,badge:string,num:string}> = {
  indigo:  { card:'bg-indigo-50  border-indigo-200/70',  icon:'bg-indigo-100  text-indigo-600',  badge:'bg-indigo-100  text-indigo-700',  num:'text-indigo-300' },
  emerald: { card:'bg-emerald-50 border-emerald-200/70', icon:'bg-emerald-100 text-emerald-600', badge:'bg-emerald-100 text-emerald-700', num:'text-emerald-300' },
  violet:  { card:'bg-violet-50  border-violet-200/70',  icon:'bg-violet-100  text-violet-600',  badge:'bg-violet-100  text-violet-700',  num:'text-violet-300' },
  amber:   { card:'bg-amber-50   border-amber-200/70',   icon:'bg-amber-100   text-amber-600',   badge:'bg-amber-100   text-amber-700',   num:'text-amber-300' },
  sky:     { card:'bg-sky-50     border-sky-200/70',     icon:'bg-sky-100     text-sky-600',     badge:'bg-sky-100     text-sky-700',     num:'text-sky-300' },
  rose:    { card:'bg-rose-50    border-rose-200/70',    icon:'bg-rose-100    text-rose-600',    badge:'bg-rose-100    text-rose-700',    num:'text-rose-300' },
}

function FeaturesSection() {
  const ref = useReveal()
  return (
    <section id="features" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700 mb-5">
            ⚡ Core Features
          </div>
          <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1]">
            Everything Your Sales Team Needs
          </h2>
          <p className="reveal reveal-delay-2 mt-4 text-lg text-gray-500 leading-relaxed">
            One platform to discover, score, engage, and close — powered by AI and built for speed.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => {
            const a = ACCENT_MAP[f.accent]
            return (
              <article key={f.title}
                className={`reveal reveal-delay-${(i % 3) + 1} card-hover rounded-2xl border ${a.card} p-7 flex flex-col gap-4`}>
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl ${a.icon} flex items-center justify-center text-2xl shadow-sm`}>
                    {f.icon}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${a.badge}`}>{f.badge}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
                <div className="mt-auto pt-3">
                  <Link to="/register" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group">
                    Learn more
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Solutions ────────────────────────────────────────────────────────────────
const SOLUTIONS = [
  {
    emoji:'🚀', title:'SaaS & Technology', subtitle:'Scale outbound faster',
    desc:'Automate your entire SDR workflow. AI scores inbound leads, sequences follow-ups, and keeps your pipeline full — without hiring more reps.',
    bullets:['AI-generated cold emails','LinkedIn prospecting automation','Deal forecasting by stage','CRM for remote-first teams'],
    g:'from-indigo-600 to-violet-700', glow:'shadow-indigo-200',
  },
  {
    emoji:'📣', title:'Marketing Agencies', subtitle:'Manage every client in one place',
    desc:'Run multi-tenant campaigns for all clients from a single workspace. Track email open rates, WhatsApp reply rates, and conversions per client.',
    bullets:['Multi-channel campaign builder','WhatsApp broadcast sequences','Per-client pipeline views','Open & reply rate reporting'],
    g:'from-rose-500 to-pink-600', glow:'shadow-rose-200',
  },
  {
    emoji:'🌱', title:'SMBs & Startups', subtitle:'Punch above your weight',
    desc:"Enterprise-grade sales automation without the price tag. AveonApex gives small teams the AI tools only large companies could afford — until now.",
    bullets:['Lead enrichment in one click','Email sequences on autopilot','Revenue pipeline & deal tracking','Task & follow-up reminders'],
    g:'from-emerald-500 to-teal-600', glow:'shadow-emerald-200',
  },
]

function SolutionsSection() {
  const ref = useReveal()
  return (
    <section id="solutions" ref={ref} className="py-24" style={{ background:'linear-gradient(180deg, #f8f7ff 0%, #f0f4ff 100%)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-violet-100 border border-violet-200 px-4 py-1.5 text-sm font-semibold text-violet-700 mb-5">
            🎯 Solutions
          </div>
          <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1]">
            Built for Every Sales Team
          </h2>
          <p className="reveal reveal-delay-2 mt-4 text-lg text-gray-500">
            Whether you're a 2-person startup or a 50-person sales org, AveonApex scales with you.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {SOLUTIONS.map((s, i) => (
            <article key={s.title}
              className={`reveal reveal-delay-${i + 1} card-hover rounded-3xl overflow-hidden bg-white border border-gray-200/80 shadow-lg ${s.glow} flex flex-col`}>
              <div className={`bg-gradient-to-br ${s.g} p-8 relative overflow-hidden`}>
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="text-5xl mb-4">{s.emoji}</div>
                  <h3 className="text-xl font-extrabold text-white">{s.title}</h3>
                  <p className="text-sm text-white/75 mt-1 font-medium">{s.subtitle}</p>
                </div>
              </div>
              <div className="p-7 flex-1 flex flex-col gap-5">
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                <ul className="space-y-2.5 flex-1">
                  {s.bullets.map(b => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`block text-center rounded-xl bg-gradient-to-r ${s.g} py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-md`}>
                  Get Started Free →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const HOW_STEPS = [
  { num:'01', icon:'🔍', title:'Discover & Import', desc:"Search Apollo.io's 200M+ contacts or import CSV. Every lead auto-deduplicated.", colors:'bg-indigo-600', ring:'ring-indigo-200' },
  { num:'02', icon:'🧠', title:'AI Scores & Enriches', desc:'Claude AI scores leads 0–100. Hunter.io fills missing emails and company data.', colors:'bg-violet-600', ring:'ring-violet-200' },
  { num:'03', icon:'✉️', title:'Automate Outreach', desc:'Multi-step email sequences, WhatsApp messages, and LinkedIn — all AI-written.', colors:'bg-fuchsia-600', ring:'ring-fuchsia-200' },
  { num:'04', icon:'🏆', title:'Close & Track Revenue', desc:'Drag-and-drop Kanban. Mark deals won/lost. Revenue forecast updates live.', colors:'bg-amber-500', ring:'ring-amber-200' },
]

function HowItWorksSection() {
  const ref = useReveal()
  return (
    <section id="how-it-works" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-sm font-semibold text-emerald-700 mb-5">
            🔄 How It Works
          </div>
          <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1]">
            From Zero to Closed Deal
          </h2>
          <p className="reveal reveal-delay-2 mt-4 text-lg text-gray-500">
            Four steps. Most teams are up and running in under an hour.
          </p>
        </div>

        <div className="relative">
          {/* Dashed connector */}
          <div className="hidden lg:block absolute top-12 left-[18%] right-[18%] h-px"
            style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #f59e0b)', opacity:.35 }} />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
            {HOW_STEPS.map((s, i) => (
              <div key={s.num} className={`reveal reveal-delay-${i + 1} text-center flex flex-col items-center`}>
                <div className={`relative w-20 h-20 rounded-2xl ${s.colors} ring-4 ${s.ring} flex items-center justify-center text-4xl mb-6 shadow-lg`}>
                  {s.icon}
                  <span className="absolute -top-2 -right-2 text-[10px] font-black text-white bg-gray-900 rounded-full w-5 h-5 flex items-center justify-center">
                    {s.num.replace('0','')}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Blog ──────────────────────────────────────────────────────────────────────
const BLOG_POSTS = [
  {
    cat:'AI & Sales', catStyle:'bg-indigo-100 text-indigo-700',
    date:'May 28, 2025', read:'6 min read',
    title:'5 Ways AI Is Transforming B2B Sales in India in 2025',
    excerpt:'From automated lead scoring to AI-written messages, AI is no longer a luxury for large enterprises. Here\'s how Indian SMBs use AI to close deals in half the time.',
    author:'Priya Sharma', role:'Head of Product', emoji:'🧠',
    g:'from-indigo-500 to-violet-600',
  },
  {
    cat:'Outreach', catStyle:'bg-green-100 text-green-700',
    date:'May 15, 2025', read:'5 min read',
    title:'WhatsApp for B2B Sales: Why India\'s Top Teams Are Switching',
    excerpt:'WhatsApp has a 95%+ open rate in India vs email\'s 20%. Discover how forward-thinking teams move their follow-up cadences to WhatsApp without spamming prospects.',
    author:'Arjun Mehta', role:'Sales Strategy', emoji:'💬',
    g:'from-green-500 to-emerald-600',
  },
  {
    cat:'Email Sequences', catStyle:'bg-amber-100 text-amber-700',
    date:'May 3, 2025', read:'8 min read',
    title:'How to Build a 3-Step Email Drip That Converts in 2025',
    excerpt:'A well-designed drip sequence converts a cold lead into a warm conversation in under two weeks. We break down exact subject lines, timing, and CTA formulas.',
    author:'Sneha Iyer', role:'Content Lead', emoji:'📧',
    g:'from-amber-500 to-orange-500',
  },
]

function BlogSection() {
  const ref = useReveal()
  return (
    <section id="blog" ref={ref} className="py-24" style={{ background:'linear-gradient(180deg, #f8f7ff 0%, #fafafa 100%)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-14">
          <div>
            <div className="reveal inline-flex items-center gap-2 rounded-full bg-amber-100 border border-amber-200 px-4 py-1.5 text-sm font-semibold text-amber-700 mb-4">
              📚 Blog
            </div>
            <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight">
              Sales Insights & Guides
            </h2>
            <p className="reveal reveal-delay-2 mt-3 text-lg text-gray-500">Practical tips to level up your B2B sales.</p>
          </div>
          <a href="#" className="reveal reveal-delay-3 shrink-0 inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700">
            View all posts
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BLOG_POSTS.map((p, i) => (
            <article key={p.title} className={`reveal reveal-delay-${i + 1} card-hover rounded-3xl overflow-hidden bg-white border border-gray-200/80 shadow-sm flex flex-col`}>
              <div className={`bg-gradient-to-br ${p.g} h-48 flex items-center justify-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/10" />
                <span className="relative text-8xl drop-shadow-lg">{p.emoji}</span>
              </div>
              <div className="p-6 flex-1 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.catStyle}`}>{p.cat}</span>
                  <span className="text-xs text-gray-400">{p.read}</span>
                </div>
                <h3 className="text-base font-extrabold text-gray-900 leading-snug hover:text-indigo-700 transition-colors cursor-pointer">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{p.excerpt}</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                      {p.author[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{p.author}</p>
                      <p className="text-[10px] text-gray-400">{p.role}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{p.date}</span>
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
  { q:"AveonApex cut our SDR's manual work by 70%. The AI scoring immediately tells us which leads to call first — our conversion rate went from 8% to 21% in 90 days.", name:'Ranjith Kumar', title:'VP Sales · TechSpark Solutions', av:'R', g:'from-indigo-500 to-violet-600' },
  { q:"We run campaigns for 15 clients and AveonApex is the only platform that handles multi-tenant outreach this cleanly. WhatsApp integration alone saved us 3 hours a day.", name:'Sneha Agarwal', title:'Founder · GrowthLab Agency', av:'S', g:'from-rose-500 to-pink-500' },
  { q:"Email sequences with AI-written personalisation increased our reply rate from 2% to 11%. I honestly thought those numbers were only for big tech companies.", name:'Arjun Pillai', title:'Head of Growth · Finvesta', av:'A', g:'from-emerald-500 to-teal-500' },
]

function TestimonialsSection() {
  const ref = useReveal()
  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-14">
          <div className="reveal inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-4 py-1.5 text-sm font-semibold text-rose-600 mb-5">
            ❤️ Customer Stories
          </div>
          <h2 className="reveal reveal-delay-1 text-4xl lg:text-5xl font-extrabold text-gray-900">Loved by Sales Teams</h2>
          <p className="reveal reveal-delay-2 mt-3 text-lg text-gray-500">Real results from real teams across India.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t, i) => (
            <blockquote key={t.name}
              className={`reveal reveal-delay-${i + 1} card-hover rounded-3xl bg-white border border-gray-200/80 shadow-sm p-8 flex flex-col gap-5`}>
              {/* Quote mark */}
              <div className="text-4xl font-black text-indigo-200 leading-none -mb-2">"</div>
              {/* Stars */}
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(j => <span key={j} className="text-amber-400 text-base">★</span>)}
              </div>
              <p className="text-gray-700 leading-relaxed text-sm flex-1">{t.q}</p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.g} flex items-center justify-center text-sm font-extrabold text-white shadow-md`}>
                  {t.av}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.title}</p>
                </div>
              </div>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTASection() {
  const ref = useReveal()
  return (
    <section ref={ref} className="py-24" style={{ background:'linear-gradient(180deg, #f0f4ff 0%, #f8f7ff 100%)' }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="reveal rounded-3xl overflow-hidden relative text-center px-8 py-20 hero-gradient noise">
          <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full anim-orb"
            style={{ background:'radial-gradient(circle, rgba(139,92,246,.4) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-1/4 w-60 h-60 rounded-full anim-orb-2"
            style={{ background:'radial-gradient(circle, rgba(99,102,241,.35) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 dot-grid" style={{ zIndex:2 }} />

          <div className="relative" style={{ zIndex:3 }}>
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-indigo-200 mb-6">
              🚀 Free forever plan available
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
              Ready to Close More Deals?
            </h2>
            <p className="text-lg text-slate-200 max-w-xl mx-auto leading-relaxed mb-8">
              Join 500+ sales teams using AveonApex to discover, score, and engage leads — on autopilot. No credit card required.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/register"
                className="glow-btn inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-indigo-900/50">
                Start for Free →
              </Link>
              <Link to="/login"
                className="inline-flex items-center gap-2 rounded-2xl glass px-8 py-4 text-base font-semibold text-white hover:bg-white/15 transition-colors">
                Sign In
              </Link>
            </div>
            <p className="text-xs text-slate-400 mt-6">No credit card · Setup in 5 minutes · Cancel anytime</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
const FOOTER_COLS = {
  Product:   ['Lead Management','AI Scoring','Email Sequences','WhatsApp Outreach','LinkedIn Prospecting','Revenue Pipeline','Reports','Tasks'],
  Solutions: ['SaaS & Technology','Marketing Agencies','SMBs & Startups','Enterprise Sales'],
  Resources: ['Blog','Documentation','API Reference','Changelog','Status Page'],
  Company:   ['About Us','Careers','Privacy Policy','Terms of Service','Contact'],
}

function Footer() {
  return (
    <footer style={{ background:'linear-gradient(180deg, #0f0c29 0%, #0d0a1f 100%)' }}
      className="border-t border-white/8 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="font-bold text-xl text-white">Aveon<span className="text-indigo-400">Apex</span></span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              AI-powered CRM built for B2B sales teams in India. Close deals faster with intelligent automation.
            </p>
            <div className="flex gap-2.5">
              {[
                { label:'Twitter/X', d:'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
                { label:'LinkedIn', d:'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
              ].map(s => (
                <a key={s.label} href="#" aria-label={s.label}
                  className="w-9 h-9 rounded-lg glass flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/15 transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={s.d} /></svg>
                </a>
              ))}
            </div>
          </div>

          {Object.entries(FOOTER_COLS).map(([col, links]) => (
            <div key={col}>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-5">{col}</h4>
              <ul className="space-y-3">
                {links.map(link => (
                  <li key={link}>
                    <a href="#" className="text-sm text-slate-500 hover:text-slate-200 transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-600">© 2025 AveonApex. All rights reserved. Built in India 🇮🇳</p>
          <div className="flex gap-6">
            {['Privacy Policy','Terms of Service','Cookie Policy'].map(l => (
              <a key={l} href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page root ────────────────────────────────────────────────────────────────
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
