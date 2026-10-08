import { FILE_FIELDS } from '../formConfig.js';

const REQUIRED = [
  ['personal.surname', 'Surname'],
  ['personal.givenName', 'Given name'],
  ['personal.dob', 'Date of birth'],
  ['personal.nationality', 'Nationality'],
  ['personal.passportNo', 'Passport number'],
  ['personal.passportExpiry', 'Passport expiration date'],
  ['personal.gender', 'Gender'],
  ['personal.presentEmail', 'Email'],
  ['study.degreeType', 'Degree type'],
  ['affirm.signature', 'Signature'],
];

const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);

/** Returns { 'personal.surname': 'Surname is required', ... } (empty object = valid). */
export function validate(data) {
  const errors = {};
  for (const [path, label] of REQUIRED) {
    const v = get(data, path);
    if (!String(v ?? '').trim()) errors[path] = `${label} is required`;
  }
  const email = String(data.personal.presentEmail || '').trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors['personal.presentEmail'] = 'Enter a valid email address';
  if (!data.affirm.agreed) errors['affirm.agreed'] = 'Please tick the affirmation box';
  return errors;
}

/** Which wizard step (0-based, see STEPS in ApplicationForm) a field path lives on. */
export function stepOf(path) {
  if (path.startsWith('study')) return 3;
  if (path.startsWith('affirm')) return 8;
  return 0;
}

export const missingDocs = (files) => FILE_FIELDS.filter((f) => f.required && !(files?.[f.key]?.length > 0));
