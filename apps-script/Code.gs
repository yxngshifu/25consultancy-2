/* ═══════════════════════════════════════════════════════════════════════════
   25CONSULTANCY — APPLICATION BACKEND (Google Apps Script web app)

   Sheet FILE : "Applicant Data"        (you create it; this script is bound to it or uses SHEET_ID)
   Sheet TAB  : "Applications"          (created automatically if missing)
   Drive      : <PARENT_FOLDER_ID>/<APPLICATION_ID>/<field>__<original file name>

   Actions (POST, body is JSON sent as text/plain):
     save    { id, record, isNew }          → create / update the sheet row + the Drive folder
     upload  { id, field, name, data }      → one file (base64) into the applicant's folder
     remove  { id, field, name }            → move one file to the Drive trash
   GET ?id=<ID> → { record, files:[{field,name,size}] }   (used by "open my application")

   NOTE: the Drive folder URL is stored in the sheet for staff only and is never returned to applicants.
   ═══════════════════════════════════════════════════════════════════════════ */

const SHEET_ID         = 'PUT_YOUR_SPREADSHEET_ID_HERE';
const PARENT_FOLDER_ID = 'PUT_YOUR_DRIVE_PARENT_FOLDER_ID_HERE';
const SHEET_NAME       = 'Applications';

const ID_RE          = /^APP-\d{4}-[A-Z0-9]{10}$/;        // must match src/lib/store.js
const MAX_FILE_BYTES = 10 * 1024 * 1024;                  // must match src/formConfig.js
const MAX_FILES_PER_APP = 40;
const MAX_JSON_CHARS = 45000;                             // a Sheets cell holds at most 50,000 characters
const ALLOWED_EXT    = /\.(pdf|jpe?g|png|docx?)$/i;
// must match FILE_FIELDS[].key in src/formConfig.js
const ALLOWED_FIELDS = ['passport','photo','diploma','transcripts','recommendation','cv','physicalTest',
                        'studyPlan','thesis','transferLetter','studyCertificate','hsk','policeClearance'];

const MIME_BY_EXT = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const HEADERS = [
  'Application ID','Submitted At','Updated At',
  'Surname','Given Name','Date of Birth','Place of Birth','Nationality','Present Country/City',
  'Passport No.','Passport Expiry','Gender','Religion','Native Language','Official Language',
  'Consulate Name','Consulate Mailbox','Marital Status','Highest Education',
  'Present Address','Present Tel','Present Email','Present Postcode',
  'Permanent Address','Permanent Tel','Permanent Email','Permanent Postcode',
  'Chinese Proficiency','HSK Level','English Proficiency','TOEFL','IELTS',
  'Education (summary)','Work (summary)',
  'Degree Type','Proposed Major','Teaching Language','Study From','Study To',
  'Preferred Universities','Preferred City','Student Category',
  'Financial Supporter','Supporter Relationship','Supporter Email','Supporter Phone','Supporter Address',
  'Emergency Contact','Emergency Relationship','Emergency Email','Emergency Phone','Emergency Address',
  'Father','Mother','Spouse','Drive Folder URL','Raw JSON'
];
const COL_SUBMITTED = HEADERS.indexOf('Submitted At');
const COL_RAW       = HEADERS.indexOf('Raw JSON');

/* ───────────────────────────── entry points ───────────────────────────── */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);                       // serialise writes: no duplicate rows, no lost updates
    const body = JSON.parse(e.postData.contents);
    checkId(body.id);
    switch (body.action) {
      case 'save':   return json(saveRecord(body));
      case 'upload': return json(uploadFile(body));
      case 'remove': return json(removeFile(body));
      default: throw fail('Unknown action');
    }
  } catch (err) {
    return json({ ok: false, error: String(err.message || err), code: err.code || 'ERROR' });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function doGet(e) {
  try {
    const id = e && e.parameter && e.parameter.id;
    checkId(id);
    const sheet = getOrCreateSheet(SpreadsheetApp.openById(SHEET_ID));
    const rowNo = findRow(sheet, id);
    if (rowNo === -1) throw fail('Not found', 'NOT_FOUND');

    const raw = sheet.getRange(rowNo, COL_RAW + 1).getValue();
    const record = JSON.parse(raw || '{}');

    const files = [];
    const folder = getExistingFolder(id);
    if (folder) {
      const it = folder.getFiles();
      while (it.hasNext()) {
        const f = it.next();
        const name = f.getName();
        const sep = name.indexOf('__');
        const field = sep > 0 ? name.slice(0, sep) : '';
        if (ALLOWED_FIELDS.indexOf(field) !== -1) files.push({ field: field, name: name.slice(sep + 2), size: f.getSize() });
      }
    }
    return json({ ok: true, record: record, files: files });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err), code: err.code || 'ERROR' });
  }
}

/* ───────────────────────────── actions ───────────────────────────── */

function saveRecord(body) {
  const record = body.record;
  if (!record || typeof record !== 'object') throw fail('Missing record');
  const rawJson = JSON.stringify(record);
  if (rawJson.length > MAX_JSON_CHARS) throw fail('Application data is too large');

  const sheet = getOrCreateSheet(SpreadsheetApp.openById(SHEET_ID));
  const existingRow = findRow(sheet, body.id);
  if (existingRow !== -1 && body.isNew) throw fail('ID already exists', 'ID_EXISTS');

  const folder = getOrCreateFolder(body.id);
  const nowIso = new Date().toISOString();
  const submittedAt = existingRow !== -1 ? String(sheet.getRange(existingRow, COL_SUBMITTED + 1).getValue()) : nowIso;

  const row = buildRow(body.id, record, folder.getUrl(), submittedAt, nowIso, rawJson);
  const target = existingRow !== -1 ? existingRow : Math.max(sheet.getLastRow(), 1) + 1;
  const range = sheet.getRange(target, 1, 1, row.length);
  range.setNumberFormat('@');                   // store everything as text: keeps "2026.09", "00123", "+234…" intact and
  range.setValues([row]);                       // prevents values starting with = + - @ from being run as formulas
  return { ok: true, rowNumber: target };
}

