import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Bell, PanelLeft, X, ChevronRight, Sparkles, Menu } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAIStore } from '@/store/aiStore'
import { useAuthStore } from '@/store/authStore'
import { cn, getInitials } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ── Breadcrumb ───────────────────────────────────────────────────────────────

const CRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', leads: 'Leads', discover: 'Discover',
  sectors: 'Sectors', campaigns: 'Campaigns', proposals: 'Proposals',
  linkedin: 'LinkedIn', whatsapp: 'WhatsApp', 'email-sequences': 'Sequences',
  pipeline: 'Pipeline', tasks: 'Tasks', reports: 'Reports',
  forms: 'Forms', social: 'Social', ai: 'AI Assistant',
  integrations: 'Integrations', developer: 'Developer',
  billing: 'Billing', settings: 'Settings', admin: 'Admin',
  tenants: 'Tenants', deals: 'Deals',
}

function Breadcrumb() {
  const { pathname } = useLocation()
  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean)
  const crumbs = parts.map((p) => CRUMB_LABELS[p] ?? (p.length === 36 ? '···' : p))
  if (crumbs.length === 0) return null
  return (
    <nav className="hidden md:flex items-center gap-1 text-sm select-none">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
          <span className={cn(
            i === crumbs.length - 1
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground text-xs',
          )}>{c}</span>
        </span>
      ))}
    </nav>
  )
}

// ── TopBar ───────────────────────────────────────────────────────────────────

export default function TopBar() {
  const navigate             = useNavigate()
  const toggleSidebar        = useUIStore((s) => s.toggleSidebar)
  const toggleMobileSidebar  = useUIStore((s) => s.toggleMobileSidebar)
  const globalSearch         = useUIStore((s) => s.globalSearch)
  const setGlobalSearch      = useUIStore((s) => s.setGlobalSearch)
  const openChat             = useAIStore((s) => s.openChat)
  const user                 = useAuthStore((s) => s.user)
  const logout               = useAuthStore((s) => s.logout)
  const [searchFocused, setSearchFocused] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (globalSearch.trim())
      navigate(`/leads?search=${encodeURIComponent(globalSearch.trim())}`)
  }

  return (
    <>
    <header className="h-14 shrink-0 flex items-center justify-between px-3 md:px-5 sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-border/60">

      {/* Left */}
      <div className="flex items-center gap-2">
        {/* Mobile hamburger — visible only on mobile */}
        <button onClick={toggleMobileSidebar}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all lg:hidden"
          aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </button>
        {/* Desktop sidebar toggle — visible only on desktop */}
        <button onClick={toggleSidebar}
          className="h-8 w-8 hidden lg:flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          aria-label="Toggle sidebar">
          <PanelLeft className="h-4 w-4" />
        </button>
        <Breadcrumb />
      </div>

      {/* Center: search — hidden on mobile (has separate mobile search below) */}
      <form onSubmit={handleSearchSubmit}
        className={cn(
          'relative mx-4 hidden sm:flex flex-1 max-w-sm transition-all duration-200',
          searchFocused && 'max-w-md',
        )}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
        <input
          type="text"
          placeholder="Search leads, companies..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className={cn(
            'w-full h-9 rounded-xl border border-border/60 bg-muted/40 pl-9 pr-9 text-sm placeholder:text-muted-foreground/50 transition-all',
            'focus:outline-none focus:bg-white focus:border-primary/40 focus:shadow-[0_0_0_3px_hsl(var(--ring)/0.10)]',
          )}
        />
        {globalSearch && (
          <button type="button" onClick={() => setGlobalSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Mobile search toggle */}
        <button
          onClick={() => setMobileSearchOpen((v) => !v)}
          className="h-8 w-8 flex sm:hidden items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          aria-label="Search">
          <Search className="h-4 w-4" />
        </button>

        {/* AI Chat — animated gradient */}
        <button onClick={openChat}
          className="ai-btn-gradient hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold text-white shadow-md shadow-violet-500/20 hover:shadow-violet-500/35 hover:-translate-y-px transition-all">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden md:inline">AI Chat</span>
          <span className="md:hidden sr-only">AI</span>
        </button>

        {/* Notifications */}
        <button className="relative h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 border border-white" />
          <span className="bell-ping absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-400" />
        </button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted transition-all group">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shadow"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
                {user ? getInitials(user.full_name) : 'U'}
              </div>
              <span className="hidden lg:block text-sm font-medium text-foreground max-w-[110px] truncate">
                {user?.full_name}
              </span>
              <ChevronRight className="hidden lg:block h-3 w-3 text-muted-foreground/50 rotate-90 transition-colors group-hover:text-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60 rounded-2xl shadow-xl border-border/50 p-1.5">
            {user && (
              <>
                <DropdownMenuLabel className="px-3 py-2.5 cursor-default">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
                      {getInitials(user.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1.5" />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-xl cursor-pointer text-sm">
              👤 Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-xl cursor-pointer text-sm">
              ⚙️ Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/billing')} className="rounded-xl cursor-pointer text-sm">
              💳 Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem onClick={logout}
              className="rounded-xl cursor-pointer text-sm text-rose-600 focus:text-rose-600 focus:bg-rose-50">
              🚪 Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* Mobile search bar — slides down when toggled */}
    {mobileSearchOpen && (
      <div className="sm:hidden bg-white/95 backdrop-blur-xl border-b border-border/60 px-3 py-2 z-20">
        <form onSubmit={(e) => { handleSearchSubmit(e); setMobileSearchOpen(false) }} className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            placeholder="Search leads, companies, contacts..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            autoFocus
            className="w-full h-9 rounded-xl border border-border/60 bg-muted/40 pl-9 pr-9 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
          />
          <button type="button" onClick={() => { setGlobalSearch(''); setMobileSearchOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    )}
    </>
  )
}
