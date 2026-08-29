# mock-aeries-server

A local stand-in for the real Aeries SIS REST API (v5) — just the two
endpoints GC Seat needs, running on your own machine. No real student data,
no network calls out, nothing deployed anywhere.

## Why this exists

Before asking Chad (IT) for a real `AERIES-CERT`, this lets you build and
test the whole integration pattern — roster matching, the middle backend,
the settings panel — against something that behaves like Aeries, so the only
thing that changes later is a URL and a certificate value.

## Endpoints

Mirrors the real API shape:

- `GET /api/v5/schools/:schoolCode/students/:studentId`
- `GET /api/v5/schools/:schoolCode/students/:studentId/programs`

Plus one endpoint that only exists in this mock (real Aeries has no
name-search — matching would use `StaffID`/`StudentID` sync instead):

- `GET /api/v5/schools/:schoolCode/students/search?name=First+Last`

All endpoints (except `/health`) require an `AERIES-CERT` header, matching
the real API's auth pattern, checked against `MOCK_AERIES_CERT`.

## Data

`data/students.json` has a few curated example students (one EL, one IEP,
one 504, one GATE) for reliably testing each tag. Any other name you query
gets deterministic fake data generated on the fly — same name always
produces the same fake record, so re-syncing doesn't shuffle results.

## Run it

```zsh
cp .env.example .env
npm install
npm start
```

Runs on `http://localhost:4000` by default.

## Test it

```zsh
curl -H "AERIES-CERT: MOCK-CERT-LOCAL-DEV-ONLY" \
  "http://localhost:4000/api/v5/schools/1/students/search?name=Jane%20Doe"
```
