# Offline tests

Run `npm test` with Node.js 20 or later. No `npm install` needed: tests use Node built-ins.

Tests parse every Apps Script `.gs` module and all inline Approval Center scripts. Logic tests exercise the **real functions** in the genericized reference source with mocked Google Apps Script APIs. Push tests use fake Gmail rows, mock Script Properties, and mock Pushover responses: **no real emails, Sheets data, tokens, or external network calls**.

GitHub Actions runs the tests on each push to `main` and on pull requests.

**Scope:** These are offline regression tests, not live Gmail/Sheets integration tests. They cannot validate current Google OAuth permissions, live Apps Script quotas/triggers, published deployment URLs, or receipt of a real push notification.
