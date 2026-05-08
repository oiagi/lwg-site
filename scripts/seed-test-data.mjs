// scripts/seed-test-data.mjs
// Creates (or removes) test data in Supabase for local development testing.
//
// Usage:
//   node scripts/seed-test-data.mjs           # seed
//   node scripts/seed-test-data.mjs --clean   # remove seeded records
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .dev.vars.
// Set TEST_EMAIL_EN / TEST_EMAIL_DE in .dev.vars to route test emails to a
// real inbox (e.g. yourname+testEN@gmail.com, yourname+testDE@gmail.com).
//
// Records created:
//   students   — Test Student EN (English-preference), Test Student DE (German-preference)
//   teachers   — Test Teacher
//   courses    — TEST-DE-A1 (German A1, public group course, 8 sessions)
//   enrolments — EN student enrolled in TEST-DE-A1 (for send-course-confirmation)
//   enquiries  — DE student pending_course_booking for TEST-DE-A1 (for handle-course-booking)
//
// IDs are saved to .test-data-ids.json so --clean can delete by exact ID.

import fs from 'node:fs';

const IDS_FILE = '.test-data-ids.json';

function loadDotEnv(file = '.dev.vars') {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnv();

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .dev.vars');
  process.exit(1);
}

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

async function insert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...BASE_HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`INSERT ${table}: ${text}`);
  const rows = JSON.parse(text);
  return Array.isArray(data) ? rows : rows[0];
}

async function del(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: BASE_HEADERS,
  });
  if (!res.ok) console.warn(`  WARN DELETE ${table}?${filter}: ${await res.text()}`);
}

function nextWednesdays(count = 8) {
  const now = new Date();
  const daysUntil = (3 - now.getDay() + 7) % 7 || 7;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() + daysUntil + i * 7);
    d.setHours(18, 30, 0, 0);
    return d.toISOString();
  });
}

const isClean = process.argv.includes('--clean');

if (isClean) {
  if (!fs.existsSync(IDS_FILE)) {
    console.log('No test data found (.test-data-ids.json missing). Nothing to remove.');
    process.exit(0);
  }

  const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
  console.log('Removing test data...');

  if (ids.enquiry) {
    await del('enquiries', `id=eq.${ids.enquiry}`);
    console.log('  Deleted enquiry');
  }
  if (ids.enrolment) {
    await del('enrolments', `id=eq.${ids.enrolment}`);
    console.log('  Deleted enrolment');
  }
  if (ids.sessions?.length) {
    for (const sid of ids.sessions) await del('sessions', `id=eq.${sid}`);
    console.log(`  Deleted ${ids.sessions.length} sessions`);
  }
  if (ids.course) {
    await del('courses', `id=eq.${ids.course}`);
    console.log('  Deleted course TEST-DE-A1');
  }
  if (ids.studentEN) {
    await del('students', `id=eq.${ids.studentEN}`);
    console.log('  Deleted student EN');
  }
  if (ids.studentDE) {
    await del('students', `id=eq.${ids.studentDE}`);
    console.log('  Deleted student DE');
  }
  if (ids.teacher) {
    await del('teachers', `id=eq.${ids.teacher}`);
    console.log('  Deleted teacher');
  }

  fs.unlinkSync(IDS_FILE);
  console.log('Done.');
  process.exit(0);
}

// ── Seed ──────────────────────────────────────────────────────────────────
if (fs.existsSync(IDS_FILE)) {
  console.error(
    'Test data already exists (.test-data-ids.json found).\nRun with --clean first to remove it.'
  );
  process.exit(1);
}

const testEmailEN = process.env.TEST_EMAIL_EN || 'test+en@learningwithgioia.ch';
const testEmailDE = process.env.TEST_EMAIL_DE || 'test+de@learningwithgioia.ch';

console.log('Seeding test data...');
console.log(`  Email EN → ${testEmailEN}`);
console.log(`  Email DE → ${testEmailDE}`);
console.log('');

const studentEN = await insert('students', {
  first_name: 'Test',
  last_name: 'Student EN',
  email: testEmailEN,
  phone: '+41 79 000 00 01',
  gender: 'female',
  street: 'Teststrasse',
  street_number: '10',
  postcode: '8001',
  city: 'Zurich',
  emergency_contact: 'Test Emergency',
  ec_relationship: 'friend',
  ec_phone: '+41 79 000 00 99',
  ec_email: 'test+ec-en@learningwithgioia.ch',
  consent_given: true,
  consent_date: new Date().toISOString(),
  source: 'test-seed',
  status: 'active',
  active: true,
});
console.log(`  Student EN:  ${studentEN.id}  (${studentEN.email})`);

