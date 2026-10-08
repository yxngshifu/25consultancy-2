import { useState } from 'react';
import { CheckGroup, TextField, TextArea, SubHeading, RepeatRow, AddButton } from './fields.jsx';
import FileUploads from './FileUploads.jsx';
import { MARITAL_OPTIONS, EDUCATION_LEVELS, PROFICIENCY, HSK_LEVELS, emptyEducation, emptyWork, emptyFamily } from '../formConfig.js';
import { validate, stepOf } from '../lib/validate.js';

export const STEPS = [
  { key: 'personal', title: 'Personal Information' },
  { key: 'education', title: 'Education Background' },
  { key: 'work', title: 'Work Experience' },
  { key: 'study', title: 'Proposed Study in China' },
  { key: 'financial', title: 'Financial Supporter' },
  { key: 'emergency', title: 'Emergency Contact in China' },
  { key: 'family', title: 'Family Members' },
  { key: 'documents', title: 'Documents' },
  { key: 'affirm', title: 'Affirmation & Signature' },
];

/** Immutable setter that works for nested objects AND arrays ("education.0.schoolName"). */
function setIn(obj, path, value) {
  const [head, ...rest] = path;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  clone[head] = rest.length ? setIn(obj?.[head] ?? {}, rest, value) : value;
  return clone;
}

