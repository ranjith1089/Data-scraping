import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Megaphone, Target, Briefcase,
  Settings, Bot, Plug, ShieldCheck, LogOut, FileText,
  Code2, CreditCard, Instagram, FileSignature, Compass,
  Linkedin, MessageCircle, Mail, BarChart2, CheckSquare,
  ChevronDown, Sparkles,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color?: string   // tailwind text-* for the icon accent
  badge?: string
}

// ── Nav items with per-icon accent colors ────────────────────────────────────

const mainNav: NavItem[] = [
  { title: 'Dashboard',  href: '/dashboard',       icon: LayoutDashboard, color: 'text-sky-400' },
  { title: 'Leads',      href: '/leads',            icon: Users,           color: 'text-indigo-400' },
  { title: 'Discover',   href: '/discover',         icon: Compass,         color: 'text-violet-400' },
  { title: 'Sectors',    href: '/sectors',          icon: Briefcase,       color: 'text-amber-400' },
  { title: 'Campaigns',  href: '/campaigns',        icon: Megaphone,       color: 'text-rose-400' },
  { title: 'Proposals',  href: '/proposals',        icon: FileSignature,   color: 'text-teal-400' },
  { title: 'LinkedIn',   href: '/linkedin',         icon: Linkedin,        color: 'text-blue-400' },
  { title: 'WhatsApp',   href: '/whatsapp',         icon: MessageCircle,   color: 'text-green-400' },
  { title: 'Sequences',  href: '/email-sequences',  icon: Mail,            color: 'text-purple-400' },
  { title: 'Pipeline',   href: '/pipeline',         icon: Target,          color: 'text-orange-400' },
  { title: 'Tasks',      href: '/tasks',            icon: CheckSquare,     color: 'text-emerald-400' },
  { title: 'Reports',    href: '/reports',          icon: BarChart2,       color: 'text-cyan-400' },
  { title: 'Forms',      href: '/forms',            icon: FileText,        color: 'text-slate-400' },
  { title: 'Social',     href: '/social',           icon: Instagram,       color: 'text-pink-400' },
]

const footerNav: NavItem[] = [
  { title: 'AI Assistant', href: '/ai', icon: Bot, color: 'text-violet-300' },
]

const settingsChildren: NavItem[] = [
  { title: 'Integrations', href: '/integrations', icon: Plug,       color: 'text-slate-400' },
  { title: 'Developer',    href: '/developer',    icon: Code2,      color: 'text-slate-400' },
  { title: 'Billing',      href: '/billing',      icon: CreditCard, color: 'text-slate-400' },
]

