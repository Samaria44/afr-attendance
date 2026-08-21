import { useState } from 'react';
import { Fingerprint, User, Lock, Eye, EyeOff, Loader, AlertCircle, ShieldCheck } from 'lucide-react';
import { login, setupAdmin } from '../api';
import type { AuthUser } from '../auth';
import { T } from '../theme';

interface Props {
  onLogin: (user: AuthUser) => void;
  needsSetup: boolean;
}

export default function LoginPage({ onLogin, needsSetup }: Props) {
  const [mode, setMode]         = useState<'login' | 'setup'>(needsSetup ? 'setup' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'setup') {
        await setupAdmin(username, password, fullName);
      }
      const data = await login(username, password);
      onLogin(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: T.appBg,
    }}>
      {/* Left panel — dark branded side */}
      <div style={{
        width: '42%',
        background: T.sidebarBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}
        className="login-left"
      >
        {/* Background decorative circles */}
        <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:`${T.accent}18`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:`${T.accent}12`, pointerEvents:'none' }} />

        {/* Logo */}
        <div style={{ marginBottom:36, textAlign:'center', position:'relative' }}>
          <div style={{
            width:80, height:80, borderRadius:20,
            background:`linear-gradient(135deg, ${T.accent}44, ${T.accent}22)`,
            border:`2px solid ${T.accent}66`,
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 18px',
            boxShadow:`0 8px 32px ${T.accent}33`,
          }}>
            <Fingerprint size={40} color={T.accentMid} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'#fff', marginBottom:6, letterSpacing:-0.5 }}>
            AFR System
          </h1>
          <p style={{ fontSize:13, color:T.sidebarSub, letterSpacing:2, textTransform:'uppercase' }}>
            Automated Attendance
          </p>
        </div>

        {/* Feature list */}
        <div style={{ width:'100%', maxWidth:300, display:'flex', flexDirection:'column', gap:14 }}>
          {[
            { icon:<ShieldCheck size={16}/>, title:'Secure Access', desc:'Role-based permissions' },
            { icon:<Fingerprint size={16}/>, title:'Face Recognition', desc:'ArcFace AI technology' },
            { icon:<User size={16}/>,        title:'Smart Attendance', desc:'Auto check-in & checkout' },
          ].map(f => (
            <div key={f.title} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ background:`${T.accent}33`, borderRadius:8, padding:8, color:T.accentMid, display:'flex', flexShrink:0 }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{f.title}</div>
                <div style={{ fontSize:11, color:T.sidebarSub }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ position:'absolute', bottom:20, fontSize:11, color:T.sidebarDim }}>
          © 2026 AFR Attendance System
        </p>
      </div>

      {/* Right panel — login form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
      }}>
        <div style={{ width:'100%', maxWidth:420 }}>

          {/* Greeting */}
          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:26, fontWeight:800, color:T.text, marginBottom:6 }}>
              {mode === 'setup' ? 'Create Admin Account' : 'Welcome back'}
            </h2>
            <p style={{ fontSize:14, color:T.textSub }}>
              {mode === 'setup'
                ? 'Set up your administrator account to get started'
                : 'Sign in to access the AFR Attendance System'}
            </p>
          </div>

          {/* Tab toggle — only when not forced setup */}
          {!needsSetup && (
            <div style={{
              display:'flex', background:T.cardBg2, borderRadius:10,
              padding:4, marginBottom:28, border:`1px solid ${T.border}`,
            }}>
              {(['login','setup'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(''); }}
                  style={{
                    flex:1, padding:'8px 0', borderRadius:8, border:'none',
                    fontWeight:600, fontSize:13, cursor:'pointer',
                    background: mode===m ? T.accent : 'transparent',
                    color:      mode===m ? '#fff'   : T.textSub,
                    boxShadow:  mode===m ? `0 2px 8px ${T.accent}44` : 'none',
                    transition: 'all 0.2s',
                  }}>
                  {m === 'login' ? 'Sign In' : 'Create Admin'}
                </button>
              ))}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {mode === 'setup' && (
              <InputField
                label="Full Name"
                icon={<User size={15} color={T.textDim} />}
                value={fullName}
                onChange={setFullName}
                placeholder="Your full name"
                type="text"
                required
              />
            )}

            <InputField
              label="Username"
              icon={<User size={15} color={T.textDim} />}
              value={username}
              onChange={setUsername}
              placeholder="Enter username"
              type="text"
              required
            />

            <div>
              <label style={{ fontSize:12, fontWeight:600, color:T.text, display:'block', marginBottom:6 }}>
                Password
              </label>
              <div style={{
                display:'flex', alignItems:'center', gap:10,
                border:`1.5px solid ${T.border2}`, borderRadius:10,
                padding:'11px 14px', background:T.cardBg,
                transition:'border-color 0.2s',
              }}
                onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.accent}
                onBlurCapture={e  => (e.currentTarget as HTMLDivElement).style.borderColor = T.border2}
              >
                <Lock size={15} color={T.textDim} style={{ flexShrink:0 }} />
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  style={{ border:'none', outline:'none', background:'transparent', fontSize:14, color:T.text, flex:1 }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:T.textDim, display:'flex', flexShrink:0 }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'10px 14px', borderRadius:9,
                background:T.redLight, border:`1px solid ${T.red}22`,
                fontSize:13, color:T.red,
              }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              marginTop:4, padding:'13px 0', borderRadius:10, border:'none',
              background: loading ? `${T.accent}99` : T.accent,
              color:'#fff', fontWeight:700, fontSize:14, cursor: loading ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow:`0 4px 16px ${T.accent}44`,
              transition:'all 0.2s',
            }}>
              {loading
                ? <><Loader size={16} style={{ animation:'spin 1s linear infinite' }} /> Please wait...</>
                : mode === 'setup' ? 'Create Account & Sign In' : 'Sign In'
              }
            </button>
          </form>

          {/* Footer */}
          <p style={{ textAlign:'center', fontSize:11, color:T.textDim, marginTop:28 }}>
            AFR Face Recognition · Attendance Management System
          </p>
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function InputField({ label, icon, value, onChange, placeholder, type, required }: {
  label: string; icon: React.ReactNode; value: string;
  onChange: (v: string) => void; placeholder: string;
  type: string; required?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize:12, fontWeight:600, color:T.text, display:'block', marginBottom:6 }}>
        {label}
      </label>
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        border:`1.5px solid ${T.border2}`, borderRadius:10,
        padding:'11px 14px', background:T.cardBg,
        transition:'border-color 0.2s',
      }}
        onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.accent}
        onBlurCapture={e  => (e.currentTarget as HTMLDivElement).style.borderColor = T.border2}
      >
        {icon}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          required={required}
          style={{ border:'none', outline:'none', background:'transparent', fontSize:14, color:T.text, flex:1 }}
        />
      </div>
    </div>
  );
}
