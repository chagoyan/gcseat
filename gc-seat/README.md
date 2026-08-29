# GCSeat

A standalone seating chart app, forked out of GCDash's `seating.html` so the
seating chart tool has its own login and period-selection flow instead of
depending on GCDash's outline-builder structure. Same Google Classroom
roster/grade logic as GCDash's seating chart — this fork adds a working
Aeries integration (via `gcseat-backend`) in place of the old disabled
"coming soon" stub.

Entirely client-side except for the Aeries calls, which go through
`gcseat-backend` — this page never holds the AERIES-CERT.

## Run it

```zsh
npx serve . -l 8081
```

Open [http://localhost:8081](http://localhost:8081).

`config.js` is copied from GCDash and reuses the same OAuth Client ID (same
Google Cloud project, same scopes). If `localhost:8081` isn't already an
authorized JavaScript origin for that Client ID, add it in
**Google Cloud Console → APIs & Services → Credentials**.

## Aeries sync

1. Start `../mock-aeries-server` and `../gcseat-backend` (see their READMEs).
2. Load a class in GCSeat.
3. Open **⚙ Settings → Aeries API**, confirm the backend URL
   (`http://localhost:3001` by default), click **Test Connection**.
4. Click **Sync Current Class** — populates Language Fluency, Program, and
   IEP/504 tags on each seat card from the mock data.

Swap to real Aeries data later by reconfiguring `gcseat-backend` only — see
its README. Nothing in this app needs to change.

## What's different from GCDash's seating.html

- No token handoff from/to GCDash — signs in on its own
- Own localStorage namespace (`gcseat-*` instead of `gcdash-seating-*`)
- Own Google Drive sync folder (`.gcseat-config` instead of `.gcdash-config`)
- Aeries settings panel is wired up instead of disabled
