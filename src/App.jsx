import { useEffect, useState } from 'react';
import ApplicationForm from './components/ApplicationForm.jsx';
import { makeInitialData, mergeData, todayLocal } from './formConfig.js';
import { generateId, ID_RE, getRecord, upsertRecord, removeRecord, readDraft, writeDraft, clearDraft } from './lib/store.js';
import { saveRecord, uploadFile, removeFile, fetchApplication, apiConfigured } from './lib/api.js';
import { downloadPDF, printForm } from './lib/exportDoc.js';
import { missingDocs } from './lib/validate.js';

/* ---------- helpers ---------- */
// File objects cannot be stored as JSON; keep only metadata.
function stripFiles(files) {
  const out = {};
  for (const [k, arr] of Object.entries(files || {})) out[k] = (arr || []).map(({ file, ...meta }) => meta);
  return out;
}
// After a reload the File objects are gone, so only already-uploaded entries are still meaningful.
function keepUploaded(files) {
  const kept = {};
  let dropped = 0;
  for (const [k, arr] of Object.entries(files || {})) {
    const ok = (arr || []).filter((f) => f.uploaded);
    dropped += (arr || []).length - ok.length;
    if (ok.length) kept[k] = ok;
  }
  return { kept, dropped };
}

export default function App() {
  const [view, setView] = useState('landing'); // landing | form | success
  const [appId, setAppId] = useState(null);
  const [data, setData] = useState(makeInitialData);
  const [files, setFiles] = useState({});
  const [removals, setRemovals] = useState([]); // uploaded files the user deleted → removed from Drive on next save
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [result, setResult] = useState(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(() => Boolean(readDraft()));

  const notify = (type, text) => setToast({ type, text });

  // error / success toasts disappear by themselves; "info" toasts are replaced by the next message
  useEffect(() => {
    if (!toast || toast.type === 'info') return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- draft auto-save ---------- */
  useEffect(() => {
    if (view !== 'form') return;
    const t = setTimeout(() => {
      writeDraft({ id: appId, data, files: stripFiles(files), removals });
      setDraftAvailable(true);
    }, 600);
    return () => clearTimeout(t);
  }, [view, appId, data, files, removals]);

  const openForm = ({ id = null, formData, formFiles = {}, formRemovals = [] }) => {
    setAppId(id);
    setData(formData);
    setFiles(formFiles);
    setRemovals(formRemovals);
    setResult(null);
    setView('form');
    window.scrollTo(0, 0);
  };

  const startNew = () => {
    if (draftAvailable && !window.confirm('Starting a new application will discard your saved draft. Continue?')) return;
    clearDraft();
    setDraftAvailable(false);
    openForm({ formData: makeInitialData() });
  };

  const resumeDraft = () => {
    const d = readDraft();
    if (!d) return;
    const { kept, dropped } = keepUploaded(d.files);
    openForm({ id: d.id || null, formData: mergeData(d.data), formFiles: kept, formRemovals: d.removals || [] });
    if (dropped) notify('error', `${dropped} file${dropped > 1 ? 's' : ''} could not be restored — please attach ${dropped > 1 ? 'them' : 'it'} again.`);
  };

  /* ---------- open an existing application by ID ---------- */
  const loadById = async (rawId) => {
    const key = rawId.trim().toUpperCase();
    if (!ID_RE.test(key)) {
      setLookupError('That ID does not look right. It should look like APP-2026-K7M2QX9TBH.');
      return;
    }
    setLookupError('');
    setLookupBusy(true);
    try {
      const pending = getRecord(key); // unsynced local copy (only exists if an earlier sync failed) is newest
      if (pending) {
        const { kept, dropped } = keepUploaded(pending.files);
        openForm({ id: key, formData: mergeData(pending.data), formFiles: kept });
        if (dropped) notify('error', `${dropped} file${dropped > 1 ? 's' : ''} must be attached again before saving.`);
        return;
      }
      if (!apiConfigured) {
        setLookupError('Cloud sync is not configured, so only applications saved in this browser can be opened.');
        return;
      }
      const remote = await fetchApplication(key);
      if (!remote) {
        setLookupError('No application found for that ID. Please check it and try again.');
        return;
      }
      const grouped = {};
      for (const f of remote.files) (grouped[f.field] = grouped[f.field] || []).push({ name: f.name, size: f.size, type: '', uploaded: true });
      openForm({ id: key, formData: mergeData(remote.record), formFiles: grouped });
    } catch (err) {
      setLookupError(`Could not reach the server: ${err.message}`);
    } finally {
      setLookupBusy(false);
    }
  };

  /* ---------- submit / update ---------- */
  const handleSubmit = async () => {
    const missing = missingDocs(files);
    if (
      missing.length &&
      !window.confirm(
        `${missing.length} required document${missing.length > 1 ? 's are' : ' is'} not attached yet:\n\n• ${missing.map((m) => m.label).join('\n• ')}\n\nSubmit anyway? You can add them later with your Application ID.`
      )
    )
      return;

    const isNew = !appId;
    let id = appId || generateId();
    const finalData = { ...data, affirm: { ...data.affirm, date: data.affirm.date || todayLocal() } };

    setBusy(true);
    notify('info', 'Saving your application…');

    /* phase 1 — the record itself (sheet row + Drive folder) */
    try {
      if (!apiConfigured) throw new Error('Cloud sync is not configured (demo mode).');
      for (let attempt = 0; ; attempt++) {
        try {
          await saveRecord(id, finalData, isNew);
          break;
        } catch (e) {
          if (e.code === 'ID_EXISTS' && isNew && attempt < 3) {
            id = generateId(); // astronomically unlikely, but handled
            continue;
          }
          throw e;
        }
      }
    } catch (err) {
      upsertRecord(id, { id, data: finalData, files: stripFiles(files), savedAt: new Date().toISOString() });
      setAppId(id);
      setData(finalData);
      setResult({ id, offline: true, reason: err.message });
      setToast(null);
      setView('success');
      setBusy(false);
      return;
    }
    setAppId(id);
    setData(finalData);

    /* phase 2 — removals, then uploads one by one so a single failure never loses the rest */
    const stillRemoving = [];
    for (const r of removals) {
      try {
        await removeFile(id, r.field, r.name);
      } catch {
        stillRemoving.push(r);
      }
    }
    setRemovals(stillRemoving);

    const next = { ...files };
    const pending = [];
    for (const [field, list] of Object.entries(files)) list.forEach((item) => item.file && !item.uploaded && pending.push({ field, item }));
    const failed = [];
    let n = 0;
    for (const { field, item } of pending) {
      n += 1;
      notify('info', `Uploading file ${n} of ${pending.length}…`);
      try {
        await uploadFile(id, field, item);
        next[field] = next[field].map((x) => (x === item ? { name: x.name, size: x.size, type: x.type, uploaded: true } : x));
      } catch {
        failed.push(item.name);
      }
    }
    setFiles(next);
    setBusy(false);

    if (failed.length || stillRemoving.length) {
      notify(
        'error',
        `Your answers are saved (ID ${id}), but ${failed.length + stillRemoving.length} file change${failed.length + stillRemoving.length > 1 ? 's' : ''} did not go through${failed.length ? ` (${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''})` : ''}. Press “Update application” to retry.`
      );
      setView('form');
      return;
    }

    removeRecord(id);
    clearDraft();
    setDraftAvailable(false);
    setResult({ id, offline: false });
    setToast(null);
    setView('success');
    window.scrollTo(0, 0);
  };

  const currentId = result?.id || appId;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        view={view}
        appId={appId}
        onHome={() => setView('landing')}
        onDownload={() => downloadPDF(data, appId || 'DRAFT', files)}
        onPrint={() => printForm(data, appId || 'DRAFT', files)}
      />

      {view === 'landing' && (
        <Landing
          onStart={startNew}
          onResume={resumeDraft}
          draftAvailable={draftAvailable}
          lookupId={lookupId}
          setLookupId={setLookupId}
          lookupError={lookupError}
          lookupBusy={lookupBusy}
          onLookup={() => loadById(lookupId)}
          apiConfigured={apiConfigured}
        />
      )}

      {view === 'form' && (
        <ApplicationForm
          appId={appId}
          data={data}
          setData={setData}
          files={files}
          setFiles={setFiles}
          setRemovals={setRemovals}
          busy={busy}
          notify={notify}
          onSubmit={handleSubmit}
          onCancel={() => setView('landing')}
        />
      )}

      {view === 'success' && (
        <Success
          id={currentId}
          offline={result?.offline}
          reason={result?.reason}
          onEdit={() => setView('form')}
          onNew={() => {
            clearDraft();
            setDraftAvailable(false);
            openForm({ formData: makeInitialData() });
          }}
          onDownload={() => downloadPDF(data, currentId, files)}
          onPrint={() => printForm(data, currentId, files)}
        />
      )}

      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`fixed bottom-6 left-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 rounded-xl px-5 py-3 text-center text-sm font-medium shadow-lg ${
            toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ---------- top bar ---------- */
function TopBar({ view, appId, onHome, onDownload, onPrint }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <button onClick={onHome} className="flex items-center gap-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-extrabold text-white">25</span>
          <span>
            <span className="block text-sm font-bold leading-tight text-slate-900">25Consultancy</span>
            <span className="block text-xs leading-tight text-slate-500">Study in China</span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {appId && <span className="hidden rounded-lg bg-indigo-50 px-3 py-1.5 font-mono text-xs font-semibold text-indigo-700 sm:block">{appId}</span>}
          {view === 'form' && (
            <>
              <button onClick={onPrint} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Print</button>
              <button onClick={onDownload} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Export PDF</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------- landing ---------- */
function Landing({ onStart, onResume, draftAvailable, lookupId, setLookupId, lookupError, lookupBusy, onLookup, apiConfigured }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            25Consultancy · International Admissions
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Your application to study in China,
            <span className="text-indigo-600"> in one place.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
            Complete the official application form, upload your documents, and receive a unique Application ID. Use that ID at any time to return, edit your information, or add new files.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onStart} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">
              Start a new application
            </button>
            {draftAvailable && (
              <button onClick={onResume} className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Resume saved draft
              </button>
            )}
          </div>

          {!apiConfigured && (
            <p className="mt-6 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              <b>Demo mode:</b> no cloud endpoint is configured (<code>VITE_SHEETS_API_URL</code>). Nothing is sent to Google; the PDF export still works.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
          <h2 className="text-lg font-bold text-slate-900">Already applied?</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your Application ID to edit your form, re-upload files, or add new documents — from any device.</p>

          <label className="mt-6 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Application ID</span>
            <input
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLookup()}
              placeholder="APP-2026-K7M2QX9TBH"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <button onClick={onLookup} disabled={lookupBusy} className="mt-4 w-full rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60">
            {lookupBusy ? 'Looking up…' : 'Open my application'}
          </button>

          {lookupError && <p role="alert" className="mt-3 text-xs font-medium text-rose-600">{lookupError}</p>}

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-6 text-center">
            {[['9', 'Steps'], ['13', 'Documents'], ['1', 'Unique ID']].map(([n, l]) => (
              <div key={l}>
                <div className="text-2xl font-extrabold text-indigo-600">{n}</div>
                <div className="text-xs font-medium text-slate-500">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} 25Consultancy · Study in China Application Portal
      </footer>
    </main>
  );
}

/* ---------- success ---------- */
function Success({ id, offline, reason, onEdit, onNew, onDownload, onPrint }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60 sm:p-12">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${offline ? 'bg-amber-100' : 'bg-emerald-100'}`}>{offline ? '!' : '✓'}</div>
        <h1 className="mt-6 text-2xl font-extrabold text-slate-900 sm:text-3xl">{offline ? 'Saved on this device only' : 'Application submitted'}</h1>
        <p className="mt-2 text-sm text-slate-500">Keep this ID safe — you need it to view or update your application.</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 px-6 py-5">
          <span className="break-all font-mono text-xl font-extrabold tracking-wide text-indigo-700 sm:text-2xl">{id}</span>
          <button onClick={copy} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {offline && (
          <p className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            We could not reach the server ({reason}). Your answers are stored in this browser only, and this ID will not work on other devices until the
            application is synced. Use <b>Edit this application</b> and press <b>Update application</b> to try again.
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={onDownload} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Download PDF</button>
          <button onClick={onPrint} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Print / Save as PDF</button>
        </div>

        <div className="mt-6 flex justify-center gap-6 text-sm font-semibold">
          <button onClick={onEdit} className="text-indigo-600 hover:underline">Edit this application</button>
          <button onClick={onNew} className="text-slate-500 hover:underline">Start a new one</button>
        </div>
      </div>
    </main>
  );
}
