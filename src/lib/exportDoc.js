/* Builds an HTML version of the official APPLICATION FORM filled with the applicant's answers.
     printForm()    → opens a print window (the user can choose "Save as PDF")
     downloadPDF()  → generates a real .pdf with html2pdf.js (bundled, no CDN)
   All CSS is scoped under .form-root so injecting it never restyles the app itself. */

import { FILE_FIELDS } from '../formConfig.js';

/* ---------- escaping ---------- */
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const escBr = (v) => esc(v).replace(/\r?\n/g, '<br>');

// `raw()` marks HTML we built ourselves; everything else is escaped exactly once in val().
const raw = (html) => ({ __html: html });
const val = (v) => (v && typeof v === 'object' && '__html' in v ? v.__html : escBr(v));

const tick = (cond) => (cond ? '☑' : '☐');
const opts = (selected, list) => list.map((o) => `${tick(selected === o)} ${esc(o)}`).join(' &nbsp;&nbsp; ');

/* ---------- table helpers (4-column grid, like the original form) ---------- */
const row2 = (l1, v1, l2, v2) =>
  `<tr><td class="lbl">${esc(l1)}</td><td class="val">${val(v1)}</td><td class="lbl">${esc(l2)}</td><td class="val">${val(v2)}</td></tr>`;
const row1 = (label, value) => `<tr><td class="lbl">${esc(label)}</td><td class="val" colspan="3">${val(value)}</td></tr>`;

// "Present / Permanent Information": one merged label cell spanning Address / Tel / Email + Post code, as in the original.
const addressBlock = (label, address, tel, email, post) =>
  `<tr><td class="lbl" rowspan="3">${esc(label)}</td><td class="val tall" colspan="3"><span class="sub">Address (Street/ City/ Country):</span><br>${escBr(address)}</td></tr>` +
  `<tr><td class="val" colspan="3"><span class="sub">Tel:</span> ${esc(tel)}</td></tr>` +
  `<tr><td class="val" colspan="2"><span class="sub">Email:</span> ${esc(email)}</td><td class="val"><span class="sub">Post code:</span> ${esc(post)}</td></tr>`;

const gridRows = (list, keys, min = 3) => {
  const rows = list.map((r) => `<tr>${keys.map((k) => `<td>${esc(r[k])}</td>`).join('')}</tr>`);
  while (rows.length < min) rows.push(`<tr>${keys.map(() => '<td>&nbsp;</td>').join('')}</tr>`);
  return rows.join('');
};

export const FORM_CSS = `
.form-root { font-family: "Times New Roman","SimSun",serif; font-size: 10.5pt; color:#000; background:#fff; line-height:1.35; }
.form-root, .form-root * { box-sizing: border-box; }
.form-root h1 { font-size:16pt; text-align:center; margin:0 0 10px; letter-spacing:1px; }
.form-root h2 { font-size:12pt; margin:18px 0 6px; padding-bottom:3px; border-bottom:1px solid #000; page-break-after:avoid; }
.form-root p.note { font-size:9pt; color:#333; margin:2px 0; line-height:1.4; }
.form-root p.meta { margin:0 0 12px; font-size:9.5pt; }
.form-root p.doc { margin:2px 0 2px 14px; font-size:10pt; }
.form-root table { border-collapse:collapse; width:100%; margin-bottom:4px; }
.form-root tr { page-break-inside:avoid; }
.form-root td { border:1px solid #000; padding:4px 6px; vertical-align:top; font-size:10pt; }
.form-root td.lbl { background:#f0f0f0; font-weight:bold; width:22%; }
.form-root td.val { width:28%; word-break:break-word; }
.form-root td.tall { height:34px; }
.form-root .sub { color:#444; font-size:9pt; }
.form-root .sign { margin-top:28px; page-break-inside:avoid; }
.form-root .sign p { margin:6px 0; }
`;
const PAGE_CSS = `@page { size:A4; margin:14mm; } body { margin:0; } @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }`;

