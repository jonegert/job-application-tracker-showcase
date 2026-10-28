# Publish preparation (read before upload)

This folder is a **genericized portfolio export**. It is intentionally **not**
identical to the live Apps Script project.

## Why create a separate GitHub repository?

Your original private GitHub repository includes older commits that mentioned
individual application histories. A new commit deleting text cannot erase that
history. **Keep the original repository private forever**, or arrange a separate
history rewrite under a deliberate privacy review. For easiest safety, publish
this export from a **brand-new repository with a single clean first commit**.

## Safe workflow

1. Review every source and documentation file locally.
2. Run `npm test` (Node 20+) and `python3 tools/privacy_audit.py`.
3. Create a new **Private** GitHub repository, e.g. `job-application-tracker-portfolio`.
4. Extract this archive into a **new folder**, not inside the old Git working tree.
5. In the new folder, run `git init -b main`, `git add .`,
   `git diff --cached --check`, `git commit -m "Public-source portfolio baseline"`,
   `git remote add origin <YOUR_NEW_REPOSITORY_HTTPS_URL>`, `git push -u origin main`.
6. Review the new repository's files and history and CI results.
7. Only then choose whether to change its visibility to Public.

## What changed vs the private project?

- Excluded ~5,000 lines of old candidate-specific repair/migration logic from
  `src/JobTrackerSafety.gs`; preserved common read-only classification and
  title-extraction helpers. Do not deploy this file over the private live version.
- Replaced employer dictionaries, recruiter-domain rules and company aliases
  with examples. The reference source will not recognize an arbitrary company's
  recruiting messages without instance-specific configuration.
- Removed a synthetic-source test that depended on a private Gmail message.
- Removed the historical row/date exception in opportunity proof checks.
- Retained generic cross-module APIs, source folder, offline mock tests, workflow,
  and synthetic browser demo.

Limitations: Only an offline/static review can be performed here. No real Gmail,
Sheets, Apps Script deployment, OAuth permission, or Pushover behavior is tested.
