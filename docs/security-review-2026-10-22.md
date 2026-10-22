# Security review — 2026-10-22

## Scope
- Storefronts: shop.blendpunch.com, sanjipick.blendpunch.com
- Repository: waterbom/blend-pick
- Runtime: Next.js / Node.js behind nginx on the shared EC2 host
- Review areas: PHP exposure, framework advisories, authentication/session signing, verification flows, admin request boundaries, uploads, response headers, CI/deployment configuration

## Runtime inspection evidence
GitHub Actions run: 39743815654 (Security server inspection).

Read-only EC2 and public checks confirmed:
- Node v20.20.2; production was running Next 16.2.2, React 19.2.4 and React DOM 19.2.4 before this patch.
- JWT_SECRET and ADMIN_JWT_SECRET are configured. Values were never printed.
- PHP CLI is not installed.
- Apache2 is not installed.
- No php-fpm/apache2 service is present.
- nginx has no active PHP FastCGI handler; only commented example lines were present.
- Public /index.php, /phpinfo.php, /info.php and /test.php returned 404 on both storefront domains.
- Public response exposed nginx/1.24.0 (Ubuntu) and X-Powered-By: Next.js before hardening.

Conclusion: the October 21 PHP unauthenticated-RCE release does not directly apply to the current application/runtime because PHP is neither installed nor routed by nginx. The live attack surface is Node/Next.js/React.

## Findings and remediations

### Critical — vulnerable Next.js / React runtime
Before:
- next 16.2.2
- react 19.2.4
- react-dom 19.2.4

After:
- next 16.4.2
- react 19.2.9
- react-dom 19.2.9
- eslint-config-next 16.4.2
- nodemailer 10.2.0

Reason:
- Next 16.4.1 carried critical RCE fixes and 16.4.2 is the current stable patch used here.
- React 19.2.0–19.2.8 were affected by the October 14 React Server Components RCE; 19.2.9 is patched.

### High — public fallback JWT signing key
Before:
- customer and phone-verification JWTs fell back to the known string blend-pick-secret-key when JWT_SECRET was missing.
- JWT verification did not explicitly restrict the accepted algorithm.

After:
- production rejects missing/public default JWT_SECRET.
- verification explicitly permits HS256 only.
- deployment configuration check now fails before restart when JWT_SECRET or ADMIN_JWT_SECRET is missing or left on the public default.
- actual secret values are never logged.

### High — verification and login abuse
Before:
- email/SMS verification codes used Math.random().
- login, signup, email verification and phone verification had no application-level attempt throttle.

After:
- six-digit codes use crypto.randomInt().
- per-client/per-subject fixed-window throttles protect login, signup, email verification, SMS send and SMS confirmation.
- 429 responses include Retry-After and no-store.

### High — forged image upload content
Before:
- upload allowlists checked browser-supplied MIME type but did not verify actual file bytes.

After:
- JPEG, PNG, GIF, WebP and HEIC/HEIF signatures are validated before public upload storage.
- UUID filenames and existing realpath traversal protection remain.
- regression test rejects an executable/PHP payload renamed as PNG.

### Medium — cross-site administrator mutation
After:
- unsafe /api/admin/* requests carrying a foreign Origin are rejected by the proxy before route handling.
- existing verified admin JWT checks remain in protected APIs/layouts.

### Medium — response information and baseline browser protections
After:
- Next.js X-Powered-By header disabled.
- X-Content-Type-Options: nosniff.
- X-Frame-Options: SAMEORIGIN.
- Referrer-Policy: strict-origin-when-cross-origin.
- Permissions-Policy disables camera, microphone and geolocation.
- HSTS enabled for HTTPS.
- deployment writes nginx server_tokens off, validates nginx config, then reloads nginx.

A strict site-wide Content-Security-Policy was intentionally not forced in this change because checkout, Kakao, Meta Pixel and other third-party integrations need a complete allowlist first; an incorrect CSP would break purchase/login flows.

### Residual dependency risk — xlsx
- npm audit reports high-severity advisories for the npm xlsx package and reports no fixed npm version.
- The affected parsing paths are administrator-only; server-side spreadsheet inputs are now capped at 5 MB to reduce parser DoS exposure.
- Browser-side xlsx use only generates downloads from application data and does not parse arbitrary remote files.
- Full removal/replacement of xlsx remains a follow-up because changing spreadsheet engines can alter workbook compatibility and import behavior.

## CI / regression controls
- Existing admin, buyer, account, image, shipping and process regression suites remain enabled.
- CI now runs npm audit --omit=dev --audit-level=critical after npm ci and blocks future critical production dependency advisories.
- Fixable npm findings were remediated; nodemailer was upgraded to 10.2.0. The remaining xlsx advisory has no fixed npm release and is constrained as described above.
- Added regression coverage for production JWT fallback rejection and forged-image rejection.
- The read-only Security server inspection workflow is kept as workflow_dispatch for repeat checks without exposing secrets.

## Change history
Security branch: security-hardening-20261022

Key commits include:
- 9062757c389275643bd6f0d82e562bf9ccbbdaa4 — read-only server inspection
- framework package/lock update — Next 16.4.2 / React 19.2.9
- 5508aaa1e1a2d4161af8b96bdb1cb28aa9c89169 onward — authentication/upload hardening
- c2151acfb9cfdbc430704b39339f5343f29bbaa9 — critical dependency audit gate
- 5360deb31659081f28e36449e8eb6560188e2836 — nginx version disclosure hardening

No credentials, private keys or secret values are stored in this document.
