import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'
import LeadDetailPage from './pages/LeadDetailPage'
import SectorsPage from './pages/SectorsPage'
import CampaignsPage from './pages/CampaignsPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import PipelinePage from './pages/PipelinePage'
import AIAssistantPage from './pages/AIAssistantPage'
import IntegrationsPage from './pages/IntegrationsPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="sectors" element={<SectorsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          {/*
            Canonical AI Assistant route is /ai — the Sidebar, TopBar breadcrumb
            lookup, and the URL users have already bookmarked all point here.
            `ai-assistant` is kept as a legacy alias so anything older still
            resolves to the right page instead of white-screening.
          */}
          <Route path="ai" element={<AIAssistantPage />} />
          <Route path="ai-assistant" element={<Navigate to="/ai" replace />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/*
            Catch-all fallback: any unknown nested URL redirects to the
            dashboard instead of rendering an empty <Outlet /> (which used to
            white-screen silently). This is our last line of defense against
            route-path typos like the /ai vs /ai-assistant mismatch that
            originally broke the AI Assistant page.
          */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        {/* Top-level catch-all for unauthenticated URLs */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
