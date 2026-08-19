import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, CameraOff, Upload, Search, RefreshCw,
  CheckCircle2, XCircle, Video, ImagePlus, Loader,
  User, Building2, Clock, Hash, ScanFace,
} from 'lucide-react';
import { recognizeFace, fetchLog, detectFaces } from '../api';

interface BBox { x: number; y: number; width: number; height: number; }

interface DetectResult {
  face_detected: boolean;
  number_of_faces: number;
  image_width: number;
  image_height: number;
  faces: BBox[];
}

interface LogEntry {
  employee_id: string;
  name: string;
  department: string;
  time: string;
  status: 'Matched' | 'Unknown';
  similarity: number;
}

interface RecognitionResult {
  matched: boolean;
  employee_id?: string;
  name: string;
  department?: string;
  time: string;
  similarity: number;
}

type Mode = 'upload' | 'camera';

// How long a face must be continuously visible before auto-recognizing (ms)
const STABLE_MS = 2000;

export default function RecognitionPanel() {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);  // bbox overlay
  const captureRef   = useRef<HTMLCanvasElement>(null);  // hidden, for grabbing frames
  const streamRef    = useRef<MediaStream | null>(null);
  const detectTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef      = useRef<HTMLInputElement>(null);

  const [mode, setMode]                   = useState<Mode>('upload');
  const [cameraOn, setCameraOn]           = useState(false);
  const [result, setResult]               = useState<RecognitionResult | null>(null);
  const [log, setLog]                     = useState<LogEntry[]>([]);
  const [recognizing, setRecognizing]     = useState(false);
  const [detecting, setDetecting]         = useState(false);
  const [faceVisible, setFaceVisible]     = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadBlob, setUploadBlob]       = useState<Blob | null>(null);

  const refreshLog = useCallback(async () => {
    try { const d = await fetchLog(); setLog(d.log ?? []); } catch { /**/ }
  }, []);

  // ── Draw bounding boxes on overlay canvas ─────────────────────────
  const drawBoxes = useCallback((
    detect: DetectResult,
    videoW: number,
    videoH: number,
  ) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = videoW;
    canvas.height = videoH;
    ctx.clearRect(0, 0, videoW, videoH);

    if (!detect.face_detected) return;

    // Scale from image coords to display coords
    const scaleX = videoW  / (detect.image_width  || videoW);
    const scaleY = videoH / (detect.image_height || videoH);

    detect.faces.forEach(box => {
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.width  * scaleX;
      const h = box.height * scaleY;

      // Outer glow
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur  = 12;

      // Box
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth   = 2.5;
      ctx.strokeRect(x, y, w, h);

      ctx.shadowBlur = 0;

      // Corner accents
      const cs = 16; // corner size
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth   = 3;
      // top-left
      ctx.beginPath(); ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y); ctx.stroke();
      // top-right
      ctx.beginPath(); ctx.moveTo(x + w - cs, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cs); ctx.stroke();
      // bottom-left
      ctx.beginPath(); ctx.moveTo(x, y + h - cs); ctx.lineTo(x, y + h); ctx.lineTo(x + cs, y + h); ctx.stroke();
      // bottom-right
      ctx.beginPath(); ctx.moveTo(x + w - cs, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cs); ctx.stroke();

      // Label
      ctx.fillStyle = '#22c55e';
      ctx.font      = 'bold 11px Inter, sans-serif';
      ctx.fillText('Face Detected', x + 4, y - 6);
    });
  }, []);

  // ── Grab a frame blob from the video ──────────────────────────────
  const grabFrame = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const video  = videoRef.current;
      const canvas = captureRef.current;
      if (!video || !canvas) return resolve(null);
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    });
  }, []);

  // ── Detection loop (runs every 800ms while camera is on) ──────────
  const runDetect = useCallback(async () => {
    if (detecting) return;
    setDetecting(true);
    try {
      const blob = await grabFrame();
      if (!blob) return;

      const res: DetectResult = await detectFaces(blob);
      const video = videoRef.current;
      const vw = video?.clientWidth  || 640;
      const vh = video?.clientHeight || 480;

      drawBoxes(res, vw, vh);
      setFaceVisible(res.face_detected && res.number_of_faces === 1);

      if (!res.face_detected || res.number_of_faces !== 1) {
        // Clear stable timer if face disappears
        if (stableTimerRef.current) {
          clearTimeout(stableTimerRef.current);
          stableTimerRef.current = null;
        }
      }
    } catch { /**/ } finally {
      setDetecting(false);
    }
  }, [detecting, drawBoxes, grabFrame]);

  // ── Start stable-face timer → auto-recognize ──────────────────────
  useEffect(() => {
    if (!cameraOn) return;

    if (faceVisible && !recognizing) {
      if (!stableTimerRef.current) {
        stableTimerRef.current = setTimeout(async () => {
          stableTimerRef.current = null;
          const blob = await grabFrame();
          if (blob) await runRecognition(blob);
        }, STABLE_MS);
      }
    } else {
      if (stableTimerRef.current) {
        clearTimeout(stableTimerRef.current);
        stableTimerRef.current = null;
      }
    }
  }, [faceVisible, cameraOn, recognizing]);

  const [devices, setDevices]             = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [camError, setCamError]           = useState('');

  // Load available cameras on mount
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(all => {
      const cams = all.filter(d => d.kind === 'videoinput');
      setDevices(cams);
      if (cams.length > 0) setSelectedDeviceId(cams[0].deviceId);
    }).catch(() => {});
  }, []);

  // ── Camera on/off ─────────────────────────────────────────────────
  const startCamera = async () => {
    setCamError('');
    try {
      // Re-enumerate to get labels (requires permission first time)
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const cams = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(cams);

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        // Wait for metadata before playing — fixes green screen with virtual cameras
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });
        await video.play();
      }
      setCameraOn(true);
      setResult(null);
      detectTimerRef.current = setInterval(runDetect, 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera error';
      setCamError(msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Camera permission denied. Allow camera access in your browser.'
        : 'Could not open camera: ' + msg);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (detectTimerRef.current) clearInterval(detectTimerRef.current);
    if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
    detectTimerRef.current = null;
    stableTimerRef.current = null;
    // Clear overlay
    const ctx = overlayRef.current?.getContext('2d');
    if (ctx && overlayRef.current) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    setCameraOn(false);
    setFaceVisible(false);
    setResult(null);
  };

  // ── Upload mode ───────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPreview(URL.createObjectURL(file));
    setUploadBlob(file);
    setResult(null);
  };

  // ── Shared recognition ────────────────────────────────────────────
  const runRecognition = async (blob: Blob) => {
    setRecognizing(true);
    try {
      const res = await recognizeFace(blob);
      setResult(res);
      await refreshLog();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Recognition failed');
    } finally {
      setRecognizing(false);
    }
  };

  useEffect(() => {
    refreshLog();
    return () => { stopCamera(); };
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 28,
      flex: 1, minWidth: 340,
      boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
      border: '1px solid #e8eaf0',
    }}>

      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ background: '#ecfdf5', borderRadius: 8, padding: 7, display: 'flex' }}>
          <ScanFace size={18} color="#059669" strokeWidth={1.8} />
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Live Recognition</h2>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            Face is auto-detected and recognized when stable
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: '#f1f3f7', margin: '16px 0' }} />

      {/* Mode toggle */}
      <div style={{
        display: 'flex', background: '#f1f5f9',
        borderRadius: 10, padding: 4, marginBottom: 18,
      }}>
        {(['upload', 'camera'] as Mode[]).map(m => (
          <button key={m}
            onClick={() => { setMode(m); if (m !== 'camera') stopCamera(); setResult(null); }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
              fontWeight: 600, fontSize: 12,
              background: mode === m ? '#fff'        : 'transparent',
              color:      mode === m ? '#1e293b'     : '#94a3b8',
              boxShadow:  mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}>
            {m === 'upload'
              ? <><ImagePlus size={13} /> Upload Image</>
              : <><Video size={13} />     Live Camera</>}
          </button>
        ))}
      </div>

      {/* ── UPLOAD MODE ── */}
      {mode === 'upload' && (
        <div style={{ marginBottom: 16 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${uploadPreview ? '#a78bfa' : '#e2e8f0'}`,
              borderRadius: 10, minHeight: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', overflow: 'hidden', background: '#f8fafc',
              transition: 'border-color 0.2s',
            }}
          >
            {uploadPreview
              ? <img src={uploadPreview} alt="preview"
                  style={{ width: '100%', maxHeight: 240, objectFit: 'contain' }} />
              : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
                  <div style={{
                    background: '#f1f5f9', borderRadius: 12, width: 56, height: 56,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}>
                    <Upload size={24} color="#94a3b8" />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Click to select an image</p>
                  <p style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG or WEBP</p>
                </div>
              )
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleFileChange} />

          <button
            onClick={() => uploadBlob && runRecognition(uploadBlob)}
            disabled={!uploadBlob || recognizing}
            style={{
              width: '100%', marginTop: 10, padding: '11px 0',
              borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 13,
              background: uploadBlob && !recognizing
                ? 'linear-gradient(135deg, #059669, #047857)' : '#e2e8f0',
              color: uploadBlob && !recognizing ? '#fff' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: uploadBlob && !recognizing ? '0 4px 12px rgba(5,150,105,0.25)' : 'none',
              transition: 'all 0.2s',
            }}>
            {recognizing
              ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Recognizing...</>
              : <><Search size={14} /> Recognize Face</>}
          </button>
        </div>
      )}

      {/* ── CAMERA MODE ── */}
      {mode === 'camera' && (
        <div style={{ marginBottom: 16 }}>

          {/* Camera device selector */}
          {devices.length > 1 && !cameraOn && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                Select Camera
              </label>
              <select
                value={selectedDeviceId}
                onChange={e => setSelectedDeviceId(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 7,
                  border: '1px solid #e2e8f0', fontSize: 12, background: '#f8fafc',
                }}
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error message */}
          {camError && (
            <div style={{
              marginBottom: 10, padding: '9px 12px', borderRadius: 8,
              background: '#fef2f2', border: '1px solid #fecaca',
              fontSize: 12, color: '#dc2626', display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <XCircle size={14} /> {camError}
            </div>
          )}
          {/* Video + overlay stacked */}
          <div style={{
            position: 'relative', background: '#0f172a',
            borderRadius: 10, overflow: 'hidden', minHeight: 240,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <video ref={videoRef} autoPlay muted playsInline
              style={{ width: '100%', display: 'block', background: '#000' }} />

            {/* Overlay canvas — sits exactly on top of video */}
            <canvas ref={overlayRef} style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              pointerEvents: 'none',
            }} />

            {/* Hidden capture canvas */}
            <canvas ref={captureRef} style={{ display: 'none' }} />

            {!cameraOn && (
              <div style={{
                position: 'absolute', textAlign: 'center', color: '#475569',
              }}>
                <CameraOff size={32} color="#475569" style={{ margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: 12 }}>Camera is off</p>
              </div>
            )}

            {/* Top-left status */}
            {cameraOn && (
              <div style={{
                position: 'absolute', top: 10, left: 10,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                borderRadius: 20, padding: '4px 12px', fontSize: 11,
                color: '#fff', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                  background: faceVisible ? '#22c55e' : '#f59e0b',
                }} />
                {faceVisible ? 'Face detected' : 'Scanning...'}
              </div>
            )}

            {/* Top-right button */}
            <button onClick={cameraOn ? stopCamera : startCamera} style={{
              position: 'absolute', top: 10, right: 10,
              background: cameraOn ? '#ef4444' : '#22c55e',
              color: '#fff', border: 'none', borderRadius: 7,
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              {cameraOn
                ? <><CameraOff size={13} /> Stop</>
                : <><Camera    size={13} /> Start</>}
            </button>

            {/* Recognizing spinner overlay */}
            {recognizing && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <Loader size={28} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Recognizing...</span>
              </div>
            )}
          </div>

          {cameraOn && (
            <p style={{ fontSize: 11, textAlign: 'center', color: '#94a3b8', marginTop: 8 }}>
              Hold face steady for {STABLE_MS / 1000}s to trigger automatic recognition
            </p>
          )}
        </div>
      )}

      {/* ── Recognition Result ── */}
      {result && (
        <div style={{
          border: `1px solid ${result.matched ? '#bbf7d0' : '#fecaca'}`,
          background: result.matched ? '#f0fdf4' : '#fef2f2',
          borderRadius: 10, padding: 16, marginBottom: 16,
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 12 }}>
            Recognition Result
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: result.matched ? '#dcfce7' : '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {result.matched
                ? <CheckCircle2 size={26} color="#16a34a" />
                : <XCircle      size={26} color="#dc2626" />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                fontWeight: 800, fontSize: 16,
                color: result.matched ? '#15803d' : '#dc2626', marginBottom: 8,
              }}>
                {result.matched ? 'MATCHED' : 'NOT RECOGNIZED'}
              </p>
              {result.matched ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                  <ResultItem icon={<Hash       size={11} />} label="ID"         value={result.employee_id ?? '—'} />
                  <ResultItem icon={<User       size={11} />} label="Name"       value={result.name} />
                  <ResultItem icon={<Building2  size={11} />} label="Department" value={result.department ?? '—'} />
                  <ResultItem icon={<Clock      size={11} />} label="Time"       value={result.time} />
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                  No matching employee found — similarity: <strong>{result.similarity}</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Log table ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' }}>
            Recognition Log
          </p>
          <button onClick={refreshLog} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, border: '1px solid #e2e8f0',
            borderRadius: 6, padding: '4px 10px', background: '#fff', color: '#64748b',
          }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['#', 'Employee ID', 'Name', 'Time', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '9px 12px',
                    color: '#64748b', fontWeight: 600, fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 28, color: '#cbd5e1' }}>
                    <Search size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
                    No recognition events yet
                  </td>
                </tr>
              )}
              {log.map((entry, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid #f8fafc',
                  background: i % 2 === 0 ? '#fff' : '#fafbfd',
                }}>
                  <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{entry.employee_id}</td>
                  <td style={{ padding: '9px 12px' }}>{entry.name}</td>
                  <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{entry.time}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: entry.status === 'Matched' ? '#dcfce7' : '#fee2e2',
                      color:      entry.status === 'Matched' ? '#16a34a' : '#dc2626',
                    }}>
                      {entry.status === 'Matched'
                        ? <CheckCircle2 size={10} />
                        : <XCircle      size={10} />}
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ResultItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', marginBottom: 1 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{value}</span>
    </div>
  );
}