function uploadFile(body) {
  const field = body.field;
  if (ALLOWED_FIELDS.indexOf(field) === -1) throw fail('Unknown document type');
  const name = safeName(body.name);
  if (!ALLOWED_EXT.test(name)) throw fail('File type not allowed');
  if (typeof body.data !== 'string' || !body.data) throw fail('Empty file');
  if (body.data.length > MAX_FILE_BYTES * 1.4) throw fail('File too large');      // base64 is ~4/3 of the bytes

  const folder = getExistingFolder(body.id);
  if (!folder) throw fail('Save the application before uploading files', 'NO_FOLDER');
  if (countFiles(folder) >= MAX_FILES_PER_APP) throw fail('Too many files for this application');

  const bytes = Utilities.base64Decode(body.data);
  if (bytes.length > MAX_FILE_BYTES) throw fail('File too large');

  const ext = name.split('.').pop().toLowerCase();
  const driveName = field + '__' + name;                      // field prefix → same file name in two slots cannot collide
  trashByName(folder, driveName);                              // re-upload with the same name replaces the old copy
  folder.createFile(Utilities.newBlob(bytes, MIME_BY_EXT[ext] || 'application/octet-stream', driveName));
  return { ok: true };
}

function removeFile(body) {
  if (ALLOWED_FIELDS.indexOf(body.field) === -1) throw fail('Unknown document type');
  const folder = getExistingFolder(body.id);
  if (folder) trashByName(folder, body.field + '__' + safeName(body.name));
  return { ok: true };
}

/* ───────────────────────────── helpers ───────────────────────────── */

function fail(message, code) { const e = new Error(message); e.code = code || 'ERROR'; return e; }
function checkId(id) { if (typeof id !== 'string' || !ID_RE.test(id)) throw fail('Invalid application ID', 'BAD_ID'); }
function safeName(n) { return String(n || '').replace(/[\\\/:*?"<>|\r\n]/g, '_').slice(0, 150); }

function findRow(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function getExistingFolder(id) {
  const it = DriveApp.getFolderById(PARENT_FOLDER_ID).getFoldersByName(id);
  return it.hasNext() ? it.next() : null;
}
function getOrCreateFolder(id) {
  return getExistingFolder(id) || DriveApp.getFolderById(PARENT_FOLDER_ID).createFolder(id);
}
function trashByName(folder, name) {
  const it = folder.getFilesByName(name);
  while (it.hasNext()) it.next().setTrashed(true);
}
function countFiles(folder) {
  var n = 0; const it = folder.getFiles();
  while (it.hasNext()) { it.next(); n++; }
  return n;
}

function getOrCreateSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function buildRow(id, r, folderUrl, submittedAt, updatedAt, rawJson) {
  const p = r.personal || {}, s = r.study || {}, f = r.financial || {}, em = r.emergency || {};
  const fam = r.family || [];
  const person = function (rel) {
    const m = fam.filter(function (x) { return x.relation === rel; })[0];
    if (!m) return '';
    return [m.name, m.age && ('age ' + m.age), m.jobTitle, m.workPlace, m.phone, m.email].filter(Boolean).join(' | ');
  };
  const join = function (list, keys) {
    return (list || []).map(function (x) {
      return keys.map(function (k) { return x[k]; }).filter(Boolean).join(' | ');
    }).filter(Boolean).join('\n');
  };
  const scholarships = [s.fullScholarship && 'Full', s.partialScholarship && 'Partial'].filter(Boolean).join(', ');
  const category = [
    s.selfSupport && 'Self Support',
    scholarships && ('Scholarship: ' + scholarships),
    s.otherScholarship && ('Other: ' + s.otherScholarship)
  ].filter(Boolean).join('; ');
  const prefer = function (notImportant, text) { return notImportant ? 'Not important' : (text || ''); };

  return [
    id, submittedAt, updatedAt,
    p.surname, p.givenName, p.dob, p.placeOfBirth, p.nationality, p.presentCountryCity,
    p.passportNo, p.passportExpiry, p.gender, p.religion, p.nativeLanguage, p.officialLanguage,
    p.consulateName, p.consulateMailbox, p.maritalStatus, p.highestEducation,
    p.presentAddress, p.presentTel, p.presentEmail, p.presentPostcode,
    p.permanentAddress, p.permanentTel, p.permanentEmail, p.permanentPostcode,
    p.chineseProficiency, p.hskLevel, p.englishProficiency, p.toefl, p.ielts,
    join(r.education, ['schoolName', 'years', 'major', 'degree']),
    join(r.work, ['unitName', 'years', 'position', 'workPlace']),
    s.degreeType, s.proposedMajor, s.teachingLanguage, s.durationFrom, s.durationTo,
    prefer(s.preferredUniNotImportant, s.preferredUniversities),
    prefer(s.preferredCityNotImportant, s.preferredCity),
    category,
    f.name, f.relationship, f.email, f.telephone, f.address,
    em.name, em.relationship, em.email, em.telephone, em.address,
    person('Father'), person('Mother'), person('Spouse'),
    folderUrl, rawJson
  ].map(function (v) { return v === undefined || v === null ? '' : String(v); });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
