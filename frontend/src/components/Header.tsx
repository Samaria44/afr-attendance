import { useEffect, useState } from 'react';
import { ScanFace, CalendarDays, Clock3, Wifi } from 'lucide-react';

export default function Header() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <header style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      height: 64,
      boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>

      {/* Left — Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          background: 'rgba(124,58,237,0.25)',
          border: '1px solid rgba(124,58,237,0.45)',
          borderRadius: 10,
          width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ScanFace size={22} color="#a78bfa" strokeWidth={1.8} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.4, lineHeight: 1.3 }}>
            AFR – Face Recognition Module
          </div>
          <div style={{
            fontSize: 10, color: '#94a3b8',
            letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1,
          }}>
            Automated Attendance System
          </div>
        </div>
      </div>

      {/* Right — Date / Time / Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>

        {/* Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <CalendarDays size={15} color="#94a3b8" strokeWidth={1.8} />
          <span style={{ fontSize: 13, color: '#cbd5e1' }}>{dateStr}</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Clock3 size={15} color="#94a3b8" strokeWidth={1.8} />
          <span style={{
            fontSize: 13, color: '#e2e8f0', fontWeight: 600,
            fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5,
          }}>
            {timeStr}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        {/* Online badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.28)',
          borderRadius: 20, padding: '5px 14px',
        }}>
          <Wifi size={13} color="#4ade80" strokeWidth={2} />
          <span style={{ fontSize: 11, color: '#86efac', fontWeight: 600 }}>System Online</span>
        </div>

      </div>
    </header>
  );
}
