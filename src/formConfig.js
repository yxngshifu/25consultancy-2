export const emptyEducation = () => ({ schoolName: '', years: '', major: '', degree: '' });
export const emptyWork = () => ({ unitName: '', years: '', position: '', workPlace: '' });
export const emptyFamily = (relation) => ({ relation, name: '', age: '', jobTitle: '', workPlace: '', phone: '', email: '' });

/** Local calendar date as YYYY-MM-DD (toISOString() would give the UTC date, which can be off by one). */
export const todayLocal = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Always returns a fresh object so state is never shared between applications. */
export function makeInitialData() {
  return {
    personal: {
      surname: '', givenName: '', dob: '', placeOfBirth: '', nationality: '', presentCountryCity: '',
      passportNo: '', passportExpiry: '', gender: '', religion: '', nativeLanguage: '', officialLanguage: '',
      consulateName: '', consulateMailbox: '', maritalStatus: '', highestEducation: '',
      presentAddress: '', presentTel: '', presentEmail: '', presentPostcode: '',
      permanentAddress: '', permanentTel: '', permanentEmail: '', permanentPostcode: '',
      chineseProficiency: '', hskLevel: '', englishProficiency: '', toefl: '', ielts: '',
    },
    education: [emptyEducation()],
    work: [],
    study: {
      degreeType: '',
      proposedMajor: 'CHINESE LANGUAGE',
      teachingLanguage: '',
      durationFrom: '',
      durationTo: '',
      preferredUniNotImportant: false,
      preferredUniversities: '',
      preferredCityNotImportant: false,
      preferredCity: '',
      selfSupport: false,
      fullScholarship: false,
      partialScholarship: false,
      otherScholarship: '',
      remedialFrom: '',
      remedialTo: '',
    },
    financial: { name: '', relationship: '', email: '', telephone: '', address: '' },
    emergency: { name: '', relationship: '', email: '', telephone: '', address: '' },
    family: [emptyFamily('Father'), emptyFamily('Mother'), emptyFamily('Spouse')],
    affirm: { agreed: false, signature: '', date: todayLocal() },
  };
}

/** Merge saved data over fresh defaults so older / partial records never crash the form. */
export function mergeData(saved) {
  const base = makeInitialData();
  if (!saved || typeof saved !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (Array.isArray(base[key])) out[key] = Array.isArray(saved[key]) ? saved[key] : base[key];
    else out[key] = { ...base[key], ...(saved[key] && typeof saved[key] === 'object' ? saved[key] : {}) };
  }
  if (out.education.length === 0) out.education = base.education;
  return out;
}

// `key` is also used as the file-name prefix in Drive (<key>__<original name>) and must match ALLOWED_FIELDS in Code.gs.
export const FILE_FIELDS = [
  { key: 'passport', label: 'Scanned copy of passport', required: true, multiple: false },
  { key: 'photo', label: 'Passport size photograph', required: true, multiple: false },
  { key: 'diploma', label: 'Highest diploma certificate (English or Chinese version)', required: true, multiple: false },
  { key: 'transcripts', label: 'Official transcripts with marking criterion (English or Chinese version)', required: true, multiple: true },
  { key: 'recommendation', label: 'Two recommendation letters from professors in the same academic field', required: true, multiple: true },
  { key: 'cv', label: 'CV', required: true, multiple: false },
  { key: 'physicalTest', label: 'Physical test', required: true, multiple: false },
  { key: 'studyPlan', label: 'Study plan (no less than 800 words)', required: true, multiple: false },
  { key: 'thesis', label: 'Thesis (only for students applying for PhD majors)', required: false, multiple: false },
  { key: 'transferLetter', label: 'Transfer letter with attendance rate (only for students already studying in China who want to transfer)', required: false, multiple: false },
  { key: 'studyCertificate', label: 'Study certificate (only for students who have already studied in China)', required: false, multiple: false },
  { key: 'hsk', label: 'Certificate of HSK test or other certificates showing your Chinese level (if available)', required: false, multiple: true },
  { key: 'policeClearance', label: 'Non criminal record (police clearance)', required: true, multiple: false },
];

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // keep in sync with Code.gs
export const ALLOWED_FILE_RE = /\.(pdf|jpe?g|png|docx?)$/i;

export const MARITAL_OPTIONS = ['Single', 'Married', 'Other'];
export const EDUCATION_LEVELS = ['High School', 'Bachelor', 'Master', 'Doctoral'];
export const PROFICIENCY = ['Excellent', 'Good', 'Poor', 'None'];
export const HSK_LEVELS = ['No', 'HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