const SETTINGS_PATHS = ['/settings', ...settingsChildren.map((s) => s.href)]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const collapsed          = useUIStore((s) => s.sidebarCollapsed)
  const mobileSidebarOpen  = useUIStore((s) => s.mobileSidebarOpen)
  const closeMobileSidebar = useUIStore((s) => s.closeMobileSidebar)
  const user               = useAuthStore((s) => s.user)
  const logout             = useAuthStore((s) => s.logout)
  const { pathname }       = useLocation()

  const [settingsOpen, setSettingsOpen] = useState(() =>
    SETTINGS_PATHS.some((p) => pathname.startsWith(p))
  )

  // On mobile, always show expanded content (width is always w-64 when open)
  // On desktop, respect the collapsed state
  const showExpanded = !collapsed || mobileSidebarOpen

  // Close mobile sidebar on navigation
  useEffect(() => {
    closeMobileSidebar()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile backdrop overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col shadow-xl',
          'transition-[width,transform] duration-300',
          // Mobile: slide in/out; Desktop: always visible
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Width: always w-64 on mobile (when visible), desktop respects collapsed state
          'w-64',
          collapsed ? 'lg:w-16' : 'lg:w-64',
        )}
        style={{
          background: 'linear-gradient(180deg, hsl(230,38%,11%) 0%, hsl(228,32%,9%) 100%)',
          borderRight: '1px solid hsl(230,25%,17%)',
        }}
      >
        {/* ── Brand logo ───────────────────────────────────────────────────── */}
        <div className={cn(
          'flex h-16 items-center shrink-0 border-b border-white/8',
          showExpanded ? 'px-4 gap-3' : 'justify-center px-0',
        )}>
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <Sparkles className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
              style={{ borderColor: 'hsl(230,38%,11%)' }} />
          </div>
          {showExpanded && (
            <div>
              <p className="font-extrabold text-[15px] tracking-tight leading-none">
                <span className="text-white">Aveon</span>
                <span className="text-indigo-400">Apex</span>
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5 tracking-wide">AI Sales CRM</p>
            </div>
          )}
        </div>

        {/* ── Main nav ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 py-3 space-y-0.5">
          {showExpanded && (
            <p className="px-3 mb-2 text-[9px] font-black tracking-[0.18em] text-slate-600 uppercase">
              Navigation
            </p>
          )}
          {mainNav.map((item) => (
            <SidebarLink key={item.href} item={item} collapsed={!showExpanded} />
          ))}

          {/* Superuser section */}
          {user?.is_superuser && (
            <div className="mt-4 pt-3 border-t border-white/8">
              {showExpanded && (
                <p className="px-3 mb-2 text-[9px] font-black tracking-[0.18em] text-slate-600 uppercase">
                  Admin
                </p>
              )}
              <SidebarLink
                item={{ title: 'Tenants', href: '/admin/tenants', icon: ShieldCheck, color: 'text-amber-400' }}
                collapsed={!showExpanded}
              />
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/8 px-2 py-2 space-y-0.5">
          {/* AI Assistant — highlighted */}
          {footerNav.map((item) => (
            <SidebarLink key={item.href} item={item} collapsed={!showExpanded} highlight />
          ))}

          {/* Settings group */}
          <SettingsGroup
            collapsed={!showExpanded}
            open={settingsOpen}
            onToggle={() => setSettingsOpen((o) => !o)}
            children={settingsChildren}
          />

          {/* User card */}
          {user && (
            <div className={cn(
              'mt-2 border-t border-white/8 pt-2 flex items-center rounded-xl px-2 py-2',
              'transition-colors hover:bg-white/5 cursor-default',
              showExpanded ? 'gap-2.5' : 'justify-center',
            )}>
              <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
                {getInitials(user.full_name)}
              </div>
              {showExpanded && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-200 leading-tight">{user.full_name}</p>
                    <p className="truncate text-[10px] text-slate-500 capitalize leading-tight mt-0.5">{user.role}</p>
                  </div>
                  <button onClick={logout} title="Sign out"
                    className="ml-auto p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

// ── Settings expandable group ─────────────────────────────────────────────────

function SettingsGroup({
  collapsed, open, onToggle, children,
}: {
  collapsed: boolean; open: boolean; onToggle: () => void; children: NavItem[]
}) {
  const { pathname } = useLocation()
  const isActive = SETTINGS_PATHS.some((p) => pathname.startsWith(p))

  if (collapsed) {
    return (
      <>
        <SidebarLink item={{ title: 'Settings', href: '/settings', icon: Settings, color: 'text-slate-400' }} collapsed />
        {children.map((item) => <SidebarLink key={item.href} item={item} collapsed />)}
      </>
    )
  }

  return (
    <li className="list-none">
      <div className="flex items-center">
        <NavLink to="/settings"
          className={({ isActive: la }) => cn(
            'flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all',
            (la || isActive)
              ? 'nav-active-pill text-slate-100'
              : 'text-slate-400 hover:bg-white/6 hover:text-slate-200',
          )}>
          <Settings className={cn('h-4 w-4 shrink-0', (isActive) ? 'text-indigo-400' : 'text-slate-500')} />
          <span className="truncate">Settings</span>
        </NavLink>
        <button onClick={onToggle}
          className="ml-1 p-1.5 rounded-md text-slate-600 hover:bg-white/6 hover:text-slate-300 transition-colors"
          aria-label={open ? 'Collapse' : 'Expand'}>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <ul className="mt-0.5 pl-4 space-y-0.5">
          {children.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <NavLink to={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all',
                    active
                      ? 'bg-white/8 text-slate-100'
                      : 'text-slate-500 hover:bg-white/5 hover:text-slate-300',
                  )}>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{item.title}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

// ── Generic sidebar link ──────────────────────────────────────────────────────

function SidebarLink({
  item, collapsed, highlight,
}: {
  item: NavItem; collapsed: boolean; highlight?: boolean
}) {
  const Icon = item.icon

  const linkEl = (
    <NavLink
      to={item.href}
      className={({ isActive }) => cn(
        'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
        collapsed && 'justify-center px-0 w-full',
        highlight && 'bg-indigo-500/10 border border-indigo-500/20',
        isActive
          ? highlight
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
            : 'nav-active-pill text-slate-100'
          : highlight
            ? 'text-indigo-300 hover:bg-indigo-500/15 hover:text-indigo-200'
            : 'text-slate-400 hover:bg-white/6 hover:text-slate-200',
      )}
    >
      <Icon className={cn(
        'shrink-0 transition-colors',
        collapsed ? 'h-5 w-5' : 'h-4 w-4',
        item.color ?? 'text-slate-500',
        'group-[.active]:opacity-100',
      )} />
      {!collapsed && <span className="truncate leading-none">{item.title}</span>}
      {!collapsed && item.badge && (
        <span className="ml-auto shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
          {item.badge}
        </span>
      )}
    </NavLink>
  )

  if (!collapsed) return <li className="list-none">{linkEl}</li>

  return (
    <li className="list-none">
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">{item.title}</TooltipContent>
      </Tooltip>
    </li>
  )
}
