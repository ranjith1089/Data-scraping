import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  Search,
  Bell,
  Bot,
  ChevronRight,
  User,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAIStore } from '@/store/aiStore'
import { useAuthStore } from '@/store/authStore'
import { cn, getInitials } from '@/lib/utils'

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/leads': 'Leads',
  '/sectors': 'Sectors',
  '/campaigns': 'Campaigns',
  '/pipeline': 'Sales Pipeline',
  '/ai': 'AI Assistant',
  '/settings': 'Settings',
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [
    { label: 'Home', path: '/' },
  ]

  if (segments.length === 0) return crumbs

  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    const title = ROUTE_TITLES[currentPath]
    if (title) {
      crumbs.push({ label: title, path: currentPath })
    } else {
      // For dynamic segments like /leads/:id
      const parentPath = `/${segments[0]}`
      if (!crumbs.find((c) => c.path === parentPath)) {
        const parentTitle = ROUTE_TITLES[parentPath]
        if (parentTitle) crumbs.push({ label: parentTitle, path: parentPath })
      }
      crumbs.push({ label: 'Detail', path: currentPath })
    }
  }

  return crumbs
}

function getPageTitle(pathname: string): string {
  // Check exact matches first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]

  // Check parent route for dynamic segments
  const parentPath = '/' + pathname.split('/').filter(Boolean)[0]
  if (ROUTE_TITLES[parentPath]) {
    return ROUTE_TITLES[parentPath]
  }

  return 'LeadForge AI'
}

export default function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const globalSearch = useUIStore((s) => s.globalSearch)
  const setGlobalSearch = useUIStore((s) => s.setGlobalSearch)
  const openChat = useAIStore((s) => s.openChat)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [searchFocused, setSearchFocused] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const pageTitle = getPageTitle(location.pathname)
  const breadcrumbs = getBreadcrumbs(location.pathname)

  // Close dropdowns on click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (globalSearch.trim()) {
      navigate(`/leads?search=${encodeURIComponent(globalSearch.trim())}`)
    }
  }

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Left: Title + breadcrumbs */}
      <div className="min-w-0">
        {breadcrumbs.length > 1 && (
          <nav className="mb-0.5 flex items-center gap-1 text-xs text-gray-400">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {i < breadcrumbs.length - 1 ? (
                  <Link
                    to={crumb.path}
                    className="hover:text-gray-600 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-500">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-lg font-semibold text-gray-900 truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Center: Search */}
      <form
        onSubmit={handleSearchSubmit}
        className={cn(
          'relative mx-6 hidden max-w-md flex-1 md:block transition-all',
          searchFocused && 'max-w-lg'
        )}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search leads, companies, contacts..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className={cn(
            'w-full rounded-lg border bg-gray-50 py-2 pl-10 pr-10 text-sm',
            'placeholder:text-gray-400 transition-all duration-200',
            'focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100',
            !searchFocused && 'border-transparent'
          )}
        />
        {globalSearch && (
          <button
            type="button"
            onClick={() => setGlobalSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* AI Chat trigger */}
        <button
          onClick={openChat}
          className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
        >
          <Bot className="h-4 w-4" />
          <span className="hidden lg:inline">AI Chat</span>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Notifications
                </h3>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                <div className="rounded-lg px-3 py-2.5 hover:bg-gray-50">
                  <p className="text-sm text-gray-700">
                    3 leads scored above 80 today
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">2 minutes ago</p>
                </div>
                <div className="rounded-lg px-3 py-2.5 hover:bg-gray-50">
                  <p className="text-sm text-gray-700">
                    Campaign "Q1 Outreach" completed
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">1 hour ago</p>
                </div>
                <div className="rounded-lg px-3 py-2.5 hover:bg-gray-50">
                  <p className="text-sm text-gray-700">
                    New lead imported from CSV
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">3 hours ago</p>
                </div>
              </div>
              <div className="border-t border-gray-100 p-2">
                <button className="w-full rounded-lg px-3 py-2 text-center text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {user ? getInitials(user.full_name) : 'U'}
            </div>
            {user && (
              <span className="hidden text-sm font-medium text-gray-700 lg:inline">
                {user.full_name}
              </span>
            )}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              {user && (
                <div className="border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              )}
              <Link
                to="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <Link
                to="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => {
                  logout()
                  setUserMenuOpen(false)
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
