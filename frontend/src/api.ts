// LOCAL DEV: points to localhost:8000
// For production set VITE_API_URL in your hosting env vars
const BACKEND = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const BASE = `${BACKEND}/api/face`;

async function handleResponse(res: Response) {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

export async function registerImage(
  employeeId: string,
  name: string,
  department: string,
  imageBlob: Blob,
  filename: string,
) {
  const form = new FormData();
  form.append('employee_id', employeeId);
  form.append('name', name);
  form.append('department', department);
  form.append('image', imageBlob, filename);
  return handleResponse(await fetch(`${BASE}/register`, { method: 'POST', body: form }));
}

export async function detectFaces(imageBlob: Blob) {
  const form = new FormData();
  form.append('image', imageBlob, 'frame.jpg');
  const res = await fetch(`${BASE}/detect`, { method: 'POST', body: form });
  if (!res.ok) return null;
  return res.json();
}

export async function recognizeFace(imageBlob: Blob) {
  const form = new FormData();
  form.append('image', imageBlob, 'capture.jpg');
  return handleResponse(await fetch(`${BASE}/recognize`, { method: 'POST', body: form }));
}

export async function fetchLog(limit = 20) {
  return handleResponse(await fetch(`${BASE}/log?limit=${limit}`));
}

export async function fetchEmployees() {
  return handleResponse(await fetch(`${BASE}/employees`));
}

export async function deleteEmployee(employeeId: string) {
  return handleResponse(
    await fetch(`${BASE}/employees/${encodeURIComponent(employeeId)}`, { method: 'DELETE' }),
  );
}
