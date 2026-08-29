// ============================================================================
// mock-aeries-server
//
// A local stand-in for the real Aeries SIS REST API (v5), scoped to exactly
// the two endpoints GC Seat needs:
//
//   GET /api/v5/schools/:schoolCode/students/:studentId
//   GET /api/v5/schools/:schoolCode/students/:studentId/programs
//
// Plus one mock-only convenience endpoint (NOT part of the real Aeries API)
// so a StudentID can be looked up by name during local development, since we
// don't yet have real Aeries StudentIDs synced to Google Classroom rosters:
//
//   GET /api/v5/schools/:schoolCode/students/search?name=First+Last
//
// Auth: the real Aeries API expects an `AERIES-CERT` header. This mock
// checks for the same header (against MOCK_AERIES_CERT) purely so the
// gcseat-backend code path that will later call the real API doesn't need
// to change at all — just the base URL and the real cert value.
//
// No real student data ever lives here. Data is either pulled from
// data/students.json (curated fake examples) or generated deterministically
// from the requested name (same name -> same fake data every time).
// ============================================================================

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const MOCK_AERIES_CERT = process.env.MOCK_AERIES_CERT || 'MOCK-CERT-LOCAL-DEV-ONLY';

const seedPath = path.join(__dirname, 'data', 'students.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

// Build a lookup of curated students by normalized name.
const curated = new Map();
for (const entry of seed.students) {
  curated.set(entry.matchName.toLowerCase().trim(), entry);
}

const app = express();
app.use(cors());
app.use(express.json());

// ── Fake-but-deterministic data generation ─────────────────────────────────
// Same input name always produces the same fake record, so re-syncing a
// class doesn't shuffle data underneath a teacher testing the workflow.

const LANGUAGE_CODES = ['ENG', 'SPA', 'VIE', 'HMN', 'KOR', 'ZHO'];
const FLUENCY_CODES = ['EO', 'EL', 'IFEP', 'RFEP'];
const ETHNICITY_CODES = ['W', 'H', 'B', 'A', 'I', 'P', 'T'];
const PROGRAMS = [
  null, // most students have no extra program — matches real-world distribution
  null,
  null,
  { code: 'ELL', name: 'English Language Learner' },
  { code: 'SPED', name: 'Special Education (IEP)' },
  { code: '504', name: 'Section 504 Plan' },
  { code: 'GATE', name: 'Gifted and Talented Education' },
];

function seededInt(seedStr, max) {
  const hash = crypto.createHash('md5').update(seedStr).digest();
  return hash.readUInt32BE(0) % max;
}

function fakeStudentIdFor(name) {
  // Deterministic 6-digit fake ID in a range that will never collide with the
  // curated examples (900001-900004).
  return 100000 + seededInt(name + ':id', 800000);
}

function generateStudent(name) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || 'Unknown';
  const lastName = parts.slice(1).join(' ') || 'Student';
  const id = fakeStudentIdFor(name);
  const grade = 9 + seededInt(name + ':grade', 4);
  const homeLang = LANGUAGE_CODES[seededInt(name + ':lang', LANGUAGE_CODES.length)];
  const fluency = homeLang === 'ENG' ? 'EO' : FLUENCY_CODES[seededInt(name + ':fluency', FLUENCY_CODES.length)];
  const ethnicity = ETHNICITY_CODES[seededInt(name + ':eth', ETHNICITY_CODES.length)];
  const birthYear = 2026 - grade - 5;
  const birthMonth = String(1 + seededInt(name + ':bm', 12)).padStart(2, '0');
  const birthDay = String(1 + seededInt(name + ':bd', 28)).padStart(2, '0');

  const program = PROGRAMS[seededInt(name + ':program', PROGRAMS.length)];

  const studentInfo = {
    StudentID: id,
    FirstName: firstName,
    LastName: lastName,
    MiddleName: '',
    Grade: grade,
    Birthdate: `${birthYear}-${birthMonth}-${birthDay}`,
    HomeLanguageCode: homeLang,
    LanguageFluencyCode: fluency,
    CorrespondenceLanguageCode: homeLang === 'ENG' ? 'ENG' : homeLang,
    EthnicityCode: ethnicity,
    InactiveStatusCode: null,
  };

  const programs = program
    ? [{
      StudentID: id,
      SchoolCode: 1,
      ProgramCode: program.code,
      ProgramName: program.name,
      StartDate: '2024-08-15',
      EndDate: null,
    }]
    : [];

  return { studentInfo, programs };
}

function findByName(name) {
  const key = name.toLowerCase().trim();
  if (curated.has(key)) {
    const entry = curated.get(key);
    return { studentInfo: entry.studentInfo, programs: entry.programs };
  }
  return generateStudent(name);
}

function findById(studentId) {
  const id = Number(studentId);
  for (const entry of curated.values()) {
    if (entry.studentInfo.StudentID === id) {
      return { studentInfo: entry.studentInfo, programs: entry.programs };
    }
  }
  // Generated students are keyed by name, but we can still serve a
  // plausible record for any fake ID in the generated range so that a
  // StudentID obtained from /search works with the ID-based endpoints too.
  // We store a small in-memory reverse map as names get looked up.
  const cached = idCache.get(id);
  if (cached) return cached;
  return null;
}

const idCache = new Map(); // fake StudentID -> { studentInfo, programs }

// ── Auth check — mirrors the real Aeries AERIES-CERT header requirement ────
function requireCert(req, res, next) {
  const cert = req.header('AERIES-CERT');
  if (!cert) {
    return res.status(401).json({ error: 'Missing AERIES-CERT header' });
  }
  if (cert !== MOCK_AERIES_CERT) {
    return res.status(403).json({ error: 'Invalid AERIES-CERT' });
  }
  next();
}

// Health check first, before the cert gate — no auth needed just to see if
// the server is up.
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'mock-aeries-server' });
});

app.use(requireCert);

// ── Mock-only convenience endpoint (not part of the real Aeries API) ──────
// Lets gcseat-backend resolve "First Last" -> StudentID during local dev,
// standing in for the real roster-to-StudentID sync that will exist later.
// Registered BEFORE the /:studentId routes below — otherwise Express would
// match "search" as a :studentId value and this route would never fire.

app.get('/api/v5/schools/:schoolCode/students/search', (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'name query param required' });
  const record = findByName(String(name));
  idCache.set(record.studentInfo.StudentID, record);
  res.json({ StudentID: record.studentInfo.StudentID, mock: !curated.has(String(name).toLowerCase().trim()) });
});

// ── Real Aeries-shaped endpoints ────────────────────────────────────────────

app.get('/api/v5/schools/:schoolCode/students/:studentId', (req, res) => {
  const record = findById(req.params.studentId);
  if (!record) return res.status(404).json({ error: 'Student not found' });
  res.json(record.studentInfo);
});

app.get('/api/v5/schools/:schoolCode/students/:studentId/programs', (req, res) => {
  const record = findById(req.params.studentId);
  if (!record) return res.status(404).json({ error: 'Student not found' });
  res.json(record.programs);
});

app.listen(PORT, () => {
  console.log(`mock-aeries-server listening on http://localhost:${PORT}`);
  console.log(`Expecting AERIES-CERT header: ${MOCK_AERIES_CERT}`);
});
