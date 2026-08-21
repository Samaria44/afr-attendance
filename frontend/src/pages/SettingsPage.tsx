import { useState } from 'react';
import { Save, UserCircle, CheckCircle, Settings, Camera, Shield, Clock, ChevronRight, Plus, Minus, ChevronDown } from 'lucide-react';
import { getUser } from '../auth';
import { T } from '../theme';

const KEY = 'afr_settings';
interface Settings {
  similarityThreshold: number;
  stableFaceMs: number;
  cameraCaptureDuration: number;
  cameraSelection: string;
  imageQuality: string;
  livenessDetection: boolean;
  attendanceMarking: string;
  frameCaptureInterval: number;
}
const load = (): Settings => {
  try {
    return {
      similarityThreshold: 0.4,
      stableFaceMs: 2000,
      cameraCaptureDuration: 3000,
      cameraSelection: 'default',
      imageQuality: 'high',
      livenessDetection: true,
      attendanceMarking: 'auto',
      frameCaptureInterval: 800,
      ...JSON.parse(localStorage.getItem(KEY) ?? '{}')
    };
  } catch {
    return {
      similarityThreshold: 0.4,
      stableFaceMs: 2000,
      cameraCaptureDuration: 3000,
      cameraSelection: 'default',
      imageQuality: 'high',
      livenessDetection: true,
      attendanceMarking: 'auto',
      frameCaptureInterval: 800
    };
  }
};

type TabType = 'general' | 'camera' | 'recognition' | 'attendance' | 'account';

