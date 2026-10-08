# 25Consultancy — Study in China Application Portal (v1.1)

React + Vite + Tailwind front end · Google Apps Script back end (Google Sheet + Google Drive).

## Quick start
```bash
npm install
cp .env.example .env        # then paste your Apps Script Web App URL (leave empty for demo mode)
npm run dev                 # http://localhost:5173
```

## Google setup (≈10 min)
1. **Sheet:** create a Google Sheet named `Applicant Data` (tab name `Applications` is created automatically). Copy the ID from the URL (`/d/<ID>/edit`).
2. **Drive:** create a folder `25Consultancy Uploads`; copy the folder ID from its URL (`/folders/<ID>`).
3. **Script:** in the sheet choose *Extensions → Apps Script*, paste `apps-script/Code.gs`, and fill in `SHEET_ID` and `PARENT_FOLDER_ID`.
4. **Deploy:** *Deploy → New deployment → Web app* · Execute as **Me** · Who has access **Anyone** → authorize → copy the `/exec` URL into `.env` as `VITE_SHEETS_API_URL`.
5. After **any** change to `Code.gs`: *Deploy → Manage deployments → ✏️ → Version: New version → Deploy* (the URL stays the same).

## How it works
| Step | What happens |
|---|---|
| Submit | Client creates a random ID `APP-2026-XXXXXXXXXX` → `save` (sheet row + Drive folder named with the ID) → files uploaded **one request per file** into `<ID>/<field>__<file name>`. |
| Return with ID | Landing page → paste ID → the app loads the record **and file list from the server**, so it works from any device. Edit fields, add/replace/remove files, press *Update application*. |
| Export | *Download PDF* / *Print* produce the filled form (same sections/tables as the original, with an attachment checklist). |

## What changed from v1.0 (bugs & risks fixed)
**Correctness**
- Export double-escaped values (`&` → `&amp;amp;`) in duration rows — fixed (escape exactly once).
- Export CSS was injected globally while generating the PDF and restyled the whole app — now scoped to `.form-root`.
- Editing an application **re-uploaded every file** each time — now only pending files are sent; uploaded ones are marked and kept.
- Removing an already-uploaded file never removed it from Drive — now queued and trashed on save.
- Two slots with the same file name overwrote each other in Drive — files are stored as `<field>__<name>`.
- Single-file slots could silently hold several files — a new upload now replaces the old one.
- `Submitted At` was overwritten on every edit — now preserved.
- Resuming a draft showed files as "pending upload" that no longer existed — they are dropped with a clear message.
- ID lookup only worked in the browser that created the record (`fetchApplication` was never used) — now falls back to the server.
- Dates/phones/passport numbers were mangled by Sheets (`2026.09` → number, `00123` → `123`, `=…` run as formula) — rows are written as text.
- "Not important" for universities/city never reached the sheet; stale `scholarship` flag removed; UTC-vs-local date bug fixed.
**Security / robustness**
- IDs: 4 random characters (~1.7 M values, guessable) → 10 random characters from `crypto` (~49 bits); format validated on server; collisions rejected (`ID_EXISTS`) and retried.
- Real Apps Script URL was hard-coded as a fallback in `api.js` and in the guide → removed (`.env` only; `.env.example` provided).
- Script now serialises writes with a lock, validates ID / field / extension / size, caps file count, and rejects oversized records.
- The Drive folder link was shown to applicants (access-denied for them, and an information leak) → staff-only, kept in the sheet.
- Successfully synced applications are removed from the browser (only drafts / failed syncs stay in `localStorage`).
- `html2pdf` is bundled via npm instead of loaded from a CDN at runtime.
**UX**
- Required-field validation with inline errors, red sidebar markers and jump-to-first-error; live re-validation.
- Missing required documents trigger a confirm (you can add them later with the ID) instead of blocking.
- Failed sync no longer shows a "submitted" screen without explanation: clear offline state + retry path.

## Known limits (by design)
- **The ID is the only credential.** Anyone who has it can read/edit that application. For passports and similar data consider adding an email one-time code before editing. Apps Script cannot rate-limit lookups.
- Apps Script web apps have quotas and slow cold starts; files are limited to **10 MB each**.
- PDF download is a rasterised snapshot (html2pdf); *Print → Save as PDF* gives selectable text.
- `Proposed Major` is pre-filled with `CHINESE LANGUAGE` (as in your original) — clear it in `src/formConfig.js` if that is not wanted for every applicant.

## Deploy (Vercel)
```bash
npm i -g vercel && vercel
```
Add env var `VITE_SHEETS_API_URL` in *Project → Settings → Environment Variables*, then redeploy.
