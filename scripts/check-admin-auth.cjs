// Check configuration without printing signing keys.
require('@next/env').loadEnvConfig(process.cwd(), false);
const secret = process.env.ADMIN_JWT_SECRET;
if (!secret || secret === 'blend-admin-secret-2026') {
  console.error('ADMIN_JWT_SECRET must be configured with a private key before deploying admin authentication.');
  process.exit(1);
}
console.log('Admin authentication configuration verified (key not displayed).');
