import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, CameraOff, Upload, CheckCircle2, XCircle,
  Loader, Clock, User, Building2, Hash, LogIn, LogOut, Download,
} from 'lucide-react';
import { recognizeFace, fetchLog, detectFaces } from '../api';
import { T } from '../theme';
import { getFacingMode, getStableFaceMs, getImageQuality, getSimilarityThreshold, getAttendanceMarking, getFrameCaptureInterval } from '../settings';

interface BBox { x: number; y: number; width: number; height: number; }
interface DetectResult {
  face_detected: boolean; number_of_faces: number;
  image_width: number; image_height: number; faces: BBox[];
}
interface LogEntry {
  employee_id: string; name: string; department: string;
  time: string; status: 'Matched' | 'Unknown'; similarity: number;
  type?: 'check_in' | 'check_out' | 'unknown';
}
interface RecognitionResult {
  matched: boolean; employee_id?: string; name: string;
  department?: string; time: string; similarity: number;
  type?: 'check_in' | 'check_out' | 'already_checked_in' | 'unknown';
  message?: string;
}

type LogFilter = 'all' | 'matched' | 'unknown';

export default function LiveRecognitionPage() {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);
  const captureRef  = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const detectTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  const [cameraOn, setCameraOn]             = useState(false);
  const [result, setResult]                 = useState<RecognitionResult | null>(null);
  const [log, setLog]                       = useState<LogEntry[]>([]);
  const [recognizing, setRecognizing]       = useState(false);
  const [detecting, setDetecting]           = useState(false);
  const [faceVisible, setFaceVisible]       = useState(false);
  const [capturedFrame, setCapturedFrame]   = useState<string | null>(null);
  const [logFilter, setLogFilter]           = useState<LogFilter>('all');
  const [logLoading, setLogLoading]         = useState(false);

  // ── Log fetch ──────────────────────────────────────────────────
  const refreshLog = useCallback(async () => {
    setLogLoading(true);
    try { const d = await fetchLog(50); setLog(d.log ?? []); } catch {/**/}
    finally { setLogLoading(false); }
  }, []);

  // ── Download log as CSV ───────────────────────────────────────
  const downloadLog = () => {
    const rows: string[] = [
      'Time,Employee ID,Name,Department,Status,Similarity,Type,Method',
    ];
    log.forEach(e => {
      // Quote fields that may contain spaces or special characters
      const time = `"${e.time}"`;
      const name = `"${e.name}"`;
      const department = `"${e.department}"`;
      const status = `"${e.status}"`;
      const type = `"${e.type || '—'}"`;
      rows.push(`${time},${e.employee_id},${name},${department},${status},${e.similarity},${type},Live Camera`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recognition_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Canvas: compute letterbox rect for objectFit:contain ──────
  const getVideoRect = useCallback(() => {
    const v = videoRef.current;
    if (!v) return null;
    const dispW = v.clientWidth,  dispH = v.clientHeight;
    const vidW  = v.videoWidth  || 640, vidH = v.videoHeight || 480;
    const scale = Math.min(dispW / vidW, dispH / vidH);
    const rendW = vidW * scale,   rendH = vidH * scale;
    const offX  = (dispW - rendW) / 2, offY = (dispH - rendH) / 2;
    return { dispW, dispH, rendW, rendH, offX, offY, scale };
  }, []);

  // ── Draw corner-bracket boxes only (no full rectangle) ────────
  const drawBoxes = useCallback((det: DetectResult) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = getVideoRect();
    if (!rect) return;
    canvas.width  = rect.dispW;
    canvas.height = rect.dispH;
    ctx.clearRect(0, 0, rect.dispW, rect.dispH);
    if (!det.face_detected) return;
    det.faces.forEach(box => {
      const x = rect.offX + box.x      * rect.scale;
      const y = rect.offY + box.y      * rect.scale;
      const w =             box.width  * rect.scale;
      const h =             box.height * rect.scale;
      const cs = Math.min(w, h) * 0.18; // corner size = 18% of face box
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur  = 10;
      // top-left
      ctx.beginPath(); ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y); ctx.stroke();
      // top-right
      ctx.beginPath(); ctx.moveTo(x + w - cs, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cs); ctx.stroke();
      // bottom-left
      ctx.beginPath(); ctx.moveTo(x, y + h - cs); ctx.lineTo(x, y + h); ctx.lineTo(x + cs, y + h); ctx.stroke();
      // bottom-right
      ctx.beginPath(); ctx.moveTo(x + w - cs, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cs); ctx.stroke();
    });
  }, [getVideoRect]);

  // ── Grab raw video frame as blob ──────────────────────────────
  const grabFrame = useCallback((): Promise<Blob | null> => new Promise(resolve => {
    const v = videoRef.current, c = captureRef.current;
    if (!v || !c) return resolve(null);
    c.width  = v.videoWidth  || 640;
    c.height = v.videoHeight || 480;
    c.getContext('2d')?.drawImage(v, 0, 0);
    c.toBlob(resolve, 'image/jpeg', getImageQuality());
  }), []);

  // ── Detect loop ───────────────────────────────────────────────
  const runDetect = useCallback(async () => {
    if (detecting) return;
    setDetecting(true);
    try {
      const blob = await grabFrame();
      if (!blob) return;
      const res: DetectResult = await detectFaces(blob);
      if (res) drawBoxes(res);
      setFaceVisible(!!res?.face_detected && res.number_of_faces === 1);
      if (!res?.face_detected || res.number_of_faces !== 1) {
        if (stableTimer.current) { clearTimeout(stableTimer.current); stableTimer.current = null; }
      }
    } catch {/**/} finally { setDetecting(false); }
  }, [detecting, drawBoxes, grabFrame]);

  // ── Auto-recognize when face stable ───────────────────────
  useEffect(() => {
    if (!cameraOn) return;
    if (faceVisible && !recognizing) {
      if (!stableTimer.current) {
        stableTimer.current = setTimeout(async () => {
          stableTimer.current = null;
          const blob = await grabFrame();
          if (blob) await runRecognition(blob);
        }, getStableFaceMs());
      }
    } else {
      if (stableTimer.current) { clearTimeout(stableTimer.current); stableTimer.current = null; }
    }
  }, [faceVisible, cameraOn, recognizing]);

  // ── Camera controls ───────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: getFacingMode() },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>(r => { videoRef.current!.onloadedmetadata = () => r(); });
        await videoRef.current.play();
      }
      setCameraOn(true); setResult(null); setCapturedFrame(null);
      const interval = getFrameCaptureInterval();
      detectTimer.current = setInterval(runDetect, interval);
    } catch { alert('Camera not available. Use Upload Photo instead.'); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (detectTimer.current) clearInterval(detectTimer.current);
    if (stableTimer.current) clearTimeout(stableTimer.current);
    const ctx = overlayRef.current?.getContext('2d');
    if (ctx && overlayRef.current) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    setCameraOn(false); setFaceVisible(false);
  };

  // ── Recognition ───────────────────────────────────────────────
  const runRecognition = async (blob: Blob) => {
    setRecognizing(true);
    setCapturedFrame(URL.createObjectURL(blob));
    try {
      const res = await recognizeFace(blob, getSimilarityThreshold(), getAttendanceMarking());
      setResult(res);
      await refreshLog();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Recognition failed'); }
    finally { setRecognizing(false); }
  };

  // ── Upload handler ────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setCapturedFrame(null);
    runRecognition(file);
  };

  useEffect(() => { refreshLog(); return () => { stopCamera(); }; }, []);

  // ── Filtered log ──────────────────────────────────────────────
  const filteredLog = log.filter(e => {
    if (logFilter === 'matched') return e.status === 'Matched';
    if (logFilter === 'unknown') return e.status === 'Unknown';
    return true;
  });

  // ── Parse time string "DD MMM YYYY  HH:MM:SS AM" ─────────────
  const parseTime = (t: string) => {
    const parts = t.split('  ');
    return { date: parts[0] ?? t, time: parts[1] ?? '' };
  };

  return (
    <div className="fade-in" style={{ padding: '24px 28px', minHeight: '100%' }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text }}>Live Recognition</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cameraOn ? T.green : T.textDim, display: 'inline-block', animation: cameraOn ? 'pulse-dot 1.5s infinite' : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: cameraOn ? T.green : T.textDim }}>{cameraOn ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* ── Main row: camera + result panel ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginBottom: 16 }}>

        {/* ── Camera feed ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden',
            background: '#111', aspectRatio: '16/9', width: '100%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}>
            {/* Video */}
            <video
              ref={videoRef} autoPlay muted playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
            {/* Canvas overlay */}
            <canvas
              ref={overlayRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />
            {/* Hidden capture canvas */}
            <canvas ref={captureRef} style={{ display: 'none' }} />

            {/* Camera off state */}
            {!cameraOn && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                  <CameraOff size={36} color='rgba(255,255,255,0.5)' />
                </div>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Camera is off</span>
              </div>
            )}

            {/* "Camera 01" badge — top right */}
            <div style={{
              position: 'absolute', top: 12, right: 14,
              background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)',
              borderRadius: 20, padding: '5px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 600, color: '#fff',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: cameraOn ? T.green : '#f59e0b',
                animation: cameraOn ? 'pulse-dot 1.5s infinite' : 'none',
              }} />
              Camera 01
            </div>

            {/* Face status badge — top left */}
            {cameraOn && (
              <div style={{
                position: 'absolute', top: 12, left: 14,
                background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)',
                borderRadius: 20, padding: '5px 12px',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 600, color: '#fff',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: faceVisible ? T.green : '#f59e0b',
                  animation: 'pulse-dot 1.5s infinite',
                }} />
                {faceVisible ? 'Face Detected' : 'Scanning…'}
              </div>
            )}

            {/* Recognizing overlay */}
            {recognizing && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(3px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <Loader size={30} color='#fff' style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Recognizing…</span>
              </div>
            )}
          </div>

          {/* ── Capture / Upload buttons ──────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Capture Manually */}
            <button
              onClick={cameraOn ? async () => { const b = await grabFrame(); if (b) runRecognition(b); } : startCamera}
              disabled={recognizing}
              style={{
                padding: '13px 0', borderRadius: 10, border: 'none',
                background: T.accent, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 4px 14px ${T.accent}55`,
                opacity: recognizing ? 0.7 : 1,
              }}
            >
              <Camera size={15} />
              {cameraOn ? 'Capture Manually' : 'Start Camera'}
            </button>

            {/* Upload Photo */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={recognizing}
              style={{
                padding: '13px 0', borderRadius: 10,
                border: `1.5px solid ${T.border2}`,
                background: T.cardBg, color: T.text,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: recognizing ? 0.7 : 1,
              }}
            >
              <Upload size={15} />
              Upload Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {/* Stop camera button when on */}
          {cameraOn && (
            <button onClick={stopCamera} style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${T.border2}`, background:T.cardBg, fontSize:11, color:T.red, cursor:'pointer', alignSelf:'flex-end' }}>
              Stop Camera
            </button>
          )}
        </div>

        {/* ── Recognition Result panel ─────────────────────── */}
        <div style={{
          background: T.cardBg, borderRadius: 16, border: `1px solid ${T.border}`,
          padding: '20px 18px', boxShadow: T.shadow,
          display: 'flex', flexDirection: 'column',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18 }}>Recognition Result</h3>

          {/* Empty state */}
          {!result && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '32px 0', color: T.textDim }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, background: T.cardBg2, border: `1.5px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={28} color={T.textDim} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>No recognition yet</p>
              <p style={{ fontSize: 11, color: T.textDim, textAlign: 'center' }}>Start camera or upload a photo to begin</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Captured thumbnail with badge */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  {capturedFrame ? (
                    <img
                      src={capturedFrame}
                      alt="Captured"
                      style={{
                        width: 110, height: 130,
                        objectFit: 'cover',
                        borderRadius: 12,
                        border: `2.5px solid ${result.matched ? T.green : T.red}`,
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 110, height: 130, borderRadius: 12,
                      background: T.cardBg2,
                      border: `2.5px solid ${result.matched ? T.green : T.red}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <User size={32} color={T.textDim} />
                    </div>
                  )}
                  {/* Status badge overlay */}
                  <div style={{
                    position: 'absolute', bottom: -10, right: -10,
                    width: 28, height: 28, borderRadius: '50%',
                    background: result.matched ? T.green : T.red,
                    border: '2px solid #fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}>
                    {result.matched
                      ? <CheckCircle2 size={15} color='#fff' />
                      : <XCircle      size={15} color='#fff' />}
                  </div>
                </div>
              </div>

              {/* Matched details */}
              {result.matched ? (
                <div>
                  {/* Event type badge */}
                  {result.type && result.type !== 'unknown' && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: result.type === 'check_in' ? T.greenLight : result.type === 'check_out' ? T.blueLight : T.yellowLight,
                        color:      result.type === 'check_in' ? T.green     : result.type === 'check_out' ? '#2563eb'  : '#d97706',
                        border: `1px solid ${result.type === 'check_in' ? T.green + '44' : result.type === 'check_out' ? '#93c5fd' : '#fcd34d'}`,
                      }}>
                        {result.type === 'check_in'           && <><LogIn  size={11} /> Checked In</>}
                        {result.type === 'check_out'          && <><LogOut size={11} /> Checked Out</>}
                        {result.type === 'already_checked_in' && <><Clock  size={11} /> Already In</>}
                      </span>
                    </div>
                  )}

                  {/* "Recognized" label */}
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 4 }}>Recognized</p>

                  {/* Name */}
                  <p style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>{result.name}</p>

                  {/* Employee ID */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <Hash size={11} color={T.textDim} />
                    <span style={{ fontSize: 12, color: T.textSub }}>{result.employee_id}</span>
                  </div>

                  {/* Department */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
                    <Building2 size={11} color={T.textDim} />
                    <span style={{ fontSize: 12, color: T.textSub }}>{result.department}</span>
                  </div>

                  {/* Already checked in message */}
                  {result.type === 'already_checked_in' && result.message && (
                    <div style={{ marginBottom: 12, padding: '7px 10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 7, fontSize: 11, color: '#92400e' }}>
                      {result.message}
                    </div>
                  )}

                  {/* Check-in time */}
                  <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                    <p style={{ fontSize: 10, color: T.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      {result.type === 'check_out' ? 'Check-out Time' : 'Check-in Time'}
                    </p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: T.green, letterSpacing: -0.5 }}>
                      {parseTime(result.time).time || result.time}
                    </p>
                    <p style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
                      {parseTime(result.time).date}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.red, marginBottom: 6 }}>Not Recognized</p>
                  <p style={{ fontSize: 12, color: T.textSub, marginBottom: 10 }}>No matching employee found</p>
                  <div style={{ background: T.redLight, borderRadius: 8, padding: '8px 12px', display: 'inline-block' }}>
                    <span style={{ fontSize: 11, color: T.red }}>Similarity: {(result.similarity * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Recognition Log ─────────────────────────────────── */}
      <div style={{ background: T.cardBg, borderRadius: 14, border: `1px solid ${T.border}`, boxShadow: T.shadow, overflow: 'hidden' }}>
        {/* Log header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Recognition Log</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Filter dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                value={logFilter}
                onChange={e => setLogFilter(e.target.value as LogFilter)}
                style={{
                  appearance: 'none', padding: '6px 28px 6px 12px',
                  borderRadius: 8, border: `1px solid ${T.border2}`,
                  background: T.cardBg, fontSize: 12, fontWeight: 600,
                  color: T.textSub, cursor: 'pointer', outline: 'none',
                  paddingRight: 28,
                }}
              >
                <option value="all">All Status</option>
                <option value="matched">Recognized</option>
                <option value="unknown">Unrecognized</option>
              </select>
              <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                ▾
              </div>
            </div>
            <button
              onClick={refreshLog}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border2}`, background: T.cardBg, fontSize: 12, fontWeight: 600, color: T.textSub, cursor: 'pointer' }}
            >
              ↻
            </button>
            <button
              onClick={downloadLog}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border2}`, background: T.cardBg, fontSize: 12, fontWeight: 600, color: T.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.cardBg2 }}>
                {['Time', 'Employee', 'ID / Code', 'Department', 'Status', 'Method', 'Type'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 16px',
                    fontSize: 11, fontWeight: 600, color: T.textDim,
                    borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logLoading && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: T.textDim }}>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                </td></tr>
              )}
              {!logLoading && filteredLog.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: T.textDim, fontSize: 12 }}>
                  No recognition events yet
                </td></tr>
              )}
              {!logLoading && filteredLog.map((e, i) => {
                const { date, time } = parseTime(e.time);
                const isMatched = e.status === 'Matched';
                return (
                  <tr key={i}
                    style={{ borderTop: `1px solid ${T.border}`, transition: 'background 0.12s' }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLTableRowElement).style.background = T.hover}
                    onMouseLeave={ev => (ev.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    {/* Time — stacked */}
                    <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{time}</div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{date}</div>
                    </td>

                    {/* Employee — avatar + name */}
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Avatar circle with initial */}
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: isMatched ? T.accentLight : T.cardBg2,
                          border: `1px solid ${isMatched ? T.accentMid + '55' : T.border2}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                          color: isMatched ? T.accent : T.textDim,
                        }}>
                          {isMatched ? e.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span style={{ fontWeight: 600, color: T.text }}>{e.name}</span>
                      </div>
                    </td>

                    {/* ID */}
                    <td style={{ padding: '11px 16px', color: T.textSub, fontWeight: 500 }}>{e.employee_id}</td>

                    {/* Department */}
                    <td style={{ padding: '11px 16px', color: T.textSub }}>{e.department}</td>

                    {/* Status pill */}
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: isMatched ? T.greenLight : T.redLight,
                        color:      isMatched ? T.green      : T.red,
                      }}>
                        {isMatched ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {isMatched ? 'Recognized' : 'Unrecognized'}
                      </span>
                    </td>

                    {/* Method */}
                    <td style={{ padding: '11px 16px', color: T.textSub, whiteSpace: 'nowrap' }}>
                      Live Camera
                    </td>

                    {/* Type — check in / check out */}
                    <td style={{ padding: '11px 16px' }}>
                      {e.type === 'check_in' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: T.greenLight, color: T.green }}>
                          <LogIn size={9} /> Check In
                        </span>
                      )}
                      {e.type === 'check_out' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: T.blueLight, color: '#2563eb' }}>
                          <LogOut size={9} /> Check Out
                        </span>
                      )}
                      {(!e.type || e.type === 'unknown') && (
                        <span style={{ color: T.textDim, fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
    </div>
  );
}
