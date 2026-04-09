import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Bot, PanelLeft, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAIStore } from '@/store/aiStore'
import { useAuthStore } from '@/store/authStore'
import { cn, getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function TopBar() {
  const navigate = useNavigate()
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const globalSearch = useUIStore((s) => s.globalSearch)
  const setGlobalSearch = useUIStore((s) => s.setGlobalSearch)
  const openChat = useAIStore((s) => s.openChat)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [searchFocused, setSearchFocused] = useState(false)

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (globalSearch.trim()) {
      navigate(`/leads?search=${encodeURIComponent(globalSearch.trim())}`)
    }
  }

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-border bg-card">
      {/* Left: Sidebar toggle */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Search */}
      <form
        onSubmit={handleSearchSubmit}
        className={cn(
          'relative mx-6 hidden max-w-md flex-1 md:block transition-all',
          searchFocused && 'max-w-lg',
        )}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search leads, companies, contacts..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {globalSearch && (
          <button
            type="button"
            onClick={() => setGlobalSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openChat}
          className="gap-2"
        >
          <Bot className="h-4 w-4 text-primary" />
          <span className="hidden lg:inline">AI Chat</span>
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {user ? getInitials(user.full_name) : 'U'}
              </div>
              {user && (
                <span className="hidden text-sm font-medium text-foreground lg:inline">
                  {user.full_name}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user && (
              <>
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium">{user.full_name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
