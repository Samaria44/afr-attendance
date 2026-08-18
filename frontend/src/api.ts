const BASE = 'http://localhost:8000/api/face';

export async function registerImage(
  employeeId: string,
  name: string,
  department: string,
  imageBlob: Blob,
  filename: string
) {
  const form = new FormData();
  form.append('employee_id', employeeId);
  form.append('name', name);
  form.append('department', department);
  form.append('image', imageBlob, filename);

  const res = await fetch(`${BASE}/register`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail ?? 'Registration failed');
  }
  return res.json();
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

  const res = await fetch(`${BASE}/recognize`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail ?? 'Recognition failed');
  }
  return res.json();
}

export async function fetchLog() {
  const res = await fetch(`${BASE}/log`);
  return res.json();
}
