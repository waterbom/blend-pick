# Naver server connection

GitHub repository Secrets: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`.

`Connect Naver DataLab` runs after its setup files reach main, or via manual workflow dispatch after key rotation. It shares the existing deployment concurrency group. Only server-side environment variables carry credentials; no key values are committed.

The EC2 script requests seven completed Korean calendar days for the 공동구매/공구 keyword group. A valid HTTP 200 response is required before replacing the two entries in `.env.local`. Other environment entries are preserved. Errors report only controlled codes. The service restarts after setup.

`.naver-runtime/connection.json` stores allow-listed response data, query period, source and check time. It contains no credentials, is outside public assets, and is ignored by git. This is a connectivity sample, not an AI score or absolute search-volume count. No recurring collection schedule or storefront recommendation changes are included in this credential-connection step.

Official API: https://developers.naver.com/docs/serviceapi/datalab/search/search.md

Verification: `node --test tests/naver-connection.cjs` (8 isolated tests; no live keys). Missing secrets, malformed values/response, denied API permissions, transport failure, preservation of existing settings, and private snapshot handling are covered.