/** `files` is the app's file map ({ fieldKey: [{name,...}] }); it only drives the ☑/☐ attachment checklist. */
export function buildFormBody(record, id, files = {}) {
  const p = record?.personal || {};
  const s = record?.study || {};
  const f = record?.financial || {};
  const em = record?.emergency || {};
  const affirm = record?.affirm || {};
  const scholarshipOn = Boolean(s.fullScholarship || s.partialScholarship || s.otherScholarship);

  const familyRows = (record?.family || [])
    .map(
      (r) =>
        `<tr><td class="lbl">${esc(r.relation)}</td><td>${esc(r.name)}</td><td>${esc(r.age)}</td><td>${esc(r.jobTitle)}</td>` +
        `<td>${esc(r.workPlace)}</td><td>${esc(r.phone)}</td><td>${esc(r.email)}</td></tr>`
    )
    .join('');

  const prefer = (notImportant, text) =>
    raw(`${tick(notImportant)} not important<br>${tick(!notImportant && Boolean(text))} Yes: ${esc(text)}`);

  const docs = FILE_FIELDS.map(
    (d) => `<p class="doc">${tick((files[d.key] || []).length > 0)} ${esc(d.label)}</p>`
  ).join('');

  return `
<h1>APPLICATION FORM</h1>
<p class="note">请用中文或英文填写此表格。请用电脑打印或用蓝色或黑色钢笔认真书写表格内容。请在所选项框内划“√”表示。不按规定填写的表格将视作无效。</p>
<p class="note">Please complete the form in Chinese or English. Fill the form on PC or write neatly in black or blue ink. Tick ☑ where applicable. Any form that does not follow the notes will be invalid.</p>
<p class="meta"><b>Application ID / 申请编号:</b> ${esc(id)}</p>

<h2>1. Personal Information</h2>
<table>
  ${row2('Surname (like in passport)', p.surname, 'Given name (like in passport)', p.givenName)}
  ${row2('Date of Birth (YYYY.MM.DD)', p.dob, 'Place of Birth', p.placeOfBirth)}
  ${row2('Nationality', p.nationality, 'Present Country/City', p.presentCountryCity)}
  ${row2('Passport No.', p.passportNo, 'Passport Expiration Date', p.passportExpiry)}
  ${row2('Gender', raw(opts(p.gender, ['Male', 'Female'])), 'Religion', p.religion)}
  ${row2('Native Language', p.nativeLanguage, 'Official Language', p.officialLanguage)}
  ${row2('The Name of the Consulate Applying for the Visa', p.consulateName, 'The Mailbox of the Consulate Applying for the Visa', p.consulateMailbox)}
  ${row1('Marital Status', raw(opts(p.maritalStatus, ['Single', 'Married', 'Other'])))}
  ${row1('Highest Education Level', raw(opts(p.highestEducation, ['High School', 'Bachelor', 'Master', 'Doctoral'])))}
  ${addressBlock('Present Information', p.presentAddress, p.presentTel, p.presentEmail, p.presentPostcode)}
  ${addressBlock('Permanent Information', p.permanentAddress, p.permanentTel, p.permanentEmail, p.permanentPostcode)}
  ${row1('Chinese Language Proficiency', raw(opts(p.chineseProficiency, ['Excellent', 'Good', 'Poor', 'None'])))}
  ${row1('Level of HSK', raw(opts(p.hskLevel, ['No', 'HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'])))}
  ${row1('English Language Proficiency', raw(opts(p.englishProficiency, ['Excellent', 'Good', 'Poor', 'None'])))}
  ${row2('TOFEL Score', p.toefl, 'IELTS Results', p.ielts)}
</table>

<h2>2. Education Background (From primary school to now)</h2>
<table>
  <tr><td class="lbl">School Name</td><td class="lbl">Years Attended (YY.MM. - YY.MM.)</td><td class="lbl">Major</td><td class="lbl">Degree</td></tr>
  ${gridRows(record?.education || [], ['schoolName', 'years', 'major', 'degree'])}
</table>

<h2>3. Work Experience (If applicants have worked)</h2>
<table>
  <tr><td class="lbl">Working Unit Name</td><td class="lbl">Years Attended (YY.MM. - YY.MM.)</td><td class="lbl">Position</td><td class="lbl">Work Place</td></tr>
  ${gridRows(record?.work || [], ['unitName', 'years', 'position', 'workPlace'])}
</table>

<h2>4. Proposed Study in China</h2>
<table>
  ${row1('Degree Type', raw(opts(s.degreeType, ['Non-Degree', 'Bachelor', 'Master', 'Doctoral'])))}
  ${row1('Proposed Major (Multiple Choices)', s.proposedMajor)}
  ${row1('Teaching Language', raw(opts(s.teachingLanguage, ['English', 'Chinese'])))}
  ${row1('Duration of Study (YY.MM.-YY.MM.)', raw(`From ${esc(s.durationFrom)} &nbsp; To ${esc(s.durationTo)}`))}
  ${row1('Preferred Universities', prefer(s.preferredUniNotImportant, s.preferredUniversities))}
  ${row1('Preferred City or Province', prefer(s.preferredCityNotImportant, s.preferredCity))}
  ${row1('Student Category', raw(
    `${tick(s.selfSupport)} Self Support<br>` +
    `${tick(scholarshipOn)} Scholarship (multiple choices): ${tick(s.fullScholarship)} Full scholarship &nbsp; ${tick(s.partialScholarship)} Partial scholarship &nbsp; ${tick(Boolean(s.otherScholarship))} Others (any kind of scholarship): ${esc(s.otherScholarship)}`
  ))}
  ${row1('Duration of remedial Chinese Study if needed', raw(`From ${esc(s.remedialFrom)} &nbsp; To ${esc(s.remedialTo)}`))}
</table>

<h2>5. Financial Supporter</h2>
<table>
  ${row2('Name', f.name, 'Relationship with the applicant', f.relationship)}
  ${row2('Email', f.email, 'Telephone', f.telephone)}
  ${row1('Address (Street/ City/ Country)', f.address)}
</table>

<h2>6. Emergency contact in China</h2>
<table>
  ${row2('Name', em.name, 'Relationship with the applicant', em.relationship)}
  ${row2('Email', em.email, 'Telephone', em.telephone)}
  ${row1('Address (Street/ City/ Country)', em.address)}
</table>

<h2>7. Family members of the applicant</h2>
<table>
  <tr><td class="lbl">&nbsp;</td><td class="lbl">Name</td><td class="lbl">Age</td><td class="lbl">Job title</td><td class="lbl">Work place</td><td class="lbl">Phone</td><td class="lbl">E-mail</td></tr>
  ${familyRows}
</table>

<h2>Please attach the following documents</h2>
${docs}
<p class="note">Note: All certificates or Diploma issued in the third language should be notarized in Chinese or English editions.</p>

<h2>申请人保证 / I Hereby Affirm That:</h2>
<p class="note">1、申请表中所填写的内容和提供的材料真实无误；<br>All information and materials given in this form are true and correct.</p>
<p class="note">2、同意申请代理机构接收本人录取材料(包含录取通知书和JW202)；<br>I agree the agency who helps me apply for your school to receive my admission documents (including Admission Notice and JW202).</p>
<p class="note">3、在华期间，遵守中国的法律、法规，不从事任何危害中国社会秩序的、与本人来华学习身份不符合的活动；<br>During my stay in China, I shall abide by the laws and decrees of the Chinese government, and will not participate in any activities in China which are deemed to be adverse to the social order of China and are inappropriate to the capacity as a student.</p>
<p class="note">4、来华后服从学校的安排，不得无故要求变更学校和所学专业；<br>During my study in China, I will obey the arrangements of the school, and will not ask for transferring to another major or another school unreasonably.</p>
<p class="note">5、在学期间，遵守学校的校纪、校规，全力投入学习和研究工作。尊重学校的教学安排；<br>During my study in China, I shall abide by the rules and regulations of the host university, and concentrate on my studies and researches, and follow the teaching programs arranged by the university.</p>
<p class="note">6、如违反上述保证而受到中国法律、法规或校纪、校规的惩处，我愿意接受中止或取消奖学金及其它相应的处罚。<br>If I am judged by the Chinese laws and decrees and the rules and regulations of the university as having violated any of the above, I will not lodge any appeal against the decision on suspending, or withdrawing my scholarship, or other penalties.</p>
<p class="note" style="margin-top:8px;"><b>${tick(affirm.agreed)} I have read and agree to the above affirmation.</b></p>

<div class="sign">
  <p><b>申请人签字/Signature:</b> ${esc(affirm.signature)} &nbsp;&nbsp;&nbsp; <b>日期/Date:</b> ${esc(affirm.date)}</p>
  <p class="note">（无此签名，申请无效/The application is invalid without the applicant’s signature）</p>
</div>`;
}

export function buildFormHTML(record, id, files = {}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(id)} — Application Form</title>
<style>${PAGE_CSS}${FORM_CSS}</style></head>
<body><div class="form-root">${buildFormBody(record, id, files)}</div></body></html>`;
}

/* ---------- PRINT (user can "Save as PDF" in the dialog) ---------- */
export function printForm(record, id, files = {}) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Please allow pop-ups for this site to print the form.');
    return;
  }
  w.document.open();
  w.document.write(buildFormHTML(record, id, files));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

/* ---------- PDF download ---------- */
export async function downloadPDF(record, id, files = {}) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:780px;background:#fff;';
  container.innerHTML = `<style>${FORM_CSS}</style><div class="form-root">${buildFormBody(record, id, files)}</div>`;
  document.body.appendChild(container);
  try {
    const { default: html2pdf } = await import('html2pdf.js');
    await html2pdf()
      .set({
        margin: [10, 8, 10, 8],
        filename: `${id || 'application'}_Application_Form.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
      })
      .from(container)
      .save();
  } catch (e) {
    console.warn('PDF generation failed, falling back to the print dialog:', e);
    printForm(record, id, files);
  } finally {
    container.remove();
  }
}
