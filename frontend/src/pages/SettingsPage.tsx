import { useState } from 'react';
import { Save, Server, SlidersHorizontal, UserCircle, CheckCircle } from 'lucide-react';
import { getUser } from '../auth';
import { T } from '../theme';

const KEY = 'afr_settings';
interface Settings { similarityThreshold: number; stableFaceMs: number; }
const load = (): Settings => {
  try { return { similarityThreshold:0.4, stableFaceMs:2000, ...JSON.parse(localStorage.getItem(KEY)??'{}') }; }
  catch { return { similarityThreshold:0.4, stableFaceMs:2000 }; }
};

export default function SettingsPage() {
  const user      = getUser();
  const s         = load();
  const [thr, setThr] = useState(s.similarityThreshold);
  const [ms, setMs]   = useState(s.stableFaceMs);
  const [flash, setFlash] = useState(false);

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify({ similarityThreshold:thr, stableFaceMs:ms }));
    setFlash(true); setTimeout(()=>setFlash(false), 2000);
  };

  return (
    <div className="fade-in" style={{ padding:'24px 28px', maxWidth:780 }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:T.text, marginBottom:3 }}>Settings</h1>
        <p style={{ fontSize:13, color:T.textSub }}>System configuration and preferences</p>
      </div>

      <Card icon={<Server size={15} color={T.accent} />} title="System Information" accent={T.accent}>
        <Row label="Application"  value="AFR Attendance System v1.0.0" />
        <Row label="Environment"  value={import.meta.env.MODE??'development'} />
        <Row label="Database"     value="MongoDB — Connected" vc={T.green} />
        <Row label="ML Model"     value="InsightFace buffalo_sc · ArcFace 512-dim" />
        <Row label="Backend"      value={import.meta.env.VITE_API_URL??'http://localhost:8000'} />
      </Card>

      <Card icon={<SlidersHorizontal size={15} color={T.blue} />} title="Recognition Settings" accent={T.blue}>
        <div style={{ marginBottom:22 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>Similarity Threshold</div>
              <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>Higher = stricter matching. Default 0.40.</div>
            </div>
            <span style={{ fontSize:18, fontWeight:800, color:T.blue }}>{thr.toFixed(2)}</span>
          </div>
          <input type="range" min={0.3} max={0.7} step={0.01} value={thr} onChange={e=>setThr(parseFloat(e.target.value))}
            style={{ width:'100%', accentColor:T.blue }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:T.textDim, marginTop:3 }}>
            <span>0.30 (permissive)</span><span>0.70 (strict)</span>
          </div>
        </div>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>Stable Face Duration</div>
              <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>How long face must be visible before auto-recognition.</div>
            </div>
            <span style={{ fontSize:18, fontWeight:800, color:T.blue }}>{(ms/1000).toFixed(1)}s</span>
          </div>
          <input type="range" min={500} max={5000} step={500} value={ms} onChange={e=>setMs(parseInt(e.target.value))}
            style={{ width:'100%', accentColor:T.blue }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:T.textDim, marginTop:3 }}>
            <span>0.5s (fast)</span><span>5.0s (slow)</span>
          </div>
        </div>
      </Card>

      <Card icon={<UserCircle size={15} color={T.green} />} title="Your Account" accent={T.green}>
        <Row label="Username"  value={user?.username??'—'} />
        <Row label="Full Name" value={user?.full_name??'—'} />
        <Row label="Role"      value={user?.role ? user.role.charAt(0).toUpperCase()+user.role.slice(1) : '—'} />
      </Card>

      <button onClick={save} style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 24px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, background:flash?T.green:T.accent, color:'#fff', boxShadow:`0 4px 12px ${flash?T.green:T.accent}44`, transition:'all 0.25s' }}>
        {flash?<CheckCircle size={15}/>:<Save size={15}/>} {flash?'Saved!':'Save Settings'}
      </button>
    </div>
  );
}

function Card({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background:T.cardBg, borderRadius:T.r2, border:`1px solid ${T.border}`, marginBottom:18, boxShadow:T.shadow, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'13px 18px', borderBottom:`1px solid ${T.border}`, background:T.cardBg2 }}>
        <div style={{ background:`${accent}18`, borderRadius:7, padding:6, display:'flex' }}>{icon}</div>
        <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{title}</span>
      </div>
      <div style={{ padding:'16px 18px' }}>{children}</div>
    </div>
  );
}

function Row({ label, value, vc }: { label: string; value: string; vc?: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
      <span style={{ fontSize:12, color:T.textSub }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:600, color:vc??T.text }}>{value}</span>
    </div>
  );
}
