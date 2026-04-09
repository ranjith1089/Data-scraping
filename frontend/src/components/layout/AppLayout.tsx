import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AIChatPanel from '../ai/AIChatPanel'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

export default function AppLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div
        className={cn(
          'flex flex-1 flex-col min-w-0 transition-[margin] duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64',
        )}
      >
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <AIChatPanel />
    </div>
  )
}
