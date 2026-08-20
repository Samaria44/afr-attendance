import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, CameraOff, Upload, Search, RefreshCw,
  CheckCircle2, XCircle, Loader, Clock, User,
  Building2, Hash, Wifi, Video, ImagePlus, LogIn, LogOut,
} from 'lucide-react';
import { recognizeFace, fetchLog, detectFaces } from '../api';
import { T } from '../theme';

interface BBox { x: number; y: number; width: number; height: number; }
interface DetectResult {
  face_detected: boolean; number_of_faces: number;
  image_width: number; image_height: number; faces: BBox[];
}
interface LogEntry {
  employee_id: string; name: string; department: string;
  time: string; status: 'Matched' | 'Unknown'; similarity: number;
}
interface RecognitionResult {
  matched: boolean; employee_id?: string; name: string;
  department?: string; time: string; similarity: number;
  type?: 'check_in' | 'check_out' | 'already_checked_in' | 'unknown';
  message?: string;
}

const STABLE_MS = 2000;

export default function LiveRecognitionPage() {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);
  const captureRef  = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const detectTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  const [cameraOn, setCameraOn]         = useState(false);
  const [result, setResult]             = useState<RecognitionResult | null>(null);
  const [log, setLog]                   = useState<LogEntry[]>([]);
  const [recognizing, setRecognizing]   = useState(false);
  const [detecting, setDetecting]       = useState(false);
  const [faceVisible, setFaceVisible]   = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadBlob, setUploadBlob]     = useState<Blob | null>(null);
  const [mode, setMode]                 = useState<'camera' | 'upload'>('camera');
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [logLoading, setLogLoading]     = useState(false);

  const refreshLog = useCallback(async () => {
    setLogLoading(true);
    try { const d = await fetchLog(20); setLog(d.log ?? []); } catch {/**/}
    finally { setLogLoading(false); }
  }, []);

  // ── Canvas draw ────────────────────────────────────────────────
  const drawBoxes = useCallback((det: DetectResult, vw: number, vh: number) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = vw; canvas.height = vh;
    ctx.clearRect(0, 0, vw, vh);
    if (!det.face_detected) return;
    const sx = vw / (det.image_width || vw);
    const sy = vh / (det.image_height || vh);
    det.faces.forEach(box => {
      const x = box.x * sx, y = box.y * sy, w = box.width * sx, h = box.height * sy;
      ctx.shadowColor = T.green; ctx.shadowBlur = 14;
      ctx.strokeStyle = T.green; ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
      const cs = 18;
      ctx.strokeStyle = T.green; ctx.lineWidth = 3.5;
      [[x,y+cs,x,y,x+cs,y],[x+w-cs,y,x+w,y,x+w,y+cs],[x,y+h-cs,x,y+h,x+cs,y+h],[x+w-cs,y+h,x+w,y+h,x+w,y+h-cs]].forEach(pts => {
        ctx.beginPath(); ctx.moveTo(pts[0],pts[1]); ctx.lineTo(pts[2],pts[3]); ctx.lineTo(pts[4],pts[5]); ctx.stroke();
      });
    });
  }, []);

  const grabFrame = useCallback((): Promise<Blob | null> => new Promise(resolve => {
    const v = videoRef.current, c = captureRef.current;
    if (!v || !c) return resolve(null);
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext('2d')?.drawImage(v, 0, 0);
    c.toBlob(resolve, 'image/jpeg', 0.85);
  }), []);

  const runDetect = useCallback(async () => {
    if (detecting) return;
    setDetecting(true);
    try {
      const blob = await grabFrame();
      if (!blob) return;
      const res: DetectResult = await detectFaces(blob);
      const vw = videoRef.current?.clientWidth || 640;
      const vh = videoRef.current?.clientHeight || 480;
      drawBoxes(res, vw, vh);
      setFaceVisible(res.face_detected && res.number_of_faces === 1);
      if (!res.face_detected || res.number_of_faces !== 1) {
        if (stableTimer.current) { clearTimeout(stableTimer.current); stableTimer.current = null; }
      }
    } catch {/**/} finally { setDetecting(false); }
  }, [detecting, drawBoxes, grabFrame]);

  useEffect(() => {
    if (!cameraOn) return;
    if (faceVisible && !recognizing) {
      if (!stableTimer.current) {
        stableTimer.current = setTimeout(async () => {
          stableTimer.current = null;
          const blob = await grabFrame();
          if (blob) await runRecognition(blob);
        }, STABLE_MS);
      }
    } else {
      if (stableTimer.current) { clearTimeout(stableTimer.current); stableTimer.current = null; }
    }
  }, [faceVisible, cameraOn, recognizing]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width:{ideal:1280}, height:{ideal:720} } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>(r => { videoRef.current!.onloadedmetadata = () => r(); });
        await videoRef.current.play();
      }
      setCameraOn(true); setResult(null);
      detectTimer.current = setInterval(runDetect, 800);
    } catch { alert('Camera not available. Use Upload mode.'); }
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

  const runRecognition = async (blob: Blob) => {
    setRecognizing(true);
    // Capture a preview of the image being recognized
    const frameUrl = URL.createObjectURL(blob);
    setCapturedFrame(frameUrl);
    try {
      const res = await recognizeFace(blob);
      setResult(res);
      await refreshLog();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Recognition failed'); }
    finally { setRecognizing(false); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPreview(URL.createObjectURL(file));
    setUploadBlob(file); setResult(null);
  };

  useEffect(() => { refreshLog(); return () => { stopCamera(); }; }, []);

  return (
    <div className="fade-in" style={{ padding:'24px 28px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:T.text }}>Live Recognition</h1>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20, background:cameraOn?T.greenLight:'#f1f5f9', border:`1px solid ${cameraOn?T.green:T.border2}` }}>
            <Wifi size={12} color={cameraOn?T.green:T.textDim} />
            <span style={{ fontSize:11, fontWeight:600, color:cameraOn?T.green:T.textDim }}>{cameraOn?'Live':'Offline'}</span>
          </div>
          <button onClick={refreshLog} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:8, border:`1px solid ${T.border2}`, background:T.cardBg, fontSize:12, fontWeight:600, color:T.textSub, cursor:'pointer' }}>
            <RefreshCw size={12} /> Refresh Log
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {(['camera','upload'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); if (m !== 'camera') stopCamera(); setResult(null); }}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 18px', borderRadius:20, border:`1px solid ${mode===m?T.accent+'44':T.border2}`, fontSize:12, fontWeight:600, cursor:'pointer', background:mode===m?T.accentLight:'transparent', color:mode===m?T.accent:T.textSub }}>
            {m === 'camera' ? <><Video size={13}/> Live Camera</> : <><ImagePlus size={13}/> Upload Photo</>}
          </button>
        ))}
      </div>

      {/* Main layout — camera/upload + result side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:20, marginBottom:20 }}>

        {/* Left — Camera or Upload */}
        <div>
          {mode === 'camera' ? (
            <div style={{ background:'#000', borderRadius:16, overflow:'hidden', position:'relative', width:'100%', height:400 }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              <canvas ref={overlayRef} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none' }} />
              <canvas ref={captureRef} style={{ display:'none' }} />

              {!cameraOn && (
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:12, padding:16 }}><CameraOff size={32} color='#fff' /></div>
                  <span style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>Camera is off</span>
                </div>
              )}

              {/* Camera badge */}
              {cameraOn && (
                <div style={{ position:'absolute', top:12, left:12, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', borderRadius:20, padding:'4px 12px', display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#fff' }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:faceVisible?T.green:'#f59e0b', display:'inline-block', animation:'pulse-dot 1.5s infinite' }} />
                  {faceVisible ? 'Face Detected' : 'Scanning...'}
                </div>
              )}

              {/* Start/Stop */}
              <button onClick={cameraOn ? stopCamera : startCamera}
                style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', padding:'9px 24px', borderRadius:20, border:'none', background:cameraOn?T.red:T.accent, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 14px rgba(0,0,0,0.3)' }}>
                {cameraOn ? <><CameraOff size={14}/> Stop Camera</> : <><Camera size={14}/> Start Camera</>}
              </button>

              {/* Recognizing overlay */}
              {recognizing && (
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(2px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <Loader size={28} color='#fff' style={{ animation:'spin 1s linear infinite' }} />
                  <span style={{ color:'#fff', fontSize:13, fontWeight:600 }}>Recognizing...</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div onClick={() => fileRef.current?.click()}
                style={{ borderRadius:16, border:`2px dashed ${uploadPreview?T.accent:T.border2}`, background:T.cardBg2, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', height:300, width:'100%', transition:'border-color 0.2s' }}>
                {uploadPreview
                  ? <img src={uploadPreview} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                  : <div style={{ textAlign:'center', color:T.textDim, padding:24 }}>
                      <div style={{ background:T.accentLight, borderRadius:'50%', width:64, height:64, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                        <Upload size={26} color={T.accent} />
                      </div>
                      <p style={{ fontSize:13, fontWeight:600, color:T.textSub, marginBottom:4 }}>Click to upload a photo</p>
                      <p style={{ fontSize:11, color:T.textDim }}>JPG, PNG or WEBP</p>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile} />
              <button onClick={() => uploadBlob && runRecognition(uploadBlob)} disabled={!uploadBlob || recognizing}
                style={{ width:'100%', marginTop:12, padding:'12px 0', borderRadius:10, border:'none', background:uploadBlob&&!recognizing?T.accent:T.border2, color: uploadBlob&&!recognizing?'#fff':T.textDim, fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow: uploadBlob&&!recognizing?`0 4px 14px ${T.accent}44`:'none' }}>
                {recognizing ? <><Loader size={14} style={{ animation:'spin 1s linear infinite' }}/> Recognizing...</> : <><Search size={14}/> Recognize Face</>}
              </button>
            </div>
          )}
        </div>

        {/* Right — Recognition result card */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:T.cardBg, borderRadius:16, border:`1px solid ${T.border}`, padding:20, boxShadow:T.shadow, flex:1 }}>
            <h3 style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:16, textTransform:'uppercase', letterSpacing:0.5 }}>Recognition Result</h3>

            {!result && (
              <div style={{ textAlign:'center', padding:'32px 0', color:T.textDim }}>
                <div style={{ background:T.cardBg2, borderRadius:'50%', width:56, height:56, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                  <User size={24} color={T.textDim} />
                </div>
                <p style={{ fontSize:12 }}>No recognition yet</p>
                <p style={{ fontSize:11, marginTop:4, color:T.textDim }}>Start camera or upload a photo</p>
              </div>
            )}

            {result && (
              <div>
                {/* Captured frame */}
                {capturedFrame && (
                  <div style={{ marginBottom:14, borderRadius:10, overflow:'hidden', border:`2px solid ${result.matched?T.green:T.red}33` }}>
                    <img src={capturedFrame} alt="Captured" style={{ width:'100%', maxHeight:160, objectFit:'cover', display:'block' }} />
                  </div>
                )}

                {/* Status icon */}
                <div style={{ textAlign:'center', marginBottom:16 }}>
                  <div style={{ width:56, height:56, borderRadius:'50%',
                    background: result.type==='check_in' ? T.greenLight : result.type==='check_out' ? T.blueLight : result.type==='already_checked_in' ? T.yellowLight : T.redLight,
                    display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px',
                    border:`2px solid ${result.type==='check_in'?T.green:result.type==='check_out'?T.blue:result.type==='already_checked_in'?T.yellow:T.red}33`
                  }}>
                    {result.matched
                      ? <CheckCircle2 size={28} color={result.type==='check_out'?T.blue:T.green} />
                      : <XCircle size={28} color={T.red} />}
                  </div>

                  {/* Event type badge */}
                  {result.matched && result.type && result.type !== 'unknown' && (
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:5,
                      padding:'4px 14px', borderRadius:20, fontSize:12, fontWeight:700,
                      marginBottom:4,
                      background: result.type==='check_in' ? T.greenLight : result.type==='check_out' ? T.blueLight : T.yellowLight,
                      color:      result.type==='check_in' ? T.green     : result.type==='check_out' ? T.blue     : T.yellow,
                      border:`1px solid ${result.type==='check_in'?T.green:result.type==='check_out'?T.blue:T.yellow}44`,
                    }}>
                      {result.type === 'check_in'           && <><LogIn  size={12}/> Checked In</>}
                      {result.type === 'check_out'          && <><LogOut size={12}/> Checked Out</>}
                      {result.type === 'already_checked_in' && <><Clock  size={12}/> Already Checked In</>}
                    </div>
                  )}

                  <div style={{ fontSize:15, fontWeight:800, color:result.matched?T.text:T.red, marginTop:4 }}>
                    {result.matched ? 'Recognized' : 'Not Recognized'}
                  </div>

                  {/* Already checked in message */}
                  {result.type === 'already_checked_in' && result.message && (
                    <div style={{ fontSize:11, color:T.yellow, marginTop:6, padding:'5px 10px', background:T.yellowLight, borderRadius:7 }}>
                      {result.message}
                    </div>
                  )}
                </div>

                {result.matched && (
                  <div style={{ background:T.cardBg2, borderRadius:10, padding:'14px 16px' }}>
                    <div style={{ fontSize:15, fontWeight:800, color:T.text, marginBottom:4 }}>{result.name}</div>
                    <div style={{ fontSize:12, color:T.textSub, marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}><Hash size={11}/> {result.employee_id}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}><Building2 size={11}/> {result.department}</div>
                    </div>
                    <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10 }}>
                      <div style={{ fontSize:10, color:T.textDim, marginBottom:3 }}>Check-in Time</div>
                      <div style={{ fontSize:16, fontWeight:800, color:T.green }}>{result.time.split('  ')[1] ?? result.time}</div>
                      <div style={{ fontSize:11, color:T.textSub, marginTop:2 }}>{result.time.split('  ')[0] ?? ''}</div>
                    </div>
                  </div>
                )}

                {!result.matched && (
                  <div style={{ background:T.redLight, borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                    <p style={{ fontSize:12, color:T.red }}>No matching employee found</p>
                    <p style={{ fontSize:11, color:T.textDim, marginTop:4 }}>Similarity: {(result.similarity*100).toFixed(1)}%</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recognition log */}
      <div style={{ background:T.cardBg, borderRadius:14, border:`1px solid ${T.border}`, boxShadow:T.shadow, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ fontSize:13, fontWeight:700, color:T.text }}>Recognition Log</h3>
          <span style={{ fontSize:11, color:T.textDim }}>{log.length} entries</span>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:T.cardBg2 }}>
              {['#','Employee ID','Name','Time','Type','Status'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'9px 14px', fontSize:10, fontWeight:600, color:T.textDim, textTransform:'uppercase', letterSpacing:0.7 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!logLoading && log.length===0&&<tr><td colSpan={6} style={{ textAlign:'center', padding:24, color:T.textDim }}>No recognition events yet</td></tr>}
            {log.map((e,i)=>(
              <tr key={i} style={{ borderTop:`1px solid ${T.border}`, transition:'background 0.12s' }}
                onMouseEnter={ev=>(ev.currentTarget as HTMLTableRowElement).style.background=T.hover}
                onMouseLeave={ev=>(ev.currentTarget as HTMLTableRowElement).style.background='transparent'}>
                <td style={{ padding:'9px 14px', color:T.textDim }}>{i+1}</td>
                <td style={{ padding:'9px 14px', fontWeight:700, color:T.accent, fontSize:12 }}>{e.employee_id}</td>
                <td style={{ padding:'9px 14px', fontWeight:600, color:T.text }}>{e.name}</td>
                <td style={{ padding:'9px 14px', color:T.textDim, whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}><Clock size={10}/>{e.time}</div>
                </td>
                <td style={{ padding:'9px 14px' }}>
                  {(e as LogEntry & {type?:string}).type === 'check_in' && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:T.greenLight, color:T.green }}><LogIn size={9}/> Check In</span>
                  )}
                  {(e as LogEntry & {type?:string}).type === 'check_out' && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:T.blueLight, color:T.blue }}><LogOut size={9}/> Check Out</span>
                  )}
                  {!(e as LogEntry & {type?:string}).type && <span style={{ color:T.textDim, fontSize:11 }}>—</span>}
                </td>
                <td style={{ padding:'9px 14px' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:e.status==='Matched'?T.greenLight:T.redLight, color:e.status==='Matched'?T.green:T.red }}>
                    {e.status==='Matched'?<CheckCircle2 size={9}/>:<XCircle size={9}/>} {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
