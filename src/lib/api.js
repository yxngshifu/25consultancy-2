const API_URL = (import.meta.env.VITE_SHEETS_API_URL || '').trim();
export const apiConfigured = Boolean(API_URL);

async function call(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('Network error — please check your connection');
  }
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error('Unexpected server response — is the Apps Script deployed with access set to "Anyone"?');
  }
  if (!json.ok) {
    const err = new Error(json.error || 'Backend error');
    err.code = json.code;
    throw err;
  }
  return json;
}

// text/plain avoids a CORS pre-flight, which Apps Script web apps cannot answer.
const post = (payload) =>
  call(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

/** Creates/updates the sheet row and the Drive folder. `isNew` lets the server reject an ID collision. */
export const saveRecord = (id, record, isNew) => post({ action: 'save', id, record, isNew });

/** One request per file keeps each request small and lets a single failure be retried on its own. */
export async function uploadFile(id, field, item) {
  return post({ action: 'upload', id, field, name: item.name, data: await toBase64(item.file) });
}

export const removeFile = (id, field, name) => post({ action: 'remove', id, field, name });

/** → { record, files:[{field,name,size}] } or null when the ID does not exist. Throws on network errors. */
export async function fetchApplication(id) {
  try {
    const json = await call(`${API_URL}?id=${encodeURIComponent(id)}`, { method: 'GET' });
    return { record: json.record, files: json.files || [] };
  } catch (e) {
    if (e.code === 'NOT_FOUND') return null;
    throw e;
  }
}