export default function ApplicationForm({
  appId, data, setData, files, setFiles, setRemovals, busy, onSubmit, onCancel, notify, initialStep = 0,
}) {
  const [step, setStep] = useState(initialStep);
  const [submitted, setSubmitted] = useState(false);

  // After the first submit attempt, errors are recomputed live so they disappear as the user fixes them.
  const errors = submitted ? validate(data) : {};
  const errorSteps = new Set(Object.keys(errors).map(stepOf));
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  const get = (path) => path.split('.').reduce((o, k) => o?.[k], data);
  const set = (path, value) => setData((prev) => setIn(prev, path.split('.'), value));

  // small field factories → every input is wired the same way (value, onChange, error)
  const T = (path, label, props = {}) => (
    <TextField label={label} value={get(path)} onChange={(v) => set(path, v)} error={errors[path]} {...props} />
  );
  const A = (path, label, props = {}) => (
    <TextArea label={label} value={get(path)} onChange={(v) => set(path, v)} error={errors[path]} {...props} />
  );
  const C = (path, label, options, columns = 4, props = {}) => (
    <CheckGroup label={label} options={options} value={get(path)} onChange={(v) => set(path, v)} multiple={false} columns={columns} error={errors[path]} {...props} />
  );

  const go = (i) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const trySubmit = () => {
    setSubmitted(true);
    const paths = Object.keys(validate(data));
    if (paths.length) {
      go(stepOf(paths[0]));
      notify?.('error', `Please complete the ${paths.length} highlighted required field${paths.length > 1 ? 's' : ''}.`);
      return;
    }
    onSubmit();
  };

  const s = data.study;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[260px_1fr]">
      {/* ---------- sidebar ---------- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Progress</span>
            <span className="text-indigo-600">{progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {appId && (
            <div className="mt-4 rounded-lg bg-indigo-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Application ID</p>
              <p className="break-all font-mono text-xs font-bold text-indigo-800">{appId}</p>
            </div>
          )}

          <nav className="mt-5 space-y-1">
            {STEPS.map((st, i) => (
              <button
                key={st.key}
                type="button"
                onClick={() => go(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  i === step
                    ? 'bg-indigo-600 font-semibold text-white'
                    : errorSteps.has(i)
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : i < step
                    ? 'text-emerald-700 hover:bg-emerald-50'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    i === step ? 'bg-white/20 text-white' : errorSteps.has(i) ? 'bg-rose-200 text-rose-800' : i < step ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {errorSteps.has(i) ? '!' : i < step ? '✓' : i + 1}
                </span>
                <span className="truncate">{st.title}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ---------- main card ---------- */}
      <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Section {step + 1} of {STEPS.length}</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{STEPS[step].title}</h2>
          <p className="mt-1 text-xs text-slate-400">Fields marked <span className="text-rose-500">*</span> are required. Your progress is saved automatically on this device.</p>
        </div>

        {/* 1 ── PERSONAL */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {T('personal.surname', 'Surname (like in passport)', { required: true })}
              {T('personal.givenName', 'Given name (like in passport)', { required: true })}
              {T('personal.dob', 'Date of Birth (YYYY.MM.DD)', { required: true, placeholder: '1998.05.21' })}
              {T('personal.placeOfBirth', 'Place of Birth')}
              {T('personal.nationality', 'Nationality', { required: true })}
              {T('personal.presentCountryCity', 'Present Country / City')}
              {T('personal.passportNo', 'Passport No.', { required: true })}
              {T('personal.passportExpiry', 'Passport Expiration Date', { required: true, placeholder: '2030.12.31' })}
            </div>

            {C('personal.gender', 'Gender', ['Male', 'Female'], 2, { required: true })}

            <div className="grid gap-4 sm:grid-cols-2">
              {T('personal.religion', 'Religion')}
              {T('personal.nativeLanguage', 'Native Language')}
              {T('personal.officialLanguage', 'Official Language')}
              {T('personal.consulateName', 'Consulate Applying for the Visa')}
              {T('personal.consulateMailbox', 'Mailbox of the Consulate', { className: 'sm:col-span-2' })}
            </div>

            {C('personal.maritalStatus', 'Marital Status', MARITAL_OPTIONS, 3)}
            {C('personal.highestEducation', 'Highest Education Level', EDUCATION_LEVELS, 4)}

            <SubHeading>Present Information</SubHeading>
            {A('personal.presentAddress', 'Address (Street / City / Country)', { rows: 2 })}
            <div className="grid gap-4 sm:grid-cols-3">
              {T('personal.presentTel', 'Tel', { type: 'tel' })}
              {T('personal.presentEmail', 'Email', { type: 'email', required: true })}
              {T('personal.presentPostcode', 'Post code')}
            </div>

            <SubHeading>Permanent Information</SubHeading>
            {A('personal.permanentAddress', 'Address (Street / City / Country)', { rows: 2 })}
            <div className="grid gap-4 sm:grid-cols-3">
              {T('personal.permanentTel', 'Tel', { type: 'tel' })}
              {T('personal.permanentEmail', 'Email', { type: 'email' })}
              {T('personal.permanentPostcode', 'Post code')}
            </div>

            <SubHeading>Language Proficiency</SubHeading>
            {C('personal.chineseProficiency', 'Chinese Language Proficiency', PROFICIENCY)}
            {C('personal.hskLevel', 'Level of HSK', HSK_LEVELS)}
            {C('personal.englishProficiency', 'English Language Proficiency', PROFICIENCY)}
            <div className="grid gap-4 sm:grid-cols-2">
              {T('personal.toefl', 'TOEFL Score')}
              {T('personal.ielts', 'IELTS Results')}
            </div>
          </div>
        )}

        {/* 2 ── EDUCATION */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">From primary school to now.</p>
            {data.education.map((_, i) => (
              <RepeatRow key={i} canRemove={data.education.length > 1} onRemove={() => set('education', data.education.filter((__, idx) => idx !== i))}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {T(`education.${i}.schoolName`, 'School Name')}
                  {T(`education.${i}.years`, 'Years Attended (YY.MM. - YY.MM.)', { placeholder: '2016.09 - 2020.06' })}
                  {T(`education.${i}.major`, 'Major')}
                  {T(`education.${i}.degree`, 'Degree')}
                </div>
              </RepeatRow>
            ))}
            <AddButton onClick={() => set('education', [...data.education, emptyEducation()])}>Add education</AddButton>
          </div>
        )}

        {/* 3 ── WORK */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">If applicants have worked.</p>
            {data.work.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">No work experience added yet.</div>
            )}
            {data.work.map((_, i) => (
              <RepeatRow key={i} canRemove onRemove={() => set('work', data.work.filter((__, idx) => idx !== i))}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {T(`work.${i}.unitName`, 'Working Unit Name')}
                  {T(`work.${i}.years`, 'Years Attended (YY.MM. - YY.MM.)', { placeholder: '2021.07 - 2023.03' })}
                  {T(`work.${i}.position`, 'Position')}
                  {T(`work.${i}.workPlace`, 'Work Place')}
                </div>
              </RepeatRow>
            ))}
            <AddButton onClick={() => set('work', [...data.work, emptyWork()])}>Add work experience</AddButton>
          </div>
        )}

        {/* 4 ── STUDY */}
        {step === 3 && (
          <div className="space-y-6">
            {C('study.degreeType', 'Degree Type', ['Non-Degree', 'Bachelor', 'Master', 'Doctoral'], 4, { required: true })}
            {A('study.proposedMajor', 'Proposed Major (multiple choices)', { rows: 2 })}
            {C('study.teachingLanguage', 'Teaching Language', ['English', 'Chinese'], 2)}

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Duration of Study (YY.MM. - YY.MM.)</span>
              <div className="grid gap-4 sm:grid-cols-2">
                {T('study.durationFrom', 'From', { placeholder: '2026.09' })}
                {T('study.durationTo', 'To', { placeholder: '2030.06' })}
              </div>
            </div>

            {[
              ['Preferred Universities', 'preferredUniNotImportant', 'preferredUniversities', 'e.g. Tsinghua University, Fudan University'],
              ['Preferred City or Province', 'preferredCityNotImportant', 'preferredCity', 'e.g. Beijing, Shanghai, Zhejiang'],
            ].map(([label, flag, textKey, ph]) => (
              <div key={flag} className="rounded-xl border border-slate-200 p-4">
                <CheckGroup
                  label={label}
                  options={['Not important']}
                  value={s[flag] ? ['Not important'] : []}
                  onChange={(v) => {
                    const on = v.includes('Not important');
                    set(`study.${flag}`, on);
                    if (on) set(`study.${textKey}`, ''); // "not important" and a named preference are mutually exclusive
                  }}
                  columns={1}
                />
                {T(`study.${textKey}`, 'Yes — please specify', {
                  className: 'mt-3',
                  placeholder: ph,
                  onChange: (v) => {
                    set(`study.${textKey}`, v);
                    if (v) set(`study.${flag}`, false);
                  },
                })}
              </div>
            ))}

            <div className="rounded-xl border border-slate-200 p-4">
              <SubHeading>Student Category</SubHeading>
              <CheckGroup options={['Self Support']} value={s.selfSupport ? ['Self Support'] : []} onChange={(v) => set('study.selfSupport', v.includes('Self Support'))} columns={1} />
              <div className="mt-3">
                <CheckGroup
                  label="Scholarship (multiple choices)"
                  options={['Full scholarship', 'Partial scholarship']}
                  value={[s.fullScholarship && 'Full scholarship', s.partialScholarship && 'Partial scholarship'].filter(Boolean)}
                  onChange={(v) => {
                    set('study.fullScholarship', v.includes('Full scholarship'));
                    set('study.partialScholarship', v.includes('Partial scholarship'));
                  }}
                  columns={2}
                />
              </div>
              {T('study.otherScholarship', 'Others (any kind of scholarship)', { className: 'mt-3' })}
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Duration of remedial Chinese Study (if needed)</span>
              <div className="grid gap-4 sm:grid-cols-2">
                {T('study.remedialFrom', 'From', { placeholder: '2026.09' })}
                {T('study.remedialTo', 'To', { placeholder: '2027.06' })}
              </div>
            </div>
          </div>
        )}

        {/* 5 / 6 ── FINANCIAL + EMERGENCY (same layout) */}
        {(step === 4 || step === 5) && (() => {
          const k = step === 4 ? 'financial' : 'emergency';
          return (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {T(`${k}.name`, 'Name')}
                {T(`${k}.relationship`, 'Relationship with the applicant')}
                {T(`${k}.email`, 'Email', { type: 'email' })}
                {T(`${k}.telephone`, 'Telephone', { type: 'tel' })}
              </div>
              {A(`${k}.address`, 'Address (Street / City / Country)', { rows: 3 })}
            </div>
          );
        })()}

        {/* 7 ── FAMILY */}
        {step === 6 && (
          <div className="space-y-4">
            {data.family.map((row, i) => (
              <RepeatRow key={row.relation} canRemove={row.relation === 'Spouse'} onRemove={() => set('family', data.family.filter((_, idx) => idx !== i))}>
                <p className="mb-3 text-sm font-bold text-slate-800">{row.relation}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {T(`family.${i}.name`, 'Name')}
                  {T(`family.${i}.age`, 'Age')}
                  {T(`family.${i}.jobTitle`, 'Job title')}
                  {T(`family.${i}.workPlace`, 'Work place')}
                  {T(`family.${i}.phone`, 'Phone', { type: 'tel' })}
                  {T(`family.${i}.email`, 'E-mail', { type: 'email' })}
                </div>
              </RepeatRow>
            ))}
            {!data.family.some((r) => r.relation === 'Spouse') && (
              <AddButton onClick={() => set('family', [...data.family, emptyFamily('Spouse')])}>Add spouse</AddButton>
            )}
          </div>
        )}

        {/* 8 ── DOCUMENTS */}
        {step === 7 && <FileUploads files={files} setFiles={setFiles} setRemovals={setRemovals} />}

        {/* 9 ── AFFIRMATION */}
        {step === 8 && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
              <h3 className="mb-3 font-bold text-slate-900">申请人保证 / I Hereby Affirm That:</h3>
              <ol className="list-decimal space-y-2 pl-5">
                <li>申请表中所填写的内容和提供的材料真实无误；<br /><span className="text-slate-500">All information and materials given in this form are true and correct.</span></li>
                <li>同意申请代理机构接收本人录取材料（包含录取通知书和 JW202）；<br /><span className="text-slate-500">I agree the agency who helps me apply for your school to receive my admission documents (including Admission Notice and JW202).</span></li>
                <li>在华期间，遵守中国的法律、法规，不从事任何危害中国社会秩序的、与本人来华学习身份不符合的活动；<br /><span className="text-slate-500">During my stay in China, I shall abide by the laws and decrees of the Chinese government, and will not participate in any activities in China which are deemed to be adverse to the social order of China and are inappropriate to the capacity as a student.</span></li>
                <li>来华后服从学校的安排，不得无故要求变更学校和所学专业；<br /><span className="text-slate-500">During my study in China, I will obey the arrangements of the school, and will not ask for transferring to another major or another school unreasonably.</span></li>
                <li>在学期间，遵守学校的校纪、校规，全力投入学习和研究工作。尊重学校的教学安排；<br /><span className="text-slate-500">During my study in China, I shall abide by the rules and regulations of the host university, and concentrate on my studies and researches, and follow the teaching programs arranged by the university.</span></li>
                <li>如违反上述保证而受到中国法律、法规或校纪、校规的惩处，我愿意接受中止或取消奖学金及其它相应的处罚。<br /><span className="text-slate-500">If I am judged by the Chinese laws and decrees and the rules and regulations of the university as having violated any of the above, I will not lodge any appeal against the decision on suspending, or withdrawing my scholarship, or other penalties.</span></li>
              </ol>
            </div>

            <div>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 ${errors['affirm.agreed'] ? 'border-rose-400' : 'border-slate-300'}`}>
                <input
                  type="checkbox"
                  checked={data.affirm.agreed}
                  onChange={(ev) => set('affirm.agreed', ev.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">I have read and agree to the above affirmation. / 我已阅读并同意上述保证。</span>
              </label>
              {errors['affirm.agreed'] && <p className="mt-1 text-xs font-medium text-rose-600">{errors['affirm.agreed']}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {T('affirm.signature', 'Signature (type your full name)', {
                required: true,
                placeholder: data.personal.givenName ? `${data.personal.givenName} ${data.personal.surname}`.trim() : 'Your full name',
              })}
              {T('affirm.date', 'Date', { type: 'date' })}
            </div>
            <p className="text-xs text-slate-400">无此签名，申请无效 / The application is invalid without the applicant’s signature.</p>
          </div>
        )}

        {/* ---------- navigation ---------- */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Save draft & exit
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => go(step - 1)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => go(step + 1)} className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={trySubmit}
                disabled={busy}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Working…' : appId ? 'Update application' : 'Submit application'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
