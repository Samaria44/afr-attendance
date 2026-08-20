import { useEffect, useState } from 'react';
import { Users, CheckCircle2, XCircle, Activity, RefreshCw, TrendingUp, Clock, UserCheck } from 'lucide-react';
import { fetchLog, fetchEmployees } from '../api';
import { T } from '../theme';
import { getUser } from '../auth';

interface LogEntry {
  employee_id: string; name: string; department: string;
  time: string; status: 'Matched' | 'Unknown'; similarity: number;
}

export default function DashboardPage() {
  const user = getUser();
  const [employees, setEmployees] = useState<unknown[]>([]);
  const [log, setLog]             = useState<LogEntry[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [e, l] = await Promise.all([fetchEmployees(), fetchLog(100)]);
      setEmployees(e.employees ?? []);
      setLog(l.log ?? []);
    } catch { /**/ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const matched   = log.filter(e => e.status === 'Matched').length;
  const unknown   = log.filter(e => e.status === 'Unknown').length;
  const matchRate = log.length ? Math.round((matched / log.length) * 100) : 0;

  const stats = [
    { label: 'Total Employees', value: employees.length, sub: 'Registered',    icon: <Users size={20} />,    color: T.accent,  light: T.accentLight },
    { label: 'Recognitions',    value: log.length,        sub: 'All time',      icon: <Activity size={20} />, color: T.blue,    light: T.blueLight   },
    { label: 'Matched',         value: matched,           sub: `${matchRate}% match rate`, icon: <UserCheck size={20} />, color: T.green, light: T.greenLight },
    { label: 'Unknown',         value: unknown,           sub: 'Unidentified',  icon: <XCircle size={20} />,  color: T.red,     light: T.redLight    },
  ];

  return (
    <div className="fade-in" style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 3 }}>
            Welcome back, {user?.full_name.split(' ')[0]}
          </h1>
          <p style={{ fontSize: 13, color: T.textSub }}>Here's an overview of today's attendance.</p>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          borderRadius: 8, border: `1px solid ${T.border2}`, background: T.cardBg,
          fontSize: 12, fontWeight: 600, color: T.textSub, cursor: 'pointer',
          boxShadow: T.shadow,
        }}>
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`,
            padding: '18px 20px', boxShadow: T.shadow,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ background: s.light, borderRadius: 10, padding: 10, color: s.color, display: 'flex', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.text, lineHeight: 1 }}>
                {loading ? <Skel w={40} h={24} /> : s.value}
              </div>
              <div style={{ fontSize: 11, color: T.textSub, marginTop: 3 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: s.color, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <TrendingUp size={9} /> {s.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* Recent log table */}
        <div style={{ background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`, boxShadow: T.shadow, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Recent Check-ins</h2>
            <span style={{ fontSize: 11, color: T.textDim }}>Last {Math.min(log.length, 8)}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.cardBg2 }}>
                {['Employee', 'Department', 'Time', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 16px', fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1,2,3,4,5].map(i => (
                <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                  {[140,100,70,70].map((w,j) => <td key={j} style={{ padding: '11px 16px' }}><Skel w={w} h={11} /></td>)}
                </tr>
              ))}
              {!loading && log.slice(0,8).map((e, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.border}`, transition: 'background 0.12s' }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLTableRowElement).style.background = T.hover}
                  onMouseLeave={ev => (ev.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.accentLight, border: `1px solid ${T.accentMid}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                        {e.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{e.name}</div>
                        <div style={{ fontSize: 10, color: T.textDim }}>{e.employee_id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: T.textSub, fontSize: 11 }}>{e.department}</td>
                  <td style={{ padding: '10px 16px', color: T.textDim, fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={9} /> {e.time}</div>
                  </td>
                  <td style={{ padding: '10px 16px' }}><StatusBadge status={e.status} /></td>
                </tr>
              ))}
              {!loading && log.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: T.textDim }}>No recognition events yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Donut */}
          <div style={{ background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`, padding: '18px', boxShadow: T.shadow, flex: 1 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>Recognition Rate</h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <Donut matched={matched} total={log.length} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <LegRow color={T.green} label="Matched" val={matched} total={log.length} />
              <LegRow color={T.red}   label="Unknown" val={unknown} total={log.length} />
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`, padding: '16px 18px', boxShadow: T.shadow }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Quick Stats</h3>
            {[
              { label: 'Total Employees', value: employees.length, color: T.accent },
              { label: 'Total Events',    value: log.length,        color: T.blue   },
              { label: 'Match Rate',      value: `${matchRate}%`,   color: T.green  },
            ].map(q => (
              <div key={q.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.textSub }}>{q.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: q.color }}>{loading ? '—' : q.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'Matched';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ok ? T.greenLight : T.redLight, color: ok ? T.green : T.red }}>
      {ok ? <CheckCircle2 size={9} /> : <XCircle size={9} />} {status}
    </span>
  );
}

function Donut({ matched, total }: { matched: number; total: number }) {
  const rate = total ? matched / total : 0;
  const r = 48, sw = 9, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={r} fill="none" stroke={T.border2} strokeWidth={sw} />
        <circle cx={60} cy={60} r={r} fill="none" stroke={T.accent} strokeWidth={sw}
          strokeDasharray={`${circ * rate} ${circ * (1 - rate)}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{total ? Math.round(rate * 100) : 0}%</span>
        <span style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Match</span>
      </div>
    </div>
  );
}

function LegRow({ color, label, val, total }: { color: string; label: string; val: number; total: number }) {
  const pct = total ? Math.round((val / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: T.textSub, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{val}</span>
      <span style={{ fontSize: 10, color: T.textDim, width: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function Skel({ w, h }: { w: number; h: number }) {
  return <div style={{ width: w, height: h, borderRadius: 3, background: `linear-gradient(90deg,${T.cardBg2} 0px,${T.hover} 80px,${T.cardBg2} 160px)`, backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear' }} />;
}
