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

const DEFAULTS: Settings = {
  similarityThreshold: 0.4,
  stableFaceMs: 2000,
  cameraCaptureDuration: 3000,
  cameraSelection: 'default',
  imageQuality: 'high',
  livenessDetection: true,
  attendanceMarking: 'auto',
  frameCaptureInterval: 800,
};

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function getCameraSelection(): string {
  return load().cameraSelection;
}

export function getCameraCaptureDuration(): number {
  return load().cameraCaptureDuration;
}

export function getStableFaceMs(): number {
  return load().stableFaceMs;
}

export function getSimilarityThreshold(): number {
  return load().similarityThreshold;
}

export function getImageQuality(): number {
  const quality = load().imageQuality;
  switch (quality) {
    case 'low': return 0.7;
    case 'medium': return 0.85;
    case 'high': return 0.92;
    default: return 0.92;
  }
}

export function getLivenessDetection(): boolean {
  return load().livenessDetection;
}

export function getAttendanceMarking(): string {
  return load().attendanceMarking;
}

export function getFrameCaptureInterval(): number {
  const interval = load().frameCaptureInterval;
  // Validate: min 300ms, max 5000ms, default to 800ms if invalid
  if (interval < 300 || interval > 5000) return 800;
  return interval;
}

export function getFacingMode(): 'user' | 'environment' | undefined {
  const selection = load().cameraSelection;
  switch (selection) {
    case 'front': return 'user';
    case 'back': return 'environment';
    case 'default': return 'user';
    case 'external': return 'user';
    default: return 'user';
  }
}
