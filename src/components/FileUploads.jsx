import { useState } from 'react';
import { FILE_FIELDS, MAX_FILE_BYTES, ALLOWED_FILE_RE } from '../formConfig.js';

const fmtSize = (b) => {
  if (!b && b !== 0) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * files:      { [fieldKey]: [{ name, size, type, uploaded, file? }] }
 * setRemovals: queue of already-uploaded files the user deleted; they are removed from Drive on the next save.
 */
export default function FileUploads({ files, setFiles, setRemovals }) {
  const [notice, setNotice] = useState('');

  const queueRemoval = (field, items) =>
    setRemovals((prev) => {
      const next = [...prev];
      for (const it of items) {
        if (it.uploaded && !next.some((r) => r.field === field && r.name === it.name)) next.push({ field, name: it.name });
      }
      return next;
    });

  const add = (field, multiple, fileList) => {
    const accepted = [];
    const rejected = [];
    for (const f of Array.from(fileList)) {
      if (!ALLOWED_FILE_RE.test(f.name)) rejected.push(`${f.name}: unsupported file type`);
      else if (f.size > MAX_FILE_BYTES) rejected.push(`${f.name}: larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
      else accepted.push({ name: f.name, size: f.size, type: f.type, uploaded: false, file: f });
    }
    setNotice(rejected.length ? `Skipped — ${rejected.join('; ')}` : '');
    if (!accepted.length) return;

    const existing = files[field] || [];
    if (!multiple) {
      // single-file slot: the new file replaces whatever was there
      queueRemoval(field, existing.filter((e) => !accepted.some((a) => a.name === e.name)));
      setFiles((prev) => ({ ...prev, [field]: accepted.slice(0, 1) }));
    } else {
      // same file name = same Drive file, so it is replaced rather than duplicated
      setFiles((prev) => ({
        ...prev,
        [field]: [...(prev[field] || []).filter((e) => !accepted.some((a) => a.name === e.name)), ...accepted],
      }));
    }
  };

  const remove = (field, index) => {
    const item = (files[field] || [])[index];
    if (!item) return;
    queueRemoval(field, [item]);
    setFiles((prev) => ({ ...prev, [field]: (prev[field] || []).filter((_, i) => i !== index) }));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        Accepted formats: PDF, JPG, PNG, DOC/DOCX — up to {MAX_FILE_BYTES / 1024 / 1024} MB per file (compress large scans first).
        All certificates or diplomas issued in a third language must be notarized in Chinese or English editions.
        You can come back later with your Application ID to add or replace files.
      </div>

      {notice && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{notice}</div>}

      {FILE_FIELDS.map((field, n) => {
        const list = files[field.key] || [];
        const inputId = `file-${field.key}`;
        return (
          <div key={field.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="pr-4">
                <p className="text-sm font-semibold text-slate-800">
                  {n + 1}. {field.label} {field.required && <span className="text-rose-500">*</span>}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{field.multiple ? 'Multiple files allowed' : 'Single file — a new upload replaces the old one'}</p>
              </div>

              <label htmlFor={inputId} className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700">
                {list.length ? (field.multiple ? 'Add more' : 'Replace') : 'Choose file'}
              </label>
              <input
                id={inputId}
                type="file"
                multiple={field.multiple}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) add(field.key, field.multiple, e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {list.length > 0 && (
              <ul className="mt-3 space-y-2">
                {list.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">{f.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {fmtSize(f.size)} ·{' '}
                        {f.uploaded ? (
                          <span className="font-medium text-emerald-600">uploaded</span>
                        ) : (
                          <span className="font-medium text-amber-600">will upload when you submit</span>
                        )}
                      </p>
                    </div>
                    <button type="button" onClick={() => remove(field.key, i)} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
