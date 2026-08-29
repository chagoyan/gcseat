# GCSeat

A Google Classroom seating chart app, with an Aeries SIS integration built
on a local mock-first development pattern. Originally forked out of
[GCDash](https://gcdash.netlify.app)'s seating chart — now a fully
independent project with its own repo and its own deployment.

## Structure

```
gc-seat/               Frontend — the seating chart app itself (static, no build step)
gcseat-backend/         Middle backend — holds the AERIES-CERT, proxies to Aeries
mock-aeries-server/     Local stand-in for the real Aeries API
```

## Architecture

```
GCSeat (browser)
   │  no cert, calls gcseat-backend only
   ▼
gcseat-backend
   │  holds AERIES-CERT in .env, only piece that ever sends it
   ▼
mock-aeries-server   ← today, for local dev
real Aeries API      ← later, same code path, different .env
```

The frontend never holds a credential. Only `gcseat-backend` ever talks to
Aeries, mirroring how the real integration must work for security.

## Run it locally

Three terminals:

```zsh
cd mock-aeries-server && cp .env.example .env && npm install && npm start
```

```zsh
cd gcseat-backend && cp .env.example .env && npm install && npm start
```

```zsh
cd gc-seat && echo "var CONFIG = { clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com' };" > config.js && npx serve . -l 8081
```

Open http://localhost:8081. `localhost:8081` needs to be an authorized
JavaScript origin for that OAuth Client ID in Google Cloud Console.

## Deploying gc-seat (Netlify)

`gc-seat/` has its own `netlify.toml` + `build.js`, matching the pattern
GCDash uses: point a Netlify site's **base directory** at `gc-seat`, set a
`GOOGLE_CLIENT_ID` environment variable, and it generates `config.js` at
build time (never committed — see `.gitignore`). Add the resulting Netlify
URL as an authorized JavaScript origin too.

`gcseat-backend` and `mock-aeries-server` are plain Node/Express servers,
not static sites — they don't deploy to Netlify as-is. They're local-only
for now (proof-of-concept phase); if/when this needs to work for other
teachers, those two need real server hosting (Render, Railway, Fly.io,
etc.) and the real Aeries roster-matching step described in
`gcseat-backend/README.md`.

## Status

- [x] Standalone app, own Google sign-in, own Drive settings file
- [x] Local Aeries integration proof of concept, tested end to end
- [x] Own repo, ready for its own GitHub + Netlify
- [ ] Own GitHub repo pushed
- [ ] Own Netlify site live
- [ ] Real Aeries credentials from IT (proof of concept first, per plan)
- [ ] Real roster-to-StudentID matching (currently mock-only name search)
- [ ] Backend pieces hosted somewhere reachable by other teachers (not yet needed — local dev only)
