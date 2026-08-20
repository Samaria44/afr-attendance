import { useEffect, useState } from 'react';
import { ScanFace, CalendarDays, Clock3, Wifi, LogOut, User, Shield } from 'lucide-react';
import type { AuthUser } from '../auth';

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#fff', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 32px',
      height: 64, boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>

      {/* Left — Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.45)',
          borderRadius: 10, width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ScanFace size={22} color="#a78bfa" strokeWidth={1.8} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.4, lineHeight: 1.3 }}>
            AFR – Face Recognition Module
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>
            Automated Attendance System
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <CalendarDays size={15} color="#94a3b8" strokeWidth={1.8} />
          <span style={{ fontSize: 13, color: '#cbd5e1' }}>{dateStr}</span>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Clock3 size={15} color="#94a3b8" strokeWidth={1.8} />
          <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {timeStr}
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        {/* Online badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)',
          borderRadius: 20, padding: '5px 12px',
        }}>
          <Wifi size={13} color="#4ade80" strokeWidth={2} />
          <span style={{ fontSize: 11, color: '#86efac', fontWeight: 600 }}>Online</span>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: 8, padding: 6, display: 'flex',
          }}>
            {user.role === 'admin'
              ? <Shield size={14} color="#a78bfa" />
              : <User    size={14} color="#a78bfa" />}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>
              {user.full_name}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'capitalize' }}>
              {user.role}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button onClick={onLogout} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '7px 12px', color: '#fca5a5',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          <LogOut size={13} /> Logout
        </button>

      </div>
    </header>
  );
}