const studentDE = await insert('students', {
  first_name: 'Test',
  last_name: 'Student DE',
  email: testEmailDE,
  phone: '+41 79 000 00 02',
  gender: 'male',
  street: 'Musterstrasse',
  street_number: '5',
  postcode: '3000',
  city: 'Bern',
  emergency_contact: 'Test Notfallkontakt',
  ec_relationship: 'Elternteil',
  ec_phone: '+41 79 000 00 88',
  ec_email: 'test+ec-de@learningwithgioia.ch',
  consent_given: true,
  consent_date: new Date().toISOString(),
  source: 'test-seed',
  status: 'active',
  active: true,
});
console.log(`  Student DE:  ${studentDE.id}  (${studentDE.email})`);

const teacher = await insert('teachers', {
  name: 'Test Teacher',
  email: 'test+teacher@learningwithgioia.ch',
  active: true,
});
console.log(`  Teacher:     ${teacher.id}`);

const course = await insert('courses', {
  course_code: 'TEST-DE-A1',
  service: 'German',
  level: 'A1',
  group_type: 'group',
  status: 'active',
  public_booking_enabled: true,
  location: 'classroom',
  location_street: 'Teststrasse',
  location_street_number: '1',
  location_postal_code: '8001',
  location_city: 'Zurich',
  sessions_total: 8,
  sessions_completed: 0,
  session_length_minutes: 60,
  price_per_person_per_60min: 55,
  currency: 'CHF',
});
console.log(`  Course:      ${course.id}  (${course.course_code})`);

const sessionDates = nextWednesdays(8);
const sessionRows = await insert(
  'sessions',
  sessionDates.map((d) => ({ course_id: course.id, scheduled_at: d, status: 'scheduled' }))
);
console.log(
  `  Sessions:    ${sessionRows.length} created  (Wed 18:30, starting ${sessionDates[0].slice(0, 10)})`
);

const enrolment = await insert('enrolments', {
  student_id: studentEN.id,
  course_id: course.id,
});
console.log(`  Enrolment:   ${enrolment.id}  (EN student in TEST-DE-A1)`);

const enquiry = await insert('enquiries', {
  service: 'German',
  lead_first: studentDE.first_name,
  lead_last: studentDE.last_name,
  lead_email: studentDE.email,
  lead_phone: studentDE.phone,
  booking_data: {
    type: 'direct_course_booking',
    lessonType: 'German A1',
    course_id: course.id,
    course_code: course.course_code,
    service: 'German',
    level: 'A1',
    language: 'de',
  },
  contact_data: {
    lead: {
      firstName: studentDE.first_name,
      lastName: studentDE.last_name,
      email: studentDE.email,
      phone: studentDE.phone,
    },
    language: 'de',
  },
  course_id: course.id,
  student_id: studentDE.id,
  status: 'pending_course_booking',
});
console.log(`  Enquiry:     ${enquiry.id}  (DE student, pending_course_booking)`);

const ids = {
  studentEN: studentEN.id,
  studentDE: studentDE.id,
  teacher: teacher.id,
  course: course.id,
  sessions: sessionRows.map((s) => s.id),
  enrolment: enrolment.id,
  enquiry: enquiry.id,
};
fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));

console.log('\nTest data ready. IDs saved to .test-data-ids.json');
console.log('\nWhat you can test now:');
console.log('');
console.log('  send-course-confirmation (POST /api/send-course-confirmation)');
console.log(`    course_id: "${course.id}",  language: "en"  →  emails EN student`);
console.log(`    course_id: "${course.id}",  language: "de"  →  emails EN student in German`);
console.log('');
console.log('  handle-course-booking (POST /api/handle-course-booking)');
console.log(`    enquiry_id: "${enquiry.id}",  action: "approve"  →  enrols DE student`);
console.log(`    enquiry_id: "${enquiry.id}",  action: "decline"  →  sends decline email (DE)`);
console.log('    Note: after approve/decline the enquiry status changes — re-seed to reset.');
console.log('');
console.log('  public group course booking (POST /api/book-course)');
console.log(`    course_id: "${course.id}"  →  uses the live public booking form`);
console.log('    (course is live on /group-courses.html if public_booking_enabled is true)');
