import { useEffect, useState, useCallback } from 'react';
import {
  Download, RefreshCw, Filter, Calendar, LogIn, LogOut,
  Clock, Users, CheckCircle2, UserCheck, ChevronDown, ChevronRight,
  Loader,
} from 'lucide-react';
import { fetchAttendance, type AttendanceRecord, type AttendanceSession } from '../api';
import { T } from '../theme';

type Period = 'today' | 'week' | 'month' | 'custom';

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReportsPage() {
  const today      = toISODate(new Date());
  const [records, setRecords]         = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [period, setPeriod]           = useState<Period>('today');
  const [dateFrom, setDateFrom]       = useState(today);
  const [dateTo, setDateTo]           = useState(today);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const getPeriodDates = useCallback((p: Period): { from: string; to: string } => {
    const now   = new Date();
    const todayStr = toISODate(now);
    if (p === 'today')  return { from: todayStr, to: todayStr };
    if (p === 'week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return { from: toISODate(monday), to: todayStr };
    }
    if (p === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toISODate(first), to: todayStr };
    }
    return { from: dateFrom, to: dateTo };
  }, [dateFrom, dateTo]);

  const load = useCallback(async (p: Period = period) => {
    setLoading(true);
    try {
      const { from, to } = getPeriodDates(p);
      const d = await fetchAttendance({ date_from: from, date_to: to });
      setRecords(d.attendance ?? []);
    } catch { /**/ }
    finally { setLoading(false); }
  }, [period, getPeriodDates]);

  useEffect(() => { load(period); }, []);

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    if (p !== 'custom') load(p);
  };

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Stats ──────────────────────────────────────────────────────
  const totalEmployees  = records.length;
  const totalWithOut    = records.filter(r => r.last_check_out != null).length;
  const currentlyIn     = records.filter(r => {
    const lastSession = r.sessions[r.sessions.length - 1];
    return lastSession && lastSession.check_out_ts == null;
  }).length;
  const avgMinutes = totalWithOut > 0
    ? Math.round(records.filter(r => r.total_min > 0).reduce((s, r) => s + r.total_min, 0) / Math.max(totalWithOut, 1))
    : 0;

  const stats = [
    { label: 'Total Present',    value: totalEmployees, icon: <Users size={18} />,     color: T.accent,  light: T.accentLight },
    { label: 'Completed Day',    value: totalWithOut,   icon: <CheckCircle2 size={18}/>, color: T.green, light: T.greenLight  },
    { label: 'Currently In',     value: currentlyIn,    icon: <UserCheck size={18}/>,  color: T.blue,    light: T.blueLight   },
    { label: 'Avg Hours Worked', value: avgMinutes > 0 ? formatDuration(avgMinutes) : '—', icon: <Clock size={18}/>, color: T.yellow, light: T.yellowLight },
  ];

  // ── Export ─────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows: string[] = [
      'Employee ID,Name,Department,Date,Session #,Check In,Check Out,Duration (min)',
    ];
    for (const r of records) {
      if (r.sessions.length === 0) {
        rows.push(`${r.employee_id},${r.name},${r.department},${r.date},—,—,—,—`);
      } else {
        r.sessions.forEach((s, i) => {
          rows.push(`${r.employee_id},${r.name},${r.department},${r.date},${i + 1},${s.check_in_time},${s.check_out_time ?? 'Still In'},${s.duration_min ?? '—'}`);
        });
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `attendance_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className="fade-in" style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 3 }}>Attendance Report</h1>
          <p style={{ fontSize: 13, color: T.textSub }}>Check-in and check-out records with session durations</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <DBtn
            label="Refresh"
            icon={<RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />}
            onClick={() => load(period)}
          />
          <DBtn primary label="Export CSV" icon={<Download size={13} />} onClick={exportCSV} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`,
            padding: '16px 18px', boxShadow: T.shadow,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: s.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textSub, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{loading ? '—' : s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Period filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Filter size={13} color={T.textDim} />
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => handlePeriod(p.key)} style={{
            padding: '5px 13px', borderRadius: 20, border: `1px solid ${period === p.key ? T.accent + '44' : T.border2}`,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: period === p.key ? T.accentLight : 'transparent',
            color: period === p.key ? T.accent : T.textSub,
          }}>{p.label}</button>
        ))}
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={12} color={T.textDim} />
              <input type="date" value={dateFrom} max={dateTo}
                onChange={e => setDateFrom(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 7, border: `1px solid ${T.border2}`, fontSize: 12, color: T.text, background: T.cardBg }} />
            </div>
            <span style={{ fontSize: 11, color: T.textDim }}>to</span>
            <input type="date" value={dateTo} min={dateFrom} max={today}
              onChange={e => setDateTo(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 7, border: `1px solid ${T.border2}`, fontSize: 12, color: T.text, background: T.cardBg }} />
            <button onClick={() => load('custom')} style={{
              padding: '5px 12px', borderRadius: 7, border: 'none',
              background: T.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Apply</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`, boxShadow: T.shadow, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
            {loading ? 'Loading...' : `${records.length} employee${records.length !== 1 ? 's' : ''} — ${period === 'custom' ? `${dateFrom} → ${dateTo}` : PERIODS.find(p => p.key === period)?.label}`}
          </span>
          <span style={{ fontSize: 11, color: T.textDim }}>Click a row to expand sessions</span>
        </div>

        <div style={{ maxHeight: 540, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: T.cardBg2 }}>
                {['', 'Employee ID', 'Name', 'Department', 'Date', 'First In', 'Last Out', 'Total Time', 'Sessions'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '9px 14px',
                    fontSize: 10, fontWeight: 600, color: T.textDim,
                    textTransform: 'uppercase', letterSpacing: 0.7,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1, 2, 3, 4].map(i => (
                <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                  {[20, 70, 100, 100, 90, 70, 70, 60, 40].map((w, j) => (
                    <td key={j} style={{ padding: '10px 14px' }}><Skel w={w} /></td>
                  ))}
                </tr>
              ))}

              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: T.textDim }}>
                    <div style={{ marginBottom: 8 }}><Calendar size={28} style={{ margin: '0 auto', display: 'block', opacity: 0.4 }} /></div>
                    No attendance records for this period
                  </td>
                </tr>
              )}

              {records.map((r) => {
                const rowKey = `${r.employee_id}-${r.date}`;
                const expanded = expandedRows.has(rowKey);
                const lastSession = r.sessions[r.sessions.length - 1];
                const stillIn = lastSession && lastSession.check_out_ts == null;

                return [
                  // Main row
                  <tr key={rowKey}
                    onClick={() => r.sessions.length > 0 && toggleRow(rowKey)}
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      cursor: r.sessions.length > 0 ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                      background: expanded ? T.accentLight : 'transparent',
                    }}
                    onMouseEnter={ev => { if (!expanded) (ev.currentTarget as HTMLTableRowElement).style.background = T.hover; }}
                    onMouseLeave={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = expanded ? T.accentLight : 'transparent'; }}
                  >
                    {/* Expand toggle */}
                    <td style={{ padding: '9px 8px 9px 14px', color: T.textDim, width: 20 }}>
                      {r.sessions.length > 1
                        ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
                        : null}
                    </td>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: T.accent }}>{r.employee_id}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: T.text }}>{r.name}</td>
                    <td style={{ padding: '9px 14px', color: T.textSub }}>{r.department}</td>
                    <td style={{ padding: '9px 14px', color: T.textDim, whiteSpace: 'nowrap' }}>{formatDate(r.date)}</td>
                    {/* First In */}
                    <td style={{ padding: '9px 14px' }}>
                      {r.sessions.length > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.green, fontWeight: 600 }}>
                          <LogIn size={11} /> {formatTime(r.sessions[0].check_in_ts)}
                        </span>
                      ) : <span style={{ color: T.textDim }}>—</span>}
                    </td>
                    {/* Last Out */}
                    <td style={{ padding: '9px 14px' }}>
                      {stillIn ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: T.blueLight, color: T.blue }}>
                          <Loader size={9} style={{ animation: 'spin 1.5s linear infinite' }} /> Still In
                        </span>
                      ) : lastSession?.check_out_ts ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.blue, fontWeight: 600 }}>
                          <LogOut size={11} /> {formatTime(lastSession.check_out_ts)}
                        </span>
                      ) : <span style={{ color: T.textDim }}>—</span>}
                    </td>
                    {/* Total time */}
                    <td style={{ padding: '9px 14px' }}>
                      {r.total_min > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: T.greenLight, color: T.green }}>
                          <Clock size={9} /> {formatDuration(r.total_min)}
                        </span>
                      ) : <span style={{ color: T.textDim, fontSize: 11 }}>—</span>}
                    </td>
                    {/* Sessions count */}
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.textSub }}>{r.total_sessions}</span>
                    </td>
                  </tr>,

                  // Expanded sessions sub-rows
                  expanded && r.sessions.map((s: AttendanceSession, i: number) => (
                    <tr key={`${rowKey}-s${i}`} style={{ borderTop: `1px solid ${T.border}`, background: '#fdf8fb' }}>
                      <td style={{ padding: '7px 8px 7px 28px' }} colSpan={2} />
                      <td colSpan={2} style={{ padding: '7px 14px', color: T.textSub, fontSize: 11 }}>
                        <span style={{ fontWeight: 600, color: T.accent }}>Session {i + 1}</span>
                      </td>
                      <td style={{ padding: '7px 14px', color: T.textDim, fontSize: 11 }} />
                      {/* Check-in */}
                      <td style={{ padding: '7px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.green, fontWeight: 600 }}>
                          <LogIn size={10} /> {formatTime(s.check_in_ts)}
                        </span>
                      </td>
                      {/* Check-out */}
                      <td style={{ padding: '7px 14px' }}>
                        {s.check_out_ts ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.blue, fontWeight: 600 }}>
                            <LogOut size={10} /> {formatTime(s.check_out_ts)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: T.blue, fontStyle: 'italic' }}>Still In</span>
                        )}
                      </td>
                      {/* Duration */}
                      <td style={{ padding: '7px 14px' }}>
                        {s.duration_min != null ? (
                          <span style={{ fontSize: 11, color: T.textSub }}>{formatDuration(s.duration_min)}</span>
                        ) : <span style={{ fontSize: 11, color: T.textDim }}>—</span>}
                      </td>
                      <td />
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
    </div>
  );
}

function DBtn({ label, icon, onClick, primary }: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', border: primary ? 'none' : `1px solid ${T.border2}`,
      background: primary ? T.green : T.cardBg,
      color: primary ? '#fff' : T.textSub, boxShadow: T.shadow,
    }}>{icon}{label}</button>
  );
}

function Skel({ w }: { w: number }) {
  return (
    <div style={{
      width: w, height: 11, borderRadius: 3,
      background: `linear-gradient(90deg,${T.cardBg2} 0px,${T.hover} 80px,${T.cardBg2} 160px)`,
      backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear',
    }} />
  );
}
