/* Local storage is used ONLY for (a) an auto-saved draft while filling the form and
   (b) a "pending" copy when cloud sync failed. A successfully synced application is removed
   from the browser, so personal data does not linger on shared computers. */

const PENDING_KEY = '25c_pending_v2';
const DRAFT_KEY = '25c_draft_v2';

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Local storage unavailable', e);
  }
};

export const getRecord = (id) => read(PENDING_KEY, {})[String(id).toUpperCase()] || null;

export function upsertRecord(id, record) {
  const db = read(PENDING_KEY, {});
  db[String(id).toUpperCase()] = record;
  write(PENDING_KEY, db);
}

export function removeRecord(id) {
  const db = read(PENDING_KEY, {});
  delete db[String(id).toUpperCase()];
  write(PENDING_KEY, db);
}

export const readDraft = () => read(DRAFT_KEY, null);
export const writeDraft = (draft) => write(DRAFT_KEY, draft);
export const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
};

/* ---------- IDs ----------
   APP-<year>-<10 random chars>  → ~49 bits of randomness (the original 4-char suffix had only ~1.7M values).
   Alphabet skips 0/O/1/I/L so IDs are easy to read out loud. Must match ID_RE in Code.gs. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // 30 chars
export const ID_RE = /^APP-\d{4}-[A-Z0-9]{10}$/;

export function generateId() {
  let s = '';
  while (s.length < 10) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 240 && s.length < 10) s += ALPHABET[b % 30]; // 240 = 30*8 → no modulo bias
    }
  }
  return `APP-${new Date().getFullYear()}-${s}`;
}
