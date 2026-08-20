import { useEffect, useState } from 'react';
import { Download, RefreshCw, CheckCircle2, XCircle, Filter } from 'lucide-react';
import { fetchLog } from '../api';
import { T } from '../theme';

interface LogEntry {
  employee_id: string; name: string; department: string;
  time: string; status: 'Matched' | 'Unknown'; similarity: number;
}
type Period = 'today' | 'week' | 'month' | 'all';

export default function ReportsPage() {
  const [log, setLog]         = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<Period>('all');

  const load = async () => {
    setLoading(true);
    try { const d = await fetchLog(500); setLog(d.log ?? []); }
    catch {/**/ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const matched   = log.filter(e => e.status === 'Matched').length;
  const unknown   = log.filter(e => e.status === 'Unknown').length;
  const matchRate = log.length ? Math.round((matched / log.length) * 100) : 0;

  const exportCSV = () => {
    const header = 'Employee ID,Name,Department,Time,Status,Similarity\n';
    const rows   = log.map(e => `${e.employee_id},${e.name},${e.department},"${e.time}",${e.status},${e.similarity}`).join('\n');
    const blob   = new Blob([header + rows], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a'); a.href=url; a.download='attendance_report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const PERIODS: {key:Period;label:string}[] = [
    {key:'today',label:'Today'},{key:'week',label:'This Week'},{key:'month',label:'This Month'},{key:'all',label:'All Time'},
  ];

  const stats = [
    { label:'Total Events', value:log.length,  color:T.accent, light:T.accentLight },
    { label:'Matched',      value:matched,      color:T.green,  light:T.greenLight  },
    { label:'Unknown',      value:unknown,      color:T.red,    light:T.redLight    },
    { label:'Match Rate',   value:`${matchRate}%`, color:T.yellow, light:T.yellowLight },
  ];

  return (
    <div className="fade-in" style={{ padding:'24px 28px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:T.text, marginBottom:3 }}>Attendance Report</h1>
          <p style={{ fontSize:13, color:T.textSub }}>Recognition history and analytics</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <DBtn label="Refresh" icon={<RefreshCw size={13} style={loading?{animation:'spin 1s linear infinite'}:{}} />} onClick={load} />
          <DBtn primary label="Export CSV" icon={<Download size={13} />} onClick={exportCSV} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {stats.map(s=>(
          <div key={s.label} style={{ background:T.cardBg, borderRadius:T.r2, border:`1px solid ${T.border}`, padding:'16px 20px', boxShadow:T.shadow }}>
            <div style={{ fontSize:11, color:T.textSub, marginBottom:7 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{loading?'—':s.value}</div>
          </div>
        ))}
      </div>

      {/* Period filter */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <Filter size={13} color={T.textDim} />
        {PERIODS.map(p=>(
          <button key={p.key} onClick={()=>setPeriod(p.key)} style={{ padding:'5px 13px', borderRadius:20, border:`1px solid ${period===p.key?T.accent+'44':T.border2}`, fontSize:12, fontWeight:600, cursor:'pointer', background:period===p.key?T.accentLight:'transparent', color:period===p.key?T.accent:T.textSub }}>{p.label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:T.cardBg, borderRadius:T.r2, border:`1px solid ${T.border}`, boxShadow:T.shadow, overflow:'hidden' }}>
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{log.length} records</span>
          <span style={{ fontSize:11, color:T.textDim }}>Latest first</span>
        </div>
        <div style={{ maxHeight:460, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead style={{ position:'sticky', top:0, zIndex:1 }}>
              <tr style={{ background:T.cardBg2 }}>
                {['#','Employee ID','Name','Department','Time','Status','Similarity'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:600, color:T.textDim, textTransform:'uppercase', letterSpacing:0.7 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1,2,3,4].map(i=>(
                <tr key={i} style={{ borderTop:`1px solid ${T.border}` }}>
                  {[30,90,110,100,120,70,60].map((w,j)=><td key={j} style={{ padding:'10px 14px' }}><Skel w={w} /></td>)}
                </tr>
              ))}
              {!loading && log.length===0 && <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:T.textDim }}>No records</td></tr>}
              {log.map((e,i)=>(
                <tr key={i} style={{ borderTop:`1px solid ${T.border}`, transition:'background 0.12s' }}
                  onMouseEnter={ev=>(ev.currentTarget as HTMLTableRowElement).style.background=T.hover}
                  onMouseLeave={ev=>(ev.currentTarget as HTMLTableRowElement).style.background='transparent'}>
                  <td style={{ padding:'9px 14px', color:T.textDim }}>{i+1}</td>
                  <td style={{ padding:'9px 14px', fontWeight:700, color:T.accent }}>{e.employee_id}</td>
                  <td style={{ padding:'9px 14px', fontWeight:600, color:T.text }}>{e.name}</td>
                  <td style={{ padding:'9px 14px', color:T.textSub }}>{e.department}</td>
                  <td style={{ padding:'9px 14px', color:T.textDim, whiteSpace:'nowrap' }}>{e.time}</td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:e.status==='Matched'?T.greenLight:T.redLight, color:e.status==='Matched'?T.green:T.red }}>
                      {e.status==='Matched'?<CheckCircle2 size={9}/>:<XCircle size={9}/>} {e.status}
                    </span>
                  </td>
                  <td style={{ padding:'9px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ height:3, width:48, background:T.border2, borderRadius:2 }}>
                        <div style={{ height:'100%', borderRadius:2, background:e.status==='Matched'?T.green:T.red, width:`${Math.round(e.similarity*100)}%` }} />
                      </div>
                      <span style={{ fontSize:10, color:T.textDim }}>{(e.similarity*100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function DBtn({ label, icon, onClick, primary }: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border:primary?'none':`1px solid ${T.border2}`, background:primary?T.green:T.cardBg, color:primary?'#fff':T.textSub, boxShadow:T.shadow }}>{icon}{label}</button>;
}
function Skel({ w }: { w: number }) {
  return <div style={{ width:w, height:11, borderRadius:3, background:`linear-gradient(90deg,${T.cardBg2} 0px,${T.hover} 80px,${T.cardBg2} 160px)`, backgroundSize:'400px 100%', animation:'shimmer 1.4s infinite linear' }} />;
}
