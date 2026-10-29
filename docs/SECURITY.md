# Security and privacy boundaries

This is a **sanitized public reference repository**. It is not the user's private deployed system. The public browser demo is read-only, uses fabricated records and does not access real Google or Pushover services.

## Explicitly excluded from the public edition

- Recruiter emails, application histories, real company/application records and private candidate documents.
- Private Sheets workbook IDs, Apps Script project/deployment URLs, user account addresses and phone numbers.
- OAuth credentials, token values, Pushover user keys, environment secrets and Script Properties.
- Private repair/migration functions and historical one-off corrections.
- Production deployment metadata and locally authenticated clasp files.

The original repository holding private source remains **private**. This showcase began as a separate clean-history publication; deleting content in a later commit does not erase earlier historical exposures.

## Runtime safety principles

- Email classification creates review candidates, not authorized application status changes.
- Consequential application and opportunity updates require explicit owner actions.
- Notification deduplication reduces repeated alerts but cannot guarantee exactly-once delivery under every networking failure.
- No autonomous applications are submitted.
- A future AI document generator is **planned, not implemented**. Before processing personal CV sources or sending data to an AI provider, explicit consent, safe credential handling and human review will be required.

## Verification performed and its limitations

On 29 October 2026, a targeted scan of the current public source and documentation did not find the known live spreadsheet/project/deployment identifiers, candidate contact details, private API keys or credential-like tokens. The current public history began with one sanitized release commit and a README follow-up.

The repository's GitHub Actions workflow runs Node mock tests and the conservative **tools/privacy_audit.py** static checker. **Passing tests or keyword scans is not a comprehensive security audit**; review commit history, code, documentation, CI logs, GitHub Pages assets, repository settings and new contributions manually.

If an actual credential is exposed, rotate or revoke it and address any Git history/published artifacts, not only the latest file.

## Never connect this showcase to production

Do **not** paste personal CVs, unredacted Gmail/Sheets exports or the private Approval Center URL into issues, commits, screenshots or the demo. Do **not** deploy the reference **src/** directory over the active private Apps Script system: it intentionally omits real configuration and later live modules.
