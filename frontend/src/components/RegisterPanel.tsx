import { useRef, useState } from 'react';
import {
  UserPlus, Trash2, RotateCcw, CheckCircle,
  AlertCircle, Upload, ChevronDown, Loader, Lock,
} from 'lucide-react';
import { registerImage } from '../api';
import { can } from '../permissions';
import { getUser } from '../auth';

const DEPARTMENTS = [
  'Software Engineering', 'Human Resources', 'Finance',
  'Operations', 'Marketing', 'Administration',
];

export default function RegisterPanel() {
  const user = getUser();
  const canRegister = can(user, 'face:register_employee');

  // Viewer: show locked panel
  if (!canRegister) {
    return (
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, flex: 1, minWidth: 340,
        boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
        border: '1px solid #e8eaf0', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12,
      }}>
        <div style={{ background: '#f1f5f9', borderRadius: 12, padding: 16, display: 'flex' }}>
          <Lock size={28} color="#94a3b8" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Access Restricted</p>
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', maxWidth: 220 }}>
          Your role <strong>{user?.role}</strong> does not have permission to register employees.
        </p>
      </div>
    );
  }
  const [employeeId, setEmployeeId]   = useState('');
  const [name, setName]               = useState('');
  const [department, setDepartment]   = useState(DEPARTMENTS[0]);
  const [images, setImages]           = useState<(string | null)[]>([null, null, null]);
  const [blobs, setBlobs]             = useState<(Blob | null)[]>([null, null, null]);
  const [status, setStatus]           = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage]         = useState('');
  const [progress, setProgress]       = useState(0);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleFile = (idx: number, file: File) => {
    setImages(prev => { const c = [...prev]; c[idx] = URL.createObjectURL(file); return c; });
    setBlobs(prev  => { const c = [...prev]; c[idx] = file; return c; });
  };

  const handleDelete = (idx: number) => {
    setImages(prev => { const c = [...prev]; c[idx] = null; return c; });
    setBlobs(prev  => { const c = [...prev]; c[idx] = null; return c; });
  };

  const filledCount = blobs.filter(Boolean).length;
  const canSubmit   = employeeId.trim() && name.trim() && filledCount === 3;

  const handleRegister = async () => {
    if (!canSubmit) return;
    setStatus('loading');
    setMessage('');
    setProgress(0);
    try {
      for (let i = 0; i < 3; i++) {
        await registerImage(employeeId, name, department, blobs[i]!, `img_${i + 1}.jpg`);
        setProgress(i + 1);
      }
      setStatus('success');
      setMessage('Employee registered successfully!');
      setEmployeeId(''); setName(''); setDepartment(DEPARTMENTS[0]);
      setImages([null, null, null]); setBlobs([null, null, null]);
      setProgress(0);
    } catch (e: unknown) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Registration failed');
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: 28,
      flex: 1,
      minWidth: 340,
      boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
      border: '1px solid #e8eaf0',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ background: '#ede9fe', borderRadius: 8, padding: 7, display: 'flex' }}>
          <UserPlus size={18} color="#7c3aed" />
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Register Employee</h2>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            Capture exactly 3 clear face pictures
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: '#f1f3f7', margin: '16px 0' }} />

      {/* Fields */}
      <Field label="Employee ID">
        <input
          value={employeeId}
          onChange={e => setEmployeeId(e.target.value)}
          placeholder="e.g. EMP-001"
          style={inputStyle}
        />
      </Field>
      <Field label="Employee Name">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Full name"
          style={inputStyle}
        />
      </Field>
      <Field label="Department">
        <div style={{ position: 'relative' }}>
          <select value={department} onChange={e => setDepartment(e.target.value)}
            style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </Field>

      {/* Image slots */}
      <div style={{ marginTop: 20, marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
            Face Images
          </label>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 10px',
            borderRadius: 20,
            background: filledCount === 3 ? '#dcfce7' : '#f1f5f9',
            color:      filledCount === 3 ? '#16a34a' : '#64748b',
          }}>
            {filledCount} / 3 uploaded
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {images.map((img, idx) => (
            <div key={idx} style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5, textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Photo {idx + 1}
              </p>
              <div
                onClick={() => !img && inputRefs[idx].current?.click()}
                style={{
                  aspectRatio: '1',
                  borderRadius: 10,
                  border: img ? '2px solid #c4b5fd' : '2px dashed #d1d5db',
                  background: img ? '#000' : '#f8fafc',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: img ? 'default' : 'pointer',
                  transition: 'border-color 0.2s',
                  position: 'relative',
                }}
              >
                {img
                  ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (
                    <div style={{ textAlign: 'center', color: '#c4cad4' }}>
                      <Upload size={20} />
                      <p style={{ fontSize: 9, marginTop: 4 }}>Click to upload</p>
                    </div>
                  )
                }
              </div>
              <input ref={inputRefs[idx]} type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handleFile(idx, e.target.files[0])} />
              {img && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button onClick={() => inputRefs[idx].current?.click()} style={smallBtn}>
                    <RotateCcw size={11} /> <span>Retake</span>
                  </button>
                  <button onClick={() => handleDelete(idx)} style={{ ...smallBtn, color: '#ef4444', borderColor: '#fca5a5' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar while loading */}
      {status === 'loading' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
            <span>Uploading images...</span>
            <span>{progress}/3</span>
          </div>
          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#7c3aed',
              width: `${(progress / 3) * 100}%`, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleRegister}
        disabled={!canSubmit || status === 'loading'}
        style={{
          width: '100%', marginTop: 20, padding: '12px 0', borderRadius: 9,
          border: 'none', fontWeight: 700, fontSize: 13,
          background: canSubmit && status !== 'loading'
            ? 'linear-gradient(135deg, #7c3aed, #5b4fcf)'
            : '#e2e8f0',
          color: canSubmit && status !== 'loading' ? '#fff' : '#94a3b8',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'opacity 0.2s',
          boxShadow: canSubmit && status !== 'loading' ? '0 4px 12px rgba(124,58,237,0.3)' : 'none',
        }}
      >
        {status === 'loading'
          ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Registering...</>
          : <><UserPlus size={15} /> Register Employee</>
        }
      </button>

      {/* Feedback */}
      {message && status !== 'loading' && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
          background: status === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${status === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color:  status === 'success' ? '#16a34a'  : '#dc2626',
        }}>
          {status === 'success'
            ? <CheckCircle size={15} />
            : <AlertCircle size={15} />}
          {message}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b',
  background: '#f8fafc', transition: 'border-color 0.2s',
};

const smallBtn: React.CSSProperties = {
  flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 6,
  border: '1px solid #e2e8f0', background: '#fff', color: '#64748b',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
};
