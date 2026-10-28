# Synthetic demo walkthrough

## Purpose

This repo contains a **static, read-only preview** of a fictional job-application tracker. It is designed to help reviewers understand the interface and approval-first workflow without disclosing job-search history, Gmail messages, phone notification keys, or production deployment URLs.

## Run

Open `demo/index.html` directly in a modern browser. No installation, sign-in, access token, localhost server, or internet connection is required.

## Suggested 90-second walkthrough

1. **Applications** — point out summary cards and filter by `Active` or `Rejected`. Use search to find a synthetic company.
2. **Application Detection** — show how a newly detected email is a *review candidate*, not a confirmed application. Open `Details` on one entry.
3. **Approvals** — explain that the live system makes real writes only when explicitly approved. The demo cannot approve anything.
4. **Action Queue** — show a synthetic pending follow-up without changing any record.
5. **Job Opportunities** — distinguish `Open`, `Recheck`, and `Archived` as opportunity states, not application outcomes.

## Scope and security

- All companies, roles, dates, statuses, and counts in this preview are **invented**.
- All data is embedded locally in the demo file. It is not synchronized with the production tracker.
- Search, filtering, tab switching, and details work locally. All writing/approval features are intentionally disabled or omitted.
- The HTML preview is an explanatory mock, **not the deployed Approval Center** and not an integration test.
- Do not replace these records with real application data or real screenshots before repository publication.

## Screenshots for a public portfolio (later)

If repository visibility is changed after a security review, take screenshots of **this synthetic demo only**, not of the live system. Recommended captures: dashboard overview, review-candidate details, and opportunity evidence categories.
