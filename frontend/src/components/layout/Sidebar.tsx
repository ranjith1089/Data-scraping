import { NavLink } from 'react-router-dom'
import {
  Zap,
  LayoutDashboard,
  Users,
  Grid3X3,
  Send,
  GitBranch,
  Bot,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { cn, getInitials } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/sectors', icon: Grid3X3, label: 'Sectors' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/pipeline', icon: GitBranch, label: 'Pipeline' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/settings', icon: Settings, label: 'Settings' },
] as const

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 flex-shrink-0 items-center border-b border-slate-700/50',
          collapsed ? 'justify-center px-2' : 'gap-3 px-5'
        )}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-white tracking-tight">
            LeadForge <span className="text-indigo-400">AI</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm border-l-2 border-indigo-400'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border-l-2 border-transparent'
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-slate-700/50 p-3">
        {user && (
          <div
            className={cn(
              'mb-2 flex items-center rounded-lg px-3 py-2',
              collapsed ? 'justify-center' : 'gap-3'
            )}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {getInitials(user.full_name)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user.full_name}
                </p>
                <p className="truncate text-xs text-slate-400">{user.role}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={logout}
                className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex w-full items-center rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300',
            collapsed ? 'justify-center' : 'gap-3'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronsLeft className="h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
