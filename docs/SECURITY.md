# Privacy and security — public source edition

This is an intentionally genericized **reference implementation**, not a deployed copy.

- A separate, fresh repository is required for a public release: **do not change visibility of the original private repository**, because old commits retain historical details.
- Personal one-off application corrections and hard-coded recruiting histories were excluded from `JobTrackerSafety.gs`.
- Company-name and sender-domain dictionaries are illustrative, not a real user's list of employers.
- The browser demo contains invented data and does not contact external services.
- Tokens, OAuth credentials, real Sheets/Gmail records, private Script Properties, message IDs, `.clasp.json`, and deployment URLs must never be committed.
- Configure real secrets in Apps Script Script Properties only; restrict Web App authorization and spreadsheet permissions appropriately.
- Treat PRs and GitHub Actions logs as potentially public. CI uses mocks and no external credentials.
- The limited scanner is a guardrail, **not a guarantee of privacy**; manually review before publishing.
- Never deploy this genericized source over the operational private Apps Script project.

If a secret was accidentally published, revoke/rotate it and rewrite/replace exposed history. Deleting a string from a later commit does not erase it from earlier commits.
