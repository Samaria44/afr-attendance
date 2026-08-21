import { getToken, saveAuth, clearAuth, type AuthUser } from './auth';

const BACKEND = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const BASE     = `${BACKEND}/api/face`;
const AUTH     = `${BACKEND}/api/auth`;

// ── Shared helpers ────────────────────────────────────────────────
function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res: Response) {
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/';
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const b = await res.json(); detail = b.detail ?? detail; } catch { /**/ }
    throw new Error(detail);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────
export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.append('username', username);
  form.append('password', password);

  const res = await fetch(`${AUTH}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = await handleResponse(res);
  saveAuth(data.access_token, data.user as AuthUser);
  return data;
}

export async function setupAdmin(username: string, password: string, fullName: string) {
  const res = await fetch(`${AUTH}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, full_name: fullName, role: 'admin' }),
  });
  return handleResponse(res);
}

export async function createUser(
  username: string, password: string,
  fullName: string, role: string,
) {
  const res = await fetch(`${AUTH}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username, password, full_name: fullName, role }),
  });
  return handleResponse(res);
}

export async function fetchUsers() {
  return handleResponse(await fetch(`${AUTH}/users`, { headers: authHeaders() }));
}

export async function deleteUser(username: string) {
  return handleResponse(
    await fetch(`${AUTH}/users/${encodeURIComponent(username)}`, {
      method: 'DELETE', headers: authHeaders(),
    })
  );
}

// ── Face API ──────────────────────────────────────────────────────
export async function registerImage(
  employeeId: string, name: string, department: string,
  imageBlob: Blob, filename: string,
) {
  const form = new FormData();
  form.append('employee_id', employeeId);
  form.append('name', name);
  form.append('department', department);
  form.append('image', imageBlob, filename);
  return handleResponse(
    await fetch(`${BASE}/register`, { method: 'POST', headers: authHeaders(), body: form })
  );
}

export async function detectFaces(imageBlob: Blob) {
  const form = new FormData();
  form.append('image', imageBlob, 'frame.jpg');
  const res = await fetch(`${BASE}/detect`, { method: 'POST', headers: authHeaders(), body: form });
  if (!res.ok) return null;
  return res.json();
}

export async function recognizeFace(imageBlob: Blob, threshold?: number, attendanceMode?: string) {
  const form = new FormData();
  form.append('image', imageBlob, 'capture.jpg');
  if (threshold !== undefined) {
    form.append('threshold', threshold.toString());
  }
  if (attendanceMode !== undefined) {
    form.append('attendance_mode', attendanceMode);
  }
  return handleResponse(
    await fetch(`${BASE}/recognize`, { method: 'POST', headers: authHeaders(), body: form })
  );
}

export async function fetchLog(limit = 20) {
  return handleResponse(
    await fetch(`${BASE}/log?limit=${limit}`, { headers: authHeaders() })
  );
}

export async function fetchEmployees() {
  return handleResponse(
    await fetch(`${BASE}/employees`, { headers: authHeaders() })
  );
}

export async function deleteEmployee(employeeId: string) {
  return handleResponse(
    await fetch(`${BASE}/employees/${encodeURIComponent(employeeId)}`, {
      method: 'DELETE', headers: authHeaders(),
    })
  );
}

// ── Attendance ────────────────────────────────────────────────────
export interface AttendanceSession {
  check_in_time:  string;
  check_in_ts:    string;
  check_out_time: string | null;
  check_out_ts:   string | null;
  duration_min:   number | null;
}

export interface AttendanceRecord {
  employee_id:    string;
  name:           string;
  department:     string;
  date:           string;
  sessions:       AttendanceSession[];
  total_sessions: number;
  total_min:      number;
  first_check_in: string | null;
  last_check_out: string | null;
  status:         string;
}

export interface TodaySummary {
  checked_in_count:  number;
  checked_out_count: number;
  total_today:       number;
  currently_in: {
    employee_id: string;
    name:        string;
    department:  string;
    check_in_ts: string;
    time:        string;
  }[];
}

export async function fetchAttendance(params?: {
  date_from?:    string;
  date_to?:      string;
  employee_id?:  string;
}) {
  const q = new URLSearchParams();
  if (params?.date_from)   q.append('date_from',   params.date_from);
  if (params?.date_to)     q.append('date_to',     params.date_to);
  if (params?.employee_id) q.append('employee_id', params.employee_id);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return handleResponse(
    await fetch(`${BASE}/attendance${qs}`, { headers: authHeaders() })
  );
}

export async function fetchTodaySummary(): Promise<TodaySummary> {
  return handleResponse(
    await fetch(`${BASE}/attendance/today-summary`, { headers: authHeaders() })
  );
}
