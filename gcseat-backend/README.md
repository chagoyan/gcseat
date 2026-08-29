# gcseat-backend

The middle backend for GC Seat's Aeries integration. Holds the
`AERIES-CERT` in an environment variable and is the only piece of the whole
stack that ever calls Aeries (mock or real) directly. The GC Seat frontend
never receives the certificate — it only ever talks to this backend, on
plain unauthenticated local HTTP.

```
GC Seat (browser)  --no cert-->  gcseat-backend  --AERIES-CERT-->  Aeries (mock or real)
```

## Run it

```zsh
cp .env.example .env
npm install
npm start
```

Runs on `http://localhost:3001` by default. Requires `mock-aeries-server`
running (see `../mock-aeries-server`) unless `AERIES_MODE=real`.

## Endpoints (called by GC Seat)

- `GET /health`
- `GET /api/student-lookup?name=First+Last` — one student, by roster name
- `POST /api/roster-lookup` with body `{ "names": ["First Last", ...] }` —
  a whole class in one request

Both return `{ studentInfo, programs }` (or a `results` map, keyed by name,
for the batch endpoint) using the real Aeries field names, so the frontend
code doesn't need to change when this backend is pointed at real Aeries.

## Swapping to the real Aeries API

Three things change in `.env`:

```
AERIES_BASE_URL=https://your-district.aeries.net
AERIES_CERT=<the real cert from Chad>
AERIES_MODE=real
```

**One thing does not swap automatically:** `resolveStudentId()` in
`server.js` currently resolves a Google Classroom roster name to an Aeries
`StudentID` via the mock server's `/students/search` endpoint — which only
exists in the mock, because real Aeries has no name-search. Real Aeries
would need a proper roster-matching step (e.g. email-to-StaffID, or a
synced `StudentID` stored per Classroom student) before `AERIES_MODE=real`
can resolve names on its own. Until that's built, `real` mode requires the
caller to pass a known `studentId` explicitly rather than a `name`.

Everything downstream of getting a `StudentID` — the info/programs fetch,
the cert handling, the response shape GC Seat expects — needs no changes.
