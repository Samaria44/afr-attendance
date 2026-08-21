import { useEffect, useState } from 'react';
import { Users, CheckCircle2, XCircle, Activity, RefreshCw, TrendingUp, Clock, UserCheck, LogIn, LogOut, Download } from 'lucide-react';
import { fetchLog, fetchEmployees, fetchTodaySummary, type TodaySummary } from '../api';
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
  const [summary, setSummary]     = useState<TodaySummary | null>(null);
  const [period, setPeriod]       = useState<'today'|'week'|'month'|'all'>('today');

  const load = async () => {
    setLoading(true);
    try {
      const [e, l, s] = await Promise.all([fetchEmployees(), fetchLog(200), fetchTodaySummary()]);
      setEmployees(e.employees ?? []);
      setLog(l.log ?? []);
      setSummary(s);
    } catch { /**/ } finally { setLoading(false); }
  };

  const downloadLog = () => {
    const rows: string[] = [
      'Employee ID,Name,Department,Time,Status,Similarity',
    ];
    filteredLog.forEach(e => {
      rows.push(`${e.employee_id},${e.name},${e.department},${e.time},${e.status},${e.similarity}`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recognition_log_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => { load(); }, []);

  // Filter log by period
  const filteredLog = log.filter(e => {
    if (period === 'all') return true;
    const d = new Date(e.time);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (period === 'today') return d.toDateString() === now.toDateString();
    if (period === 'week')  { const wk = new Date(now); wk.setDate(now.getDate()-7); return d >= wk; }
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });

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
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Recent Check-ins</h2>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Period filter pills */}
              {(['today','week','month','all'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '4px 11px', borderRadius: 20, border: `1px solid ${period===p ? T.accent+'55' : T.border2}`,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: period===p ? T.accentLight : 'transparent',
                  color:      period===p ? T.accent      : T.textSub,
                }}>
                  {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All'}
                </button>
              ))}
              {/* Download button */}
              <button onClick={downloadLog} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20, border: `1px solid ${T.border2}`,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: 'transparent', color: T.textSub,
              }}>
                <Download size={12} /> Export
              </button>
            </div>
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
              {!loading && filteredLog.slice(0,8).map((e, i) => (
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
          {/* Today's attendance summary */}
          <div style={{ background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`, padding: '16px 18px', boxShadow: T.shadow }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Today's Attendance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ background: T.greenLight, borderRadius: 9, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                  <LogIn size={11} color={T.green} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.green }}>Checked In</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{loading ? '—' : (summary?.checked_in_count ?? 0)}</div>
              </div>
              <div style={{ background: T.blueLight, borderRadius: 9, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                  <LogOut size={11} color={T.blue} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.blue }}>Checked Out</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>{loading ? '—' : (summary?.checked_out_count ?? 0)}</div>
              </div>
            </div>
            {/* Currently In list */}
            {!loading && summary && summary.currently_in.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Currently Inside</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 120, overflowY: 'auto' }}>
                  {summary.currently_in.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, background: T.cardBg2 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                        {p.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: T.textDim }}>{p.time}</div>
                      </div>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, flexShrink: 0, animation: 'pulse-dot 2s infinite' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!loading && summary && summary.currently_in.length === 0 && (
              <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 11, color: T.textDim }}>No one is currently checked in</div>
            )}
          </div>

          {/* Donut */}
          <div style={{ background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`, padding: '18px', boxShadow: T.shadow }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>Recognition Rate</h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <Donut matched={matched} total={log.length} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <LegRow color={T.green} label="Matched" val={matched} total={log.length} />
              <LegRow color={T.red}   label="Unknown" val={unknown} total={log.length} />
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
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
