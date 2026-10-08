const COL_CLASS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-6',
};

const inputClass = (error) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-300 focus:ring-2 ${
    error
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
  }`;

const Label = ({ children, required }) => (
  <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
    {children}
    {required && <span className="text-rose-500">*</span>}
  </span>
);

const ErrorText = ({ error }) =>
  error ? <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span> : null;

export function TextField({ label, value, onChange, type = 'text', placeholder = '', className = '', required = false, hint, error }) {
  return (
    <label className={`block ${className}`}>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        className={inputClass(error)}
      />
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      <ErrorText error={error} />
    </label>
  );
}

export function TextArea({ label, value, onChange, rows = 3, placeholder = '', className = '', error }) {
  return (
    <label className={`block ${className}`}>
      <Label>{label}</Label>
      <textarea
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : undefined}
        className={`${inputClass(error)} resize-y`}
      />
      <ErrorText error={error} />
    </label>
  );
}

export function CheckGroup({ label, options, value, onChange, multiple = true, columns = 4, className = '', required = false, error }) {
  const selected = multiple ? (Array.isArray(value) ? value : []) : [value].filter(Boolean);

  const toggle = (opt) => {
    if (multiple) onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]);
    else onChange(selected.includes(opt) ? '' : opt);
  };

  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      <div className={`grid gap-2 ${COL_CLASS[columns] || COL_CLASS[4]}`}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => toggle(opt)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                active
                  ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700'
                  : error
                  ? 'border-rose-300 bg-white text-slate-600 hover:border-rose-400'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center border ${multiple ? 'rounded' : 'rounded-full'} ${
                  active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {active && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
                  </svg>
                )}
              </span>
              <span className="truncate">{opt}</span>
            </button>
          );
        })}
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function SubHeading({ children }) {
  return (
    <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
      <span className="h-4 w-1 rounded-full bg-indigo-500" />
      {children}
    </h3>
  );
}

export function RepeatRow({ children, onRemove, canRemove }) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {canRemove && (
        <button type="button" onClick={onRemove} className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
          Remove
        </button>
      )}
      {children}
    </div>
  );
}

export function AddButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-indigo-400 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
    >
      <span className="text-lg leading-none">+</span>
      {children}
    </button>
  );
}
