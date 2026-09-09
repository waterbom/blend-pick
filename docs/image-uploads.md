# Product image uploads

Representative, sub and description images use `POST /api/admin/upload`. The server validates the admin session, accepts JPEG/PNG/WebP/GIF up to 50 MB, saves bytes before returning success and derives the extension from the MIME type. A missing or unwritable directory returns an error; no successful image URL is returned.

Saved `/uploads/...` URLs are preserved. The proxy rewrites image requests to the Node image reader, which checks the filesystem at request time. This avoids relying on the startup public-file inventory for newly uploaded files. Both storefront hostnames share this reader. Missing files are 404 with no-store; read failures are 503. Only image extensions and paths inside the upload root are readable.

Default storage is the existing `public/uploads` directory. The current git pull/npm build deployment does not delete this ignored directory. `UPLOADS_DIR` optionally selects an absolute persistent directory; review/return uploads use it too, and the reader retains fallback access to legacy public/uploads files. Set ownership to the actual application service user before changing this setting. A local path is not a backup and does not survive instance replacement unless backed by a persistent volume. S3 migration is not configured in this change. Files already physically lost cannot be recovered from their URL alone.

Editor file drops, clipboard images, and HTML+image clipboard data upload at anchored placeholders. Temporary data/blob images are uploaded before storing the HTML. Standard HTTP(S) web images remain external references; sites blocking hotlinking may require downloading and dropping the image file. Pending uploads prevent product form save and fullscreen editor switching. No product database schema change is required.

Validation:
- `npm run test:images`: isolated upload/reader/auth/path tests with synthetic temporary files.
- `npm run build` then `node tests/browser/uploaded-images-live.cjs`: production-build HTTP test; uses a temporary upload root and never uploads to production.
- `node scripts/check-upload-serving.cjs`: post-deploy check over both production HTTPS domains using one synthetic file, removed in finally. No product/customer database reads or writes.
- Manual editor check: drop 2 PNG/JPEG files, paste a clipboard image, move focus while uploading, wait for completion, save a test product, reopen and check the storefront description. Actual authenticated browser end-to-end product editing was not performed in the isolated test environment.
