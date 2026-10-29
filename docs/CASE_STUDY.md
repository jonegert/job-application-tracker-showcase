# Engineering case study: approval-first job application tracking

**October 2026 | Private system in active use; public synthetic demo**

## Problem

Recruitment signals arrive in email threads, company portals and alerts. They are not all reliable evidence of a submitted application or of a hiring decision. A simple automatic email-to-database sync could silently mark a person rejected, create duplicate applications, or misinterpret a closed vacancy.

## Engineering goals

1. Detect relevant incoming events without silently changing the application source of truth.
2. Preserve traceability to the underlying email and official requisition ID.
3. Minimize false positives; distinguish generic alerts, filled vacancies and explicit rejections.
4. Avoid reprocessing known messages and repeating push notifications.
5. Keep production job-search history, credentials and private links out of the public demo.
6. Support offline tests and operational measurements before and after changes.

## Design

The private implementation uses Google Apps Script, Gmail, Google Sheets, an owner-controlled HTML/JavaScript Approval Center and Pushover. The scanner classifies new recruiting messages and stages review candidates in a separate Review Inbox. User-approved actions, rather than classification alone, can change application records in the Master Tracker. Job leads and submitted applications have separate lifecycles.

The system distinguishes stable Gmail message IDs, company/role matching and official job requisition IDs. Multiple requisitions at the same company are not automatically collapsed. A sent-ID ledger and script locks protect notification and update workflows against common retry and concurrency problems.

The **public repository is a sanitized reference snapshot**, not the live source export. Its interactive demo contains fictional records, is read-only, and makes no live API calls.

## Performance problem and solution

A previous Gmail query capped the result set at 300 threads; a 45-day diagnostic found 579 matching threads. Paginated retrieval removed that truncation but increased processing cost.

The private scanner was then changed to use two modes, both relying on paginated retrieval:

- **FULL:** cover 45 days when no successful full scan checkpoint is recorded or when the checkpoint is around 23 hours old.
- **FAST:** cover 14 days between full backfills, reducing recurring processing work.

The success timestamp is recorded only after a full scan has completed its spreadsheet writes and dashboard refresh. An unsuccessful full scan stays due for a retry.

| Observed production execution, 29 Oct 2026 | FULL | FAST |
| --- | ---: | ---: |
| Search window | 45 days | 14 days |
| Unique threads | 578 | 208 |
| Total execution time | 115.1 seconds | 36.9 seconds |
| Newly staged emails | 0 | 0 |
| Scanner changes to Master Tracker | 0 | 0 |

**Measured result:** about **68% lower execution time** in the observed fast scan, or **3.1× faster** compared with the observed full run.

This comparison uses different search windows and only two actual executions; it is a practical operational measurement, **not** a same-workload algorithmic benchmark or uptime guarantee. A late-arriving message older than 14 days may wait until the next full backfill. The first FULL checkpoint and immediate FAST run were verified; the recurring next-day FULL run had not yet been observed as of 29 October.

## Real-world validation of human review

A previous full paginated scan found three historical recruiting messages that had been missed by the 300-thread cap. The system generated a real Pushover notification received on the owner's phone.

Reviewing the original messages showed all three were rejections, including two that had initially been classified ambiguously or incorrectly. Corrections to review records and application records were made only after explicit owner approval, and a previously recorded rejection was not duplicated.

This demonstrated the importance of two design choices: heuristic classification needs a human override, and deduplication must include existing application records.

## Testing and privacy boundaries

- Public CI exercises syntax and mocked behavior, not production OAuth or APIs.
- The heuristic privacy guard detects selected token, email and private-URL patterns, but cannot certify complete security.
- Production log review established that Gmail scans completed and did not automatically modify Master Tracker.
- Public demo data and UI are self-contained, synthetic and disconnected from the private system.
- The current public source tree intentionally omits later private modules such as full/fast scan pacing and the newer Hunter queue.

## Open items

- Observe the next scheduled FULL backfill after the checkpoint expires.
- Verify a scheduled daily Job Hunter run actually appends eligible leads to the private Hunter Review Queue, and that a new queued lead generates exactly one Pushover notification.
- Improve live-source backup/reproducibility and complete a manual public-source privacy review.
- Implement an **owner-reviewed** per-job AI CV and cover-letter draft generator. This feature is planned, **not yet shipped**; no autonomous applications are sent.

## Why the project matters

The central engineering lesson is that **automating detection does not require automating consequential decisions**. Separate queues, explicit state transitions, provenance, idempotency, measured performance and privacy-conscious testing make an otherwise fragile personal automation safer and more maintainable.

See [Architecture](ARCHITECTURE.md), [Roadmap](ROADMAP.md), and the [Interactive demo](https://jonegert.github.io/job-application-tracker-showcase/demo/).
