// Check authentication configuration without printing signing keys.
require('@next/env').loadEnvConfig(process.cwd(), false);

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'blend-pick-secret-key') {
  console.error('JWT_SECRET must be configured with a private value before deploying customer authentication.');
  process.exit(1);
}

const adminSecret = process.env.ADMIN_JWT_SECRET;
if (!adminSecret || adminSecret === 'blend-admin-secret-2026') {
  console.error('ADMIN_JWT_SECRET must be configured with a private value before deploying admin authentication.');
  process.exit(1);
}

console.log('Authentication configuration verified (keys not displayed).');
