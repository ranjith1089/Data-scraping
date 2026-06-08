import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Target,
  Briefcase,
  Settings,
  Bot,
  Plug,
  ShieldCheck,
  LogOut,
  FileText,
  Code2,
  CreditCard,
  Instagram,
  FileSignature,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

// Reference sidebar nav — matches the Replit reference design 1:1.
const mainNav: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Leads', href: '/leads', icon: Users },
  { title: 'Sectors', href: '/sectors', icon: Briefcase },
  { title: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { title: 'Proposals', href: '/proposals', icon: FileSignature },
  { title: 'Pipeline', href: '/pipeline', icon: Target },
  { title: 'Forms', href: '/forms', icon: FileText },
  { title: 'Social', href: '/social', icon: Instagram },
  { title: 'Integrations', href: '/integrations', icon: Plug },
  { title: 'Developer', href: '/developer', icon: Code2 },
]

const footerNav: NavItem[] = [
  { title: 'AI Assistant', href: '/ai', icon: Bot },
  { title: 'Billing', href: '/billing', icon: CreditCard },
  { title: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-[width] duration-300',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Header / Logo */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-sidebar-border/50',
            collapsed ? 'justify-center px-2' : 'justify-start px-4',
          )}
        >
          <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <div className="bg-primary/20 p-1.5 rounded-md shrink-0">
              <Target className="w-5 h-5 text-primary" />
            </div>
            {!collapsed && (
              <span className="truncate">
                AveonApex<span className="text-sidebar-foreground">AI</span>
              </span>
            )}
          </div>
        </div>

        {/* Main nav */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <ul className="space-y-1">
            {mainNav.map((item) => (
              <SidebarLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </ul>

          {/* Platform-admin section — only rendered for super-admins.
              Gated on ``user.is_superuser`` which is populated from the
              /auth/me response after login. */}
          {user?.is_superuser && (
            <div className="mt-6 border-t border-sidebar-border/50 pt-4">
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Platform admin
                </p>
              )}
              <ul className="space-y-1">
                <SidebarLink
                  item={{
                    title: 'Tenants',
                    href: '/admin/tenants',
                    icon: ShieldCheck,
                  }}
                  collapsed={collapsed}
                />
              </ul>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="border-t border-sidebar-border/50 p-3">
          <ul className="space-y-1">
            {footerNav.map((item) => (
              <SidebarLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </ul>

          {user && (
            <div className="mt-3 border-t border-sidebar-border/50 pt-3">
              <div
                className={cn(
                  'flex items-center rounded-md px-2 py-1.5',
                  collapsed ? 'justify-center' : 'gap-2',
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {getInitials(user.full_name)}
                </div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-sidebar-foreground">
                        {user.full_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground capitalize">
                        {user.role}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={logout}
                      className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      title="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

function SidebarLink({
  item,
  collapsed,
}: {
  item: NavItem
  collapsed: boolean
}) {
  const Icon = item.icon

  const link = (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-2',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </NavLink>
  )

  if (!collapsed) return <li>{link}</li>

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    </li>
  )
}
