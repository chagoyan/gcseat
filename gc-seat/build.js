// ============================================================
// Build Script — generates config.js from environment variables
// Run automatically by Netlify before deploying.
// Mirrors GCDash's build.js — same pattern, same env var name, so
// the same GOOGLE_CLIENT_ID Netlify env var works on both sites.
// ============================================================

const fs = require('fs');

const clientId = process.env.GOOGLE_CLIENT_ID;

if (!clientId) {
	console.error('ERROR: GOOGLE_CLIENT_ID environment variable is not set.');
	process.exit(1);
}

const config = `var CONFIG = {
  clientId: '${clientId}'
};`;

fs.writeFileSync('config.js', config);
console.log('config.js generated successfully.');
