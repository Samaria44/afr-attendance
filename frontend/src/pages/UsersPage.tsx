import { useEffect, useState } from 'react';
import { UserPlus, Trash2, RefreshCw, Shield, User, Eye, Loader, CheckCircle, AlertCircle, Lock, X } from 'lucide-react';
import { fetchUsers, createUser, deleteUser } from '../api';
import { getUser } from '../auth';
import { can } from '../permissions';
import { T } from '../theme';

interface SysUser { username: string; full_name: string; role: string; }

const ROLE: Record<string,{color:string;light:string;icon:React.ReactNode;label:string}> = {
  admin:    { color:T.accent, light:T.accentLight, icon:<Shield size={11}/>, label:'Admin' },
  operator: { color:T.green,  light:T.greenLight,  icon:<User size={11}/>,   label:'Operator' },
  viewer:   { color:T.blue,   light:T.blueLight,   icon:<Eye size={11}/>,    label:'Viewer' },
};

export default function UsersPage() {
  const me = getUser();
  if (!can(me,'auth:view_users')) {
    return (
      <div style={{ padding:28, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, gap:12 }}>
        <div style={{ background:T.cardBg2, borderRadius:14, padding:18, border:`1px solid ${T.border}` }}><Lock size={30} color={T.textDim} /></div>
        <p style={{ fontSize:14, fontWeight:700, color:T.textSub }}>Access Restricted</p>
        <p style={{ fontSize:12, color:T.textDim }}>Only administrators can manage users.</p>
      </div>
    );
  }

  const [users, setUsers]       = useState<SysUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [roleFilter, setRoleFilter] = useState<'all'|'admin'|'operator'|'viewer'>('all');
  const [uname, setUname]       = useState('');
  const [pass, setPass]         = useState('');
  const [fname, setFname]       = useState('');
  const [role, setRole]         = useState('operator');
  const [status, setStatus]     = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [msg, setMsg]           = useState('');

  const load = async () => {
    setLoading(true);
    try { const d = await fetchUsers(); setUsers(d.users ?? []); }
    catch {/**/ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const reset = () => { setUname(''); setPass(''); setFname(''); setRole('operator'); setStatus('idle'); setMsg(''); };

  const handleCreate = async () => {
    if (!uname || !pass || !fname) return;
    setStatus('loading'); setMsg('');
    try {
      await createUser(uname, pass, fname, role);
      setStatus('success'); setMsg('User created!');
      setTimeout(() => { setShowModal(false); reset(); load(); }, 1000);
    } catch (e: unknown) { setStatus('error'); setMsg(e instanceof Error ? e.message : 'Failed'); }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Delete "${username}"?`)) return;
    setDeleting(username);
    try { await deleteUser(username); await load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="fade-in" style={{ padding:'24px 28px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:T.text, marginBottom:3 }}>User Management</h1>
          <p style={{ fontSize:13, color:T.textSub }}>{users.length} system users</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <DBtn label="Refresh" icon={<RefreshCw size={13} style={loading?{animation:'spin 1s linear infinite'}:{}} />} onClick={load} />
          <DBtn primary label="Add User" icon={<UserPlus size={13} />} onClick={()=>{reset();setShowModal(true);}} />
        </div>
      </div>

      {/* Role cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
        {Object.entries(ROLE).map(([key,r])=>{
          const count=users.filter(u=>u.role===key).length;
          return (
            <div key={key} style={{ background:T.cardBg, borderRadius:T.r2, border:`1px solid ${T.border}`, padding:'16px 20px', display:'flex', alignItems:'center', gap:14, boxShadow:T.shadow }}>
              <div style={{ background:r.light, borderRadius:10, padding:10, color:r.color, display:'flex' }}>{r.icon}</div>
              <div>
                <div style={{ fontSize:22, fontWeight:800, color:r.color }}>{count}</div>
                <div style={{ fontSize:11, color:T.textSub }}>{r.label}s</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background:T.cardBg, borderRadius:T.r2, border:`1px solid ${T.border}`, boxShadow:T.shadow, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:T.cardBg2 }}>
              {['User','Username','Role','Actions'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'9px 16px', fontSize:10, fontWeight:600, color:T.textDim, textTransform:'uppercase', letterSpacing:0.7 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading&&[1,2,3].map(i=>(
              <tr key={i} style={{ borderTop:`1px solid ${T.border}` }}>
                {[160,100,80,80].map((w,j)=><td key={j} style={{ padding:'12px 16px' }}><Skel w={w} /></td>)}
              </tr>
            ))}
            {users.map((u,i)=>{
              const r=ROLE[u.role]??ROLE.viewer;
              return (
                <tr key={u.username} style={{ borderTop:`1px solid ${T.border}`, transition:'background 0.12s' }}
                  onMouseEnter={ev=>(ev.currentTarget as HTMLTableRowElement).style.background=T.hover}
                  onMouseLeave={ev=>(ev.currentTarget as HTMLTableRowElement).style.background='transparent'}>
                  <td style={{ padding:'11px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:r.light, border:`1px solid ${r.color}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:r.color }}>
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight:600, color:T.text }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td style={{ padding:'11px 16px', color:T.textSub, fontSize:12 }}>{u.username}</td>
                  <td style={{ padding:'11px 16px' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:r.light, color:r.color }}>
                      {r.icon} {r.label}
                    </span>
                  </td>
                  <td style={{ padding:'11px 16px' }}>
                    {u.username!==me?.username&&(
                      <button onClick={()=>handleDelete(u.username)} disabled={deleting===u.username}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:7, border:`1px solid ${T.red}33`, background:T.redLight, color:T.red, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                        {deleting===u.username?<Loader size={11} style={{ animation:'spin 1s linear infinite' }}/>:<Trash2 size={11}/>} Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal&&(
        <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.45)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:T.cardBg, borderRadius:T.r2, border:`1px solid ${T.border}`, width:440, boxShadow:T.shadow2 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:`1px solid ${T.border}` }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:T.text }}>Create New User</h3>
              <button onClick={()=>{setShowModal(false);reset();}} style={{ background:'none', border:'none', cursor:'pointer', color:T.textDim }}><X size={14} /></button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              {[['Full Name',fname,setFname,'Full name','text'],['Username',uname,setUname,'username','text'],['Password',pass,setPass,'Min 6 chars','password']].map(([lbl,val,setter,ph,type])=>(
                <div key={lbl as string} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:10, fontWeight:600, color:T.textSub, display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 }}>{lbl as string}</label>
                  <input value={val as string} onChange={e=>(setter as (v:string)=>void)(e.target.value)} placeholder={ph as string} type={type as string}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${T.border2}`, background:T.cardBg2, color:T.text, fontSize:13 }} />
                </div>
              ))}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:10, fontWeight:600, color:T.textSub, display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 }}>Role</label>
                <select value={role} onChange={e=>setRole(e.target.value)} style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${T.border2}`, background:T.cardBg2, color:T.text, fontSize:13, cursor:'pointer' }}>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              {msg&&(
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:7, marginBottom:12, fontSize:12, background:status==='success'?T.greenLight:T.redLight, color:status==='success'?T.green:T.red }}>
                  {status==='success'?<CheckCircle size={12}/>:<AlertCircle size={12}/>} {msg}
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleCreate} disabled={!uname||!pass||!fname||status==='loading'}
                  style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:T.accent, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:!uname||!pass||!fname?0.5:1 }}>
                  {status==='loading'?<><Loader size={13} style={{ animation:'spin 1s linear infinite' }}/>Creating...</>:<><UserPlus size={13}/>Create</>}
                </button>
                <button onClick={()=>{setShowModal(false);reset();}} style={{ padding:'10px 16px', borderRadius:8, border:`1px solid ${T.border2}`, background:T.cardBg2, fontSize:13, color:T.textSub, cursor:'pointer' }}>Cancel</button>
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
  return <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border:primary?'none':`1px solid ${T.border2}`, background:primary?T.accent:T.cardBg, color:primary?'#fff':T.textSub, boxShadow:T.shadow }}>{icon}{label}</button>;
}
function Skel({ w }: { w: number }) {
  return <div style={{ width:w, height:12, borderRadius:3, background:`linear-gradient(90deg,${T.cardBg2} 0px,${T.hover} 80px,${T.cardBg2} 160px)`, backgroundSize:'400px 100%', animation:'shimmer 1.4s infinite linear' }} />;
}
