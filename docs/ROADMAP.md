# Engineering roadmap

Updated: 2026-10-28. This is the portfolio-source roadmap; changes in this repo do not deploy automatically to the live Apps Script project.

## Completed

- [x] Create a private GitHub repository and initial redacted source snapshot.
- [x] Include all 11 Apps Script source modules, including `Applications.gs`.
- [x] Set up `.gitignore`, credential-free config example, and source documentation.
- [x] Create offline regression tests and GitHub Actions workflow.
- [x] Observe a successful CI run on `main` after the initial test-suite commit.
- [x] Add an architecture explanation and isolated synthetic UI preview.

## Next: highest priority

- [ ] Compare **every current live Apps Script module** against the Git snapshot before attempting any automated sync; preserve the live deployment.
- [x] Exclude one-off personal repair scripts and genericize known company aliases in a release candidate.
- [ ] Perform final human review of this **separate history-clean source export** before making it public. Keep the original repository private.
- [ ] Validate the hourly email scan on multiple scheduled runs and investigate recurring failures or lock contention.
- [ ] Observe a genuine new recruiting email trigger one Pushover alert with the correct private `/exec` link (no synthetic Master Tracker changes).

## Reliability and product hardening

- [ ] Profile Gmail scan time and optimize incremental processing without weakening deduplication.
- [ ] Expand tests for controlled writes, stale-state conflicts, linked email IDs, and job-requisition uniqueness.
- [x] Isolate one-off mutating functions from the portfolio reference; live source unchanged.
- [ ] Review Apps Script permissions and deployment identity; then design safe `clasp`/CI workflow if desired.
- [ ] Reconcile daily job-discovery results with opportunities while preserving user review of new records.

## Portfolio polish

- [ ] Review the new README and synthetic demo for accuracy against the latest deployed UI.
- [ ] Capture synthetic-only screenshots and add them to the README.
- [x] Prepare a separately genericized release export for a new Git history.
- [ ] Decide on a license before publishing.
- [ ] Consider adding an optional demo video after privacy review.
