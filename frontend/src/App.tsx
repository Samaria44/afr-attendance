import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
  const handleNavigate = (p: string) => { setPage(p as Page); setSidebarOpen(false) }

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
    <div style={{ display: 'flex', minHeight: '100vh', background: T.appBg, position: 'relative' }}>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99, display: 'none' }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar-wrapper${sidebarOpen ? ' sidebar-open' : ''}`}>
        <Sidebar
          activePage={page}
          onNavigate={handleNavigate}
          user={user}
          onLogout={handleLogout}
        />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          background: T.cardBg, borderBottom: `1px solid ${T.border}`,
          padding: '0 20px', height: 54,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Hamburger — shown only on mobile via CSS */}
            <button
              onClick={() => setSidebarOpen(p => !p)}
              className="hamburger-btn"
              style={{ background: 'none', border: 'none', padding: 4, color: T.textSub, display: 'none' }}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div style={{ width: 3, height: 18, background: T.accent, borderRadius: 2 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{PAGE_TITLE[page]}</span>
          </div>
          <div style={{ fontSize: 12, color: T.textDim }} className="topbar-date">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </header>

        <main style={{ flex: 1 }}>
          {PAGE_MAP[page]}
        </main>
      </div>

      {/* Responsive sidebar + hamburger styles */}
      <style>{`
        .sidebar-wrapper {
          flex-shrink: 0;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        @media (max-width: 768px) {
          .sidebar-wrapper {
            position: fixed;
            top: 0;
            left: -225px;
            height: 100vh;
            z-index: 100;
            transition: left 0.25s ease;
          }
          .sidebar-wrapper.sidebar-open {
            left: 0;
          }
          .hamburger-btn { display: flex !important; }
          .mobile-overlay { display: block !important; }
          .topbar-date { display: none; }
        }
      `}</style>
    </div>
  )
}
