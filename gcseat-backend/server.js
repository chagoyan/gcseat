// ============================================================================
// gcseat-backend
//
// Sits between the GC Seat frontend and the Aeries API (mock today, real
// later). This is the ONLY piece of the whole stack that ever holds the
// AERIES-CERT or talks to Aeries directly — the frontend calls this backend
// over plain HTTP with no credentials, and this backend attaches the cert
// itself before forwarding to Aeries.
//
// This mirrors exactly how the real integration must work for security:
// the cert lives in an environment variable on a server, never in
// client-side JS, never in a browser request a student could inspect.
// ============================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3001;
const AERIES_BASE_URL = process.env.AERIES_BASE_URL || 'http://localhost:4000';
const AERIES_CERT = process.env.AERIES_CERT || '';
const AERIES_SCHOOL_CODE = process.env.AERIES_SCHOOL_CODE || '1';
const AERIES_MODE = (process.env.AERIES_MODE || 'mock').toLowerCase();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:8081';

if (!AERIES_CERT) {
  console.warn('WARNING: AERIES_CERT is not set. Requests to Aeries will fail. Copy .env.example to .env.');
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ── Aeries client — the only function in this codebase that sends the cert ─
async function aeriesFetch(path) {
  const res = await fetch(`${AERIES_BASE_URL}${path}`, {
    headers: { 'AERIES-CERT': AERIES_CERT },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Aeries request failed (${res.status}): ${body}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── Resolve a Google Classroom roster name to an Aeries StudentID ──────────
// In mock mode, the mock server exposes a name-search convenience endpoint
// that doesn't exist in real Aeries. Swapping to real Aeries means this
// function needs a real source of truth for name -> StudentID (e.g. a
// roster sync keyed by email/StaffID) — see README "Swapping to the real
// Aeries API". Everything downstream of getting a StudentID (the info and
// programs calls, the cert handling, the frontend contract) does not change.
async function resolveStudentId(name) {
  if (AERIES_MODE === 'mock') {
    const result = await aeriesFetch(
      `/api/v5/schools/${AERIES_SCHOOL_CODE}/students/search?name=${encodeURIComponent(name)}`
    );
    return result.StudentID;
  }
  throw Object.assign(
    new Error(
      'AERIES_MODE=real has no name-to-StudentID resolution wired up yet. ' +
      'Pass a known studentId directly, or build the real roster-matching step first.'
    ),
    { status: 501 }
  );
}

// ── Routes exposed to the GC Seat frontend ──────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'gcseat-backend', aeriesMode: AERIES_MODE, aeriesBaseUrl: AERIES_BASE_URL });
});

// GET /api/student-lookup?name=First+Last[&studentId=12345]
// Returns { studentInfo, programs } — never the cert, never raw Aeries auth.
app.get('/api/student-lookup', async (req, res) => {
  try {
    const name = req.query.name ? String(req.query.name) : null;
    const explicitId = req.query.studentId ? String(req.query.studentId) : null;

    if (!name && !explicitId) {
      return res.status(400).json({ error: 'name or studentId query param required' });
    }

    const studentId = explicitId || await resolveStudentId(name);

    const [studentInfo, programs] = await Promise.all([
      aeriesFetch(`/api/v5/schools/${AERIES_SCHOOL_CODE}/students/${studentId}`),
      aeriesFetch(`/api/v5/schools/${AERIES_SCHOOL_CODE}/students/${studentId}/programs`),
    ]);

    res.json({ studentInfo, programs });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/roster-lookup  { names: ["First Last", ...] }
// Batched version so GC Seat can sync a whole class in one request instead
// of N round trips.
app.post('/api/roster-lookup', async (req, res) => {
  const names = Array.isArray(req.body?.names) ? req.body.names : null;
  if (!names || !names.length) {
    return res.status(400).json({ error: 'body must be { names: string[] }' });
  }

  const results = {};
  for (const name of names) {
    try {
      const studentId = await resolveStudentId(name);
      const [studentInfo, programs] = await Promise.all([
        aeriesFetch(`/api/v5/schools/${AERIES_SCHOOL_CODE}/students/${studentId}`),
        aeriesFetch(`/api/v5/schools/${AERIES_SCHOOL_CODE}/students/${studentId}/programs`),
      ]);
      results[name] = { ok: true, studentInfo, programs };
    } catch (err) {
      results[name] = { ok: false, error: err.message };
    }
  }

  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`gcseat-backend listening on http://localhost:${PORT}`);
  console.log(`Forwarding to Aeries at ${AERIES_BASE_URL} (mode: ${AERIES_MODE})`);
  console.log(`Allowed frontend origin: ${ALLOWED_ORIGIN}`);
});
