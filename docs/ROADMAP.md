# Engineering roadmap

**Updated 29 October 2026.** This document separates evidence from the **private live system** and what is included in this deliberately limited **public showcase**. Changes to the public repository do not deploy to the live Apps Script project.

## Verified in the private deployment

- [x] Gmail recruitment-event collection, review staging and owner-controlled application changes.
- [x] Private Approval Center Web App; user confirmed version 30.
- [x] Master Tracker, separate job-opportunity records and review history.
- [x] Genuine Pushover alert for three newly discovered recruiting messages received on phone.
- [x] Full 45-day paged Gmail scan with no 300-thread truncation.
- [x] First successful full-backfill checkpoint and an immediate subsequent 14-day fast scan.
- [x] Observed 115.1 seconds FULL / 36.9 seconds FAST (~68% reduction in measured execution time).
- [x] Read-only requisition-deduplication smoke test against known application data.
- [x] Owner-created Apps Script safety copy (reported; restore not verified).

## Available publicly now

- [x] Isolated repository with clean initial history and credential-free generalized source.
- [x] Synthetic browser-only interactive five-tab demo on GitHub Pages.
- [x] Offline JavaScript tests and heuristic privacy scanner in GitHub Actions.
- [x] Architecture, case study, security notes and recruiter walkthrough.

## Follow-up reliability verification

- [ ] Witness the **next scheduled FULL backfill** after approximately 23 hours; so far only the first FULL+FAST pair is verified.
- [ ] Verify scheduled daily Job Hunter staging into the private queue (not just user-initiated staging).
- [ ] Confirm one Pushover notification for a genuinely new Hunter proposal, and no duplicate notification on retries.
- [ ] Verify complete private source export/backup, deployed version parity, permissions and reproducible restore.
- [ ] Extend regression coverage for conflict races and approval-state transitions.

## Final portfolio polish

- [ ] Manually audit current public files and Git history for private data beyond heuristic CI scans.
- [ ] Verify demo in incognito and at mobile width; review search, filters and detail dialogs.
- [ ] Add one or two **synthetic** screenshots if they improve presentation.
- [ ] Decide whether to add an explicit open-source license; none is granted by default without one.

## Future AI drafting feature — NOT shipped

- [ ] Private versioned candidate fact bank and approved CV / cover-letter style references.
- [ ] Capture each job's source description, URL and verified requirements; fail closed on missing descriptions.
- [ ] Generate factual CV and letter **drafts** per job; flag unsupported claims; require explicit owner review.
- [ ] Save editable Docs/PDF in private storage; add a versioned, approval-first document UI.
- [ ] Add a synthetic-only portfolio demo of the feature after it is implemented and tested.

**Out of scope:** automatically submitting applications or changing application outcomes without explicit user approval.
