import { useState } from 'react';
import { ScanFace, User, Lock, Loader, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { login, setupAdmin } from '../api';
import type { AuthUser } from '../auth';

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
        // Auto-login after setup
        const data = await login(username, password);
        onLogin(data.user);
      } else {
        const data = await login(username, password);
        onLogin(data.user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 400,
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            background: 'linear-gradient(135deg, #7c3aed, #5b4fcf)',
            borderRadius: 14, width: 60, height: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 20px rgba(124,58,237,0.35)',
          }}>
            <ScanFace size={30} color="#fff" strokeWidth={1.8} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
            AFR Attendance System
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            {mode === 'setup' ? 'Create your admin account to get started' : 'Sign in to your account'}
          </p>
        </div>

        {/* Setup / Login toggle — only shown when not forced setup */}
        {!needsSetup && (
          <div style={{
            display: 'flex', background: '#f1f5f9',
            borderRadius: 10, padding: 4, marginBottom: 24,
          }}>
            {(['login', 'setup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
                  fontWeight: 600, fontSize: 12,
                  background: mode === m ? '#fff' : 'transparent',
                  color:      mode === m ? '#1e293b' : '#94a3b8',
                  boxShadow:  mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s',
                }}>
                {m === 'login' ? 'Sign In' : 'Create Admin'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'setup' && (
            <Field label="Full Name">
              <div style={inputWrap}>
                <User size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
                <input
                  value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name" required style={inputStyle}
                />
              </div>
            </Field>
          )}

          <Field label="Username">
            <div style={inputWrap}>
              <User size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
              <input
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter username" required autoComplete="username"
                style={inputStyle}
              />
            </div>
          </Field>

          <Field label="Password">
            <div style={inputWrap}>
              <Lock size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
              <input
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter password" required
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, padding: '10px 12px', marginBottom: 16,
              fontSize: 13, color: '#dc2626',
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px 0', borderRadius: 9,
            border: 'none', fontWeight: 700, fontSize: 14,
            background: loading ? '#c4b5fd' : 'linear-gradient(135deg, #7c3aed, #5b4fcf)',
            color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
            transition: 'opacity 0.2s',
          }}>
            {loading
              ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Please wait...</>
              : mode === 'setup' ? 'Create Admin Account' : 'Sign In'
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 20 }}>
          AFR Face Recognition · Attendance System
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '10px 12px', background: '#f8fafc',
};

const inputStyle: React.CSSProperties = {
  border: 'none', outline: 'none', background: 'transparent',
  fontSize: 13, color: '#1e293b', width: '100%',
};