export default function SettingsPage() {
  const user = getUser();
  const s = load();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [thr, setThr] = useState(s.similarityThreshold);
  const [ms, setMs] = useState(s.stableFaceMs);
  const [captureDuration, setCaptureDuration] = useState(s.cameraCaptureDuration);
  const [cameraSelection, setCameraSelection] = useState(s.cameraSelection);
  const [imageQuality, setImageQuality] = useState(s.imageQuality);
  const [livenessDetection, setLivenessDetection] = useState(s.livenessDetection);
  const [attendanceMarking, setAttendanceMarking] = useState(s.attendanceMarking);
  const [frameCaptureInterval, setFrameCaptureInterval] = useState(s.frameCaptureInterval);
  const [flash, setFlash] = useState(false);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    cameraSelection: true,
    autoCaptureDelay: true,
    imageQuality: true,
    livenessDetection: true,
    similarityThreshold: true,
    stableFaceDuration: true,
    frameCaptureInterval: true,
  });

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify({
      similarityThreshold: thr,
      stableFaceMs: ms,
      cameraCaptureDuration: captureDuration,
      cameraSelection,
      imageQuality,
      livenessDetection,
      attendanceMarking,
      frameCaptureInterval
    }));
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
  };

  const tabs = [
    { id: 'general' as TabType, label: 'General Settings', icon: <Settings size={16} /> },
    { id: 'camera' as TabType, label: 'Camera Settings', icon: <Camera size={16} /> },
    { id: 'recognition' as TabType, label: 'Recognition Settings', icon: <Shield size={16} /> },
    { id: 'attendance' as TabType, label: 'Attendance Settings', icon: <Clock size={16} /> },
    { id: 'account' as TabType, label: 'Account Settings', icon: <UserCircle size={16} /> },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', height: 'calc(100vh - 60px)', background: T.appBg }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: T.cardBg, borderRight: `1px solid ${T.border}`, padding: '20px 0' }}>
        <div style={{ padding: '0 20px', marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>Settings</h1>
          <p style={{ fontSize: 12, color: T.textSub }}>Configure your system</p>
        </div>
        <nav>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '12px 20px',
                border: 'none',
                background: activeTab === tab.id ? `${T.accent}15` : 'transparent',
                color: activeTab === tab.id ? T.accent : T.textSub,
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {activeTab === tab.id && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
        {activeTab === 'general' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6 }}>General Settings</h2>
              <p style={{ fontSize: 13, color: T.textSub }}>Configure system-wide preferences</p>
            </div>

            <CollapsibleCard
              title="Camera Selection"
              isOpen={openCards.cameraSelection}
              onToggle={() => setOpenCards(prev => ({ ...prev, cameraSelection: !prev.cameraSelection }))}
            >
              <SelectRow
                label="Camera Device"
                value={cameraSelection}
                onChange={setCameraSelection}
                options={[
                  { value: 'default', label: 'Default Camera' },
                  { value: 'front', label: 'Front Camera' },
                  { value: 'back', label: 'Back Camera' },
                  { value: 'external', label: 'External Camera' }
                ]}
                description="Select the camera device to use for face recognition"
              />
            </CollapsibleCard>

            <CollapsibleCard
              title="Auto Capture Delay"
              isOpen={openCards.autoCaptureDelay}
              onToggle={() => setOpenCards(prev => ({ ...prev, autoCaptureDelay: !prev.autoCaptureDelay }))}
            >
              <NumberRow
                label="Camera Capture Duration"
                value={captureDuration}
                onChange={setCaptureDuration}
                min={1000}
                max={10000}
                step={500}
                unit="s"
                divisor={1000}
                description="How long to wait before auto-capturing the face"
              />
            </CollapsibleCard>

            <CollapsibleCard
              title="Image Quality"
              isOpen={openCards.imageQuality}
              onToggle={() => setOpenCards(prev => ({ ...prev, imageQuality: !prev.imageQuality }))}
            >
              <SelectRow
                label="Quality Level"
                value={imageQuality}
                onChange={setImageQuality}
                options={[
                  { value: 'low', label: 'Low (Faster)' },
                  { value: 'medium', label: 'Medium (Balanced)' },
                  { value: 'high', label: 'High (Better Accuracy)' }
                ]}
                description="Higher quality may slow down recognition"
              />
            </CollapsibleCard>

            <CollapsibleCard
              title="Liveness Detection"
              isOpen={openCards.livenessDetection}
              onToggle={() => setOpenCards(prev => ({ ...prev, livenessDetection: !prev.livenessDetection }))}
            >
              <ToggleRow
                label="Enable Liveness Detection"
                value={livenessDetection}
                onChange={setLivenessDetection}
                description="Prevent spoofing with photo or video attacks"
              />
            </CollapsibleCard>
          </>
        )}

        {activeTab === 'camera' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6 }}>Camera Settings</h2>
              <p style={{ fontSize: 13, color: T.textSub }}>Configure camera and capture preferences</p>
            </div>
            <Card title="Camera Configuration">
              <SelectRow
                label="Camera Device"
                value={cameraSelection}
                onChange={setCameraSelection}
                options={[
                  { value: 'default', label: 'Default Camera' },
                  { value: 'front', label: 'Front Camera' },
                  { value: 'back', label: 'Back Camera' },
                  { value: 'external', label: 'External Camera' }
                ]}
                description="Select the camera device to use for face recognition"
              />
            </Card>

            <CollapsibleCard
              title="Frame Capture Interval"
              isOpen={openCards.frameCaptureInterval}
              onToggle={() => setOpenCards(prev => ({ ...prev, frameCaptureInterval: !prev.frameCaptureInterval }))}
            >
              <SelectRow
                label="Capture Interval"
                value={frameCaptureInterval.toString()}
                onChange={(val) => setFrameCaptureInterval(parseInt(val, 10))}
                options={[
                  { value: '300', label: '300 ms (0.3 sec)' },
                  { value: '500', label: '500 ms (0.5 sec)' },
                  { value: '800', label: '800 ms (0.8 sec)' },
                  { value: '1000', label: '1000 ms (1.0 sec)' },
                  { value: '1500', label: '1500 ms (1.5 sec)' },
                  { value: '2000', label: '2000 ms (2.0 sec)' }
                ]}
                description="Controls how frequently frames are captured for face detection. Lower values provide more frequent detection but increase CPU/network usage."
              />
            </CollapsibleCard>
          </>
        )}

        {activeTab === 'recognition' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6 }}>Recognition Settings</h2>
              <p style={{ fontSize: 13, color: T.textSub }}>Configure face recognition parameters</p>
            </div>
            <CollapsibleCard
              title="Recognition Confidence Threshold"
              isOpen={openCards.similarityThreshold}
              onToggle={() => setOpenCards(prev => ({ ...prev, similarityThreshold: !prev.similarityThreshold }))}
            >
              <NumberRow
                label="Similarity Threshold"
                value={thr}
                onChange={setThr}
                min={0.3}
                max={0.7}
                step={0.01}
                unit=""
                divisor={null}
                description="Higher = stricter matching. Default 0.40."
              />
            </CollapsibleCard>
            <CollapsibleCard
              title="Stable Face Duration"
              isOpen={openCards.stableFaceDuration}
              onToggle={() => setOpenCards(prev => ({ ...prev, stableFaceDuration: !prev.stableFaceDuration }))}
            >
              <NumberRow
                label="Stable Face Duration"
                value={ms}
                onChange={setMs}
                min={500}
                max={5000}
                step={500}
                unit="s"
                divisor={1000}
                description="How long face must be visible before auto-recognition."
              />
            </CollapsibleCard>
          </>
        )}

        {activeTab === 'attendance' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6 }}>Attendance Settings</h2>
              <p style={{ fontSize: 13, color: T.textSub }}>Configure attendance marking rules</p>
            </div>
            <Card title="Attendance Marking">
              <SelectRow
                label="Marking Mode"
                value={attendanceMarking}
                onChange={setAttendanceMarking}
                options={[
                  { value: 'auto', label: 'Automatic' },
                  { value: 'manual', label: 'Manual Confirmation' },
                  { value: 'hybrid', label: 'Hybrid (Auto with Review)' }
                ]}
                description="Choose how attendance is marked after recognition"
              />
            </Card>
          </>
        )}

        {activeTab === 'account' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6 }}>Account Settings</h2>
              <p style={{ fontSize: 13, color: T.textSub }}>Manage your account information</p>
            </div>
            <Card title="Your Account">
              <Row label="Username" value={user?.username ?? '—'} />
              <Row label="Full Name" value={user?.full_name ?? '—'} />
              <Row label="Role" value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'} />
            </Card>
            <Card title="System Information">
              <Row label="Application" value="AFR Attendance System v1.0.0" />
              <Row label="Environment" value={import.meta.env.MODE ?? 'development'} />
              <Row label="Database" value="MongoDB — Connected" vc={T.green} />
              <Row label="ML Model" value="InsightFace buffalo_sc · ArcFace 512-dim" />
              <Row label="Backend" value={import.meta.env.VITE_API_URL ?? 'http://localhost:8000'} />
            </Card>
          </>
        )}

        <button
          onClick={save}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 28px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
            background: flash ? T.green : T.accent,
            color: '#fff',
            boxShadow: `0 4px 12px ${flash ? T.green : T.accent}44`,
            transition: 'all 0.25s',
            marginTop: 24
          }}
        >
          {flash ? <CheckCircle size={16} /> : <Save size={16} />}
          {flash ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`, marginBottom: 18, boxShadow: T.shadow, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, background: T.cardBg2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function Row({ label, value, vc }: { label: string; value: string; vc?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.textSub }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: vc ?? T.text }}>{value}</span>
    </div>
  );
}

function SelectRow({ label, value, onChange, options, description }: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  description: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: T.textDim }}>{description}</div>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          minWidth: 200,
          padding: '8px 12px',
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.cardBg,
          color: T.text,
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({ label, value, onChange, description }: {
  label: string;
  value: boolean;
  onChange: (val: boolean) => void;
  description: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: T.textDim }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 48,
          height: 26,
          borderRadius: 13,
          border: 'none',
          cursor: 'pointer',
          background: value ? T.accent : T.border,
          position: 'relative',
          transition: 'all 0.2s'
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 3,
            left: value ? 25 : 3,
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
      </button>
    </div>
  );
}

function NumberRow({ label, value, onChange, min, max, step, unit, divisor, description }: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  divisor: number | null;
  description: string;
}) {
  const displayValue = divisor ? (value / divisor).toFixed(1) : value.toFixed(2);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: T.textDim }}>{description}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.cardBg,
            cursor: value <= min ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value <= min ? 0.5 : 1
          }}
        >
          <Minus size={16} color={T.text} />
        </button>
        <div style={{
          minWidth: 70,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 700,
          color: T.blue,
          padding: '6px 12px',
          background: T.cardBg2,
          borderRadius: 8,
          border: `1px solid ${T.border}`
        }}>
          {displayValue}{unit}
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.cardBg,
            cursor: value >= max ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value >= max ? 0.5 : 1
          }}
        >
          <Plus size={16} color={T.text} />
        </button>
      </div>
    </div>
  );
}

function CollapsibleCard({ title, isOpen, onToggle, children }: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: T.cardBg, borderRadius: T.r2, border: `1px solid ${T.border}`, marginBottom: 18, boxShadow: T.shadow, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          border: 'none',
          background: T.cardBg2,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</span>
        <ChevronDown
          size={18}
          color={T.textSub}
          style={{
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>
      {isOpen && (
        <div style={{ padding: '20px' }}>{children}</div>
      )}
    </div>
  );
}
