import { useEffect, useRef, useState } from 'react';
import {
  Search, UserPlus, Trash2, RefreshCw, Users,
  Upload, RotateCcw, Loader, CheckCircle, AlertCircle,
  ChevronDown, X,
} from 'lucide-react';
import { fetchEmployees, deleteEmployee, registerImage } from '../api';
import { getUser } from '../auth';
import { can } from '../permissions';
import { T } from '../theme';

interface Employee { employee_id: string; name: string; department: string; }
const DEPTS = ['Software Engineering','Human Resources','Finance','Operations','Marketing','Administration'];

export default function EmployeesPage() {
  const user = getUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting]   = useState<string|null>(null);
  const [empId, setEmpId]         = useState('');
  const [name, setName]           = useState('');
  const [dept, setDept]           = useState(DEPTS[0]);
  const [images, setImages]       = useState<(string|null)[]>([null,null,null]);
  const [blobs, setBlobs]         = useState<(Blob|null)[]>([null,null,null]);
  const [regStatus, setRegStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [regMsg, setRegMsg]       = useState('');
  const [progress, setProgress]   = useState(0);
  const refs = [useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null)];

  const load = async () => {
    setLoading(true);
    try { const d = await fetchEmployees(); setEmployees(d.employees ?? []); }
    catch {/**/ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete employee ${id}?`)) return;
    setDeleting(id);
    try { await deleteEmployee(id); await load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setDeleting(null); }
  };

  const handleFile = (idx: number, file: File) => {
    setImages(p => { const c=[...p]; c[idx]=URL.createObjectURL(file); return c; });
    setBlobs(p  => { const c=[...p]; c[idx]=file; return c; });
  };

  const reset = () => { setEmpId(''); setName(''); setDept(DEPTS[0]); setImages([null,null,null]); setBlobs([null,null,null]); setRegStatus('idle'); setRegMsg(''); setProgress(0); };

  const handleRegister = async () => {
    if (!empId || !name || blobs.some(b=>!b)) return;
    setRegStatus('loading'); setRegMsg(''); setProgress(0);
    try {
      for (let i=0;i<3;i++) { await registerImage(empId,name,dept,blobs[i]!,`img_${i+1}.jpg`); setProgress(i+1); }
      setRegStatus('success'); setRegMsg('Employee registered successfully!');
      setTimeout(() => { setShowModal(false); reset(); load(); }, 1200);
    } catch (e: unknown) { setRegStatus('error'); setRegMsg(e instanceof Error ? e.message : 'Failed'); }
  };

  const filled = blobs.filter(Boolean).length;

  return (
    <div className="fade-in" style={{ padding:'24px 28px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:T.text, marginBottom:3 }}>Employees</h1>
          <p style={{ fontSize:13, color:T.textSub }}>{employees.length} registered employees</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <DBtn label="Refresh" icon={<RefreshCw size={13} style={loading?{animation:'spin 1s linear infinite'}:{}} />} onClick={load} />
          {can(user,'face:register_employee') && (
            <DBtn primary label="Add Employee" icon={<UserPlus size={13} />} onClick={() => { reset(); setShowModal(true); }} />
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ background:T.cardBg, borderRadius:T.r2, border:`1px solid ${T.border}`, boxShadow:T.shadow, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:10 }}>
          <Search size={14} color={T.textDim} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..."
            style={{ border:'none', outline:'none', fontSize:13, flex:1, background:'transparent', color:T.text }} />
          {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:T.textDim }}><X size={13} /></button>}
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:T.cardBg2 }}>
              {['Employee ID','Name','Department','Status','Actions'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'9px 16px', fontSize:10, fontWeight:600, color:T.textDim, textTransform:'uppercase', letterSpacing:0.7 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4].map(i => (
              <tr key={i} style={{ borderTop:`1px solid ${T.border}` }}>
                {[100,140,120,60,80].map((w,j)=><td key={j} style={{ padding:'12px 16px' }}><Skel w={w} /></td>)}
              </tr>
            ))}
            {!loading && filtered.length===0 && (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:40 }}>
                <Users size={30} color={T.border2} style={{ margin:'0 auto 10px', display:'block' }} />
                <span style={{ fontSize:13, color:T.textDim }}>{search?'No results':'No employees yet'}</span>
              </td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.employee_id} style={{ borderTop:`1px solid ${T.border}`, transition:'background 0.12s' }}
                onMouseEnter={ev=>(ev.currentTarget as HTMLTableRowElement).style.background=T.hover}
                onMouseLeave={ev=>(ev.currentTarget as HTMLTableRowElement).style.background='transparent'}>
                <td style={{ padding:'11px 16px', fontWeight:700, color:T.accent, fontSize:12 }}>{e.employee_id}</td>
                <td style={{ padding:'11px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:T.accentLight, border:`1px solid ${T.accentMid}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:T.accent, flexShrink:0 }}>
                      {e.name.charAt(0)}
                    </div>
                    <span style={{ fontWeight:600, color:T.text }}>{e.name}</span>
                  </div>
                </td>
                <td style={{ padding:'11px 16px', color:T.textSub }}>{e.department}</td>
                <td style={{ padding:'11px 16px' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:T.greenLight, color:T.green }}>
                    <span style={{ width:5, height:5, borderRadius:'50%', background:T.green, display:'inline-block' }} /> Active
                  </span>
                </td>
                <td style={{ padding:'11px 16px' }}>
                  {can(user,'face:delete_employee') && (
                    <button onClick={()=>handleDelete(e.employee_id)} disabled={deleting===e.employee_id}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:7, border:`1px solid ${T.red}33`, background:T.redLight, color:T.red, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      {deleting===e.employee_id?<Loader size={11} style={{ animation:'spin 1s linear infinite' }} />:<Trash2 size={11} />} Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal — covers full viewport including sidebar */}
      {showModal && (
        <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.45)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div style={{ background:T.cardBg, borderRadius:16, border:`1px solid ${T.border}`, width:'100%', maxWidth:640, maxHeight:'92vh', overflowY:'auto', boxShadow:T.shadow2 }}>

            {/* Modal header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:`1px solid ${T.border}` }}>
              <div>
                <h3 style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:2 }}>Register New Employee</h3>
                <p style={{ fontSize:12, color:T.textSub }}>Fill in details and upload 3 clear face photos</p>
              </div>
              <button onClick={()=>{setShowModal(false);reset();}} style={{ background:T.cardBg2, border:`1px solid ${T.border}`, borderRadius:8, cursor:'pointer', color:T.textSub, padding:'6px 8px', display:'flex', alignItems:'center' }}><X size={15} /></button>
            </div>

            <div style={{ padding:'24px' }}>
              {/* Row 1: Employee ID + Full Name */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:T.textSub, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>Employee ID</label>
                  <input value={empId} onChange={e=>setEmpId(e.target.value)} placeholder="e.g. EMP-001"
                    style={{ width:'100%', padding:'10px 13px', borderRadius:9, border:`1.5px solid ${T.border2}`, background:T.cardBg2, color:T.text, fontSize:13 }} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:T.textSub, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>Full Name</label>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Employee full name"
                    style={{ width:'100%', padding:'10px 13px', borderRadius:9, border:`1.5px solid ${T.border2}`, background:T.cardBg2, color:T.text, fontSize:13 }} />
                </div>
              </div>

              {/* Row 2: Department full width */}
              <div style={{ marginBottom:22 }}>
                <label style={{ fontSize:11, fontWeight:600, color:T.textSub, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:0.6 }}>Department</label>
                <div style={{ position:'relative' }}>
                  <select value={dept} onChange={e=>setDept(e.target.value)}
                    style={{ width:'100%', padding:'10px 36px 10px 13px', borderRadius:9, border:`1.5px solid ${T.border2}`, background:T.cardBg2, color:T.text, fontSize:13, appearance:'none', cursor:'pointer' }}>
                    {DEPTS.map(d=><option key={d}>{d}</option>)}
                  </select>
                  <ChevronDown size={14} color={T.textDim} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                </div>
              </div>

              {/* Face photos */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:T.textSub, textTransform:'uppercase', letterSpacing:0.6, display:'block', marginBottom:2 }}>Face Photos</label>
                    <span style={{ fontSize:11, color:T.textDim }}>Upload exactly 3 clear face photos</span>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, padding:'3px 11px', borderRadius:20, background:filled===3?T.greenLight:T.accentLight, color:filled===3?T.green:T.accent }}>{filled} / 3</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
                  {images.map((img,idx)=>(
                    <div key={idx}>
                      <div onClick={()=>!img&&refs[idx].current?.click()}
                        style={{ aspectRatio:'1', borderRadius:12, border:`2px dashed ${img?T.accent:T.border2}`, background:img?'#000':T.cardBg2, overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:img?'default':'pointer', transition:'all 0.2s', minHeight:140 }}>
                        {img
                          ? <img src={img} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <>
                              <div style={{ background:T.accentLight, borderRadius:'50%', padding:12, marginBottom:8, display:'flex' }}>
                                <Upload size={20} color={T.accent} />
                              </div>
                              <span style={{ fontSize:11, fontWeight:600, color:T.textSub }}>Photo {idx+1}</span>
                              <span style={{ fontSize:10, color:T.textDim, marginTop:2 }}>Click to upload</span>
                            </>
                        }
                      </div>
                      <input ref={refs[idx]} type="file" accept="image/*" style={{ display:'none' }}
                        onChange={e=>e.target.files?.[0]&&handleFile(idx,e.target.files[0])} />
                      {img && (
                        <div style={{ display:'flex', gap:6, marginTop:8 }}>
                          <button onClick={()=>refs[idx].current?.click()} style={{ flex:1, padding:'5px 0', fontSize:11, border:`1px solid ${T.border2}`, borderRadius:7, background:T.cardBg2, color:T.textSub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                            <RotateCcw size={10}/> Retake
                          </button>
                          <button onClick={()=>{setImages(p=>{const c=[...p];c[idx]=null;return c;});setBlobs(p=>{const c=[...p];c[idx]=null;return c;});}}
                            style={{ padding:'5px 10px', fontSize:11, border:`1px solid ${T.red}33`, borderRadius:7, background:T.redLight, color:T.red, cursor:'pointer', display:'flex', alignItems:'center' }}>
                            <Trash2 size={10}/>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              {regStatus==='loading' && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.textSub, marginBottom:5 }}>
                    <span>Uploading photos...</span><span>{progress}/3</span>
                  </div>
                  <div style={{ height:4, background:T.border2, borderRadius:2 }}>
                    <div style={{ height:'100%', background:T.accent, borderRadius:2, width:`${(progress/3)*100}%`, transition:'width 0.3s' }} />
                  </div>
                </div>
              )}

              {/* Feedback */}
              {regMsg && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:9, marginBottom:16, fontSize:13, background:regStatus==='success'?T.greenLight:T.redLight, color:regStatus==='success'?T.green:T.red, border:`1px solid ${regStatus==='success'?T.green:T.red}22` }}>
                  {regStatus==='success'?<CheckCircle size={14}/>:<AlertCircle size={14}/>} {regMsg}
                </div>
              )}

              {/* Actions */}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={handleRegister}
                  disabled={!empId||!name||blobs.some(b=>!b)||regStatus==='loading'}
                  style={{ flex:1, padding:'12px 0', borderRadius:10, border:'none', background:T.accent, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:!empId||!name||blobs.some(b=>!b)?0.5:1, boxShadow:`0 4px 14px ${T.accent}44`, transition:'opacity 0.2s' }}>
                  {regStatus==='loading'
                    ? <><Loader size={15} style={{ animation:'spin 1s linear infinite' }}/> Saving...</>
                    : <><UserPlus size={15}/> Save Employee</>}
                </button>
                <button onClick={()=>{setShowModal(false);reset();}}
                  style={{ padding:'12px 22px', borderRadius:10, border:`1.5px solid ${T.border2}`, background:T.cardBg2, fontSize:14, fontWeight:600, color:T.textSub, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function DBtn({ label, icon, onClick, primary }: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border: primary?'none':`1px solid ${T.border2}`, background: primary?T.accent:T.cardBg, color: primary?'#fff':T.textSub, boxShadow: primary?`0 4px 10px ${T.accent}33`:T.shadow }}>
      {icon}{label}
    </button>
  );
}
function Skel({ w }: { w: number }) {
  return <div style={{ width:w, height:11, borderRadius:3, background:`linear-gradient(90deg,${T.cardBg2} 0px,${T.hover} 80px,${T.cardBg2} 160px)`, backgroundSize:'400px 100%', animation:'shimmer 1.4s infinite linear' }} />;
}
