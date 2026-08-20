import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import LoginPage from './components/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LiveRecognitionPage from './pages/LiveRecognitionPage'
import EmployeesPage from './pages/EmployeesPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import { getToken, clearAuth, type AuthUser } from './auth'
import { T } from './theme'

type Page = 'dashboard' | 'recognition' | 'employees' | 'reports' | 'users' | 'settings'

const PAGE_TITLE: Record<Page, string> = {
  dashboard:   'Dashboard',
  recognition: 'Live Recognition',
  employees:   'Employees',
  reports:     'Attendance Report',
  users:       'User Management',
  settings:    'Settings',
}

const BACKEND = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function App() {
  const [user, setUser]             = useState<AuthUser | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [checking, setChecking]     = useState(true)
  const [page, setPage]             = useState<Page>('dashboard')

  useEffect(() => {
    const token = getToken()
    Promise.all([
      token
        ? fetch(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
      fetch(`${BACKEND}/api/auth/status`)
        .then(r => r.ok ? r.json() : { has_users: true }).catch(() => ({ has_users: true })),
    ]).then(([meData, statusData]) => {
      if (meData) setUser(meData)
      else { clearAuth(); setNeedsSetup(!statusData.has_users) }
    }).finally(() => setChecking(false))
  }, [])

  const handleLogin  = (u: AuthUser) => { setUser(u); setNeedsSetup(false) }
  const handleLogout = () => { clearAuth(); setUser(null) }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: T.appBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${T.border2}`, borderTop: `3px solid ${T.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 12, color: T.textDim }}>Loading...</span>
      </div>
    )
  }

  if (!user) return <LoginPage onLogin={handleLogin} needsSetup={needsSetup} />

  const PAGE_MAP: Record<Page, React.ReactNode> = {
    dashboard:   <DashboardPage />,
    recognition: <LiveRecognitionPage />,
    employees:   <EmployeesPage />,
    reports:     <ReportsPage />,
    users:       <UsersPage />,
    settings:    <SettingsPage />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.appBg }}>
      <Sidebar activePage={page} onNavigate={setPage as (p: string) => void} user={user} onLogout={handleLogout} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          background: T.cardBg, borderBottom: `1px solid ${T.border}`,
          padding: '0 28px', height: 54,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 3, height: 18, background: T.accent, borderRadius: 2 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{PAGE_TITLE[page]}</span>
          </div>
          <div style={{ fontSize: 12, color: T.textDim }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </header>

        <main style={{ flex: 1 }}>
          {PAGE_MAP[page]}
        </main>
      </div>
    </div>
  )
}
