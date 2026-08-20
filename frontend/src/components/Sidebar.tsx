import {
  LayoutDashboard, ScanFace, Users, BarChart3,
  ShieldCheck, Settings, LogOut, Fingerprint,
} from 'lucide-react';
import type { AuthUser } from '../auth';
import { can } from '../permissions';
import { T } from '../theme';

type Page = 'dashboard' | 'recognition' | 'employees' | 'reports' | 'users' | 'settings';

interface Props {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user: AuthUser;
  onLogout: () => void;
}

const NAV: { page: Page; label: string; icon: React.ReactNode; permission?: string }[] = [
  { page: 'dashboard',   label: 'Dashboard',        icon: <LayoutDashboard size={16} /> },
  { page: 'recognition', label: 'Live Recognition',  icon: <ScanFace size={16} /> },
  { page: 'employees',   label: 'Employees',         icon: <Users size={16} /> },
  { page: 'reports',     label: 'Attendance',        icon: <BarChart3 size={16} /> },
  { page: 'users',       label: 'User Management',   icon: <ShieldCheck size={16} />, permission: 'auth:view_users' },
  { page: 'settings',    label: 'Settings',          icon: <Settings size={16} /> },
];

const ROLE_COLOR: Record<string, string> = {
  admin: '#f9a8d4', operator: '#86efac', viewer: '#94a3b8',
};

export default function Sidebar({ activePage, onNavigate, user, onLogout }: Props) {
  const initials = user.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside style={{
      width: 225, minHeight: '100vh',
      background: T.sidebarBg,
      borderRight: `1px solid ${T.sidebarBorder}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 20px 16px', borderBottom: `1px solid ${T.sidebarBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${T.accent}33`,
            border: `1px solid ${T.accent}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Fingerprint size={18} color={T.accentMid} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.sidebarText }}>AFR System</div>
            <div style={{ fontSize: 10, color: T.sidebarDim, letterSpacing: 1, textTransform: 'uppercase' }}>Attendance</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.sidebarDim, letterSpacing: 1.5, textTransform: 'uppercase', padding: '0 10px 10px' }}>
          Main Menu
        </div>
        {NAV.map(item => {
          if (item.permission && !can(user, item.permission)) return null;
          const active = activePage === item.page;
          return (
            <button key={item.page} onClick={() => onNavigate(item.page)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? T.accent : 'transparent',
                color: active ? '#fff' : T.sidebarSub,
                fontSize: 13, fontWeight: active ? 600 : 400,
                textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = T.sidebarHover; (e.currentTarget as HTMLButtonElement).style.color = T.sidebarText; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = T.sidebarSub; } }}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${T.sidebarBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: T.sidebarHover }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: `${T.accent}44`,
            border: `1px solid ${T.accent}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: ROLE_COLOR[user.role] ?? '#fff',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.sidebarText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.full_name}</div>
            <div style={{ fontSize: 10, color: ROLE_COLOR[user.role] ?? T.sidebarSub, textTransform: 'capitalize' }}>{user.role}</div>
          </div>
          <button onClick={onLogout} title="Logout"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.sidebarDim, padding: 2, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#ff6b6b'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = T.sidebarDim}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
