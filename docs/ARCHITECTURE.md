# Architecture and trust boundaries

The **private operational tracker** runs on Gmail, Google Apps Script, Google Sheets and Pushover. The **public source tree** is a sanitized reference and deliberately not an exact deployable copy of the live project. The **public demo** contains fictional, local-only data.

## Components and ownership

| Component | Responsibility | Data boundary |
| --- | --- | --- |
| Gmail | Source of incoming recruitment messages | Scan workflow reads, not edits, the inbox |
| Apps Script scheduler/scanner | Collect and classify potential recruiting events | Writes review candidates; no automatic Master Tracker edits |
| Matching engine | Compare company, title, requisition and message IDs | Ambiguity requires human review |
| Review Inbox | Staging of incoming signals | A detected event is not a verified application outcome |
| Private Approval Center | Explicit owner-controlled decisions | Only validated actions can change the canonical records |
| Master Tracker | Applications and their statuses | No direct email-scanner update |
| Email Links | Provenance and message-to-application links | Allows reconciliation and prevents duplicate link creation |
| Job Opportunities | Leads, evidence and recheck states | A lead is distinct from a submitted application |
| Pushover notifications | New review-item alerts with sent-ID ledger | Alerting does not authorize an application change |
| Public browser demo | Show UI concepts safely | Synthetic records only; no credentials or network API calls |

## Event lifecycle

~~~mermaid
sequenceDiagram
    autonumber
    participant G as Gmail
    participant S as Apps Script scanner
    participant Q as Review Inbox
    participant P as Pushover
    participant U as Owner / private UI
    participant M as Master Tracker
    G->>S: Recruiting message
    S->>S: Classify and match; detect duplicates
    S->>Q: Stage candidate
    S->>P: Notify only newly pending IDs
    P-->>U: Private review alert
    U->>Q: Inspect source evidence
    alt Explicit owner decision and fresh validation
      U->>M: Controlled application change
    else Ignore, unclear, or defer
      Note over M: Master Tracker untouched
    end
~~~

## Reliability and safety invariants

1. **Observation is not authorization.** A Gmail message does not independently change application status.
2. **Requisition identity is meaningful.** Distinct official job IDs may be separate roles even at the same employer.
3. **Uncertain evidence stays uncertain.** A filled position is not necessarily a personal rejection; generic digests need review.
4. **Idempotency is a first-class concern.** Reviewed message IDs, known job IDs and sent-notification IDs reduce duplicates.
5. **Retries and concurrency need guards.** Script locks protect relevant actions; notification IDs are recorded only on confirmed Pushover success.
6. **No production data in the public edition.** Personal CVs, recruiter emails, job histories, keys and live deployment URLs must stay private.
7. **Mock tests are not production verification.** Offline CI cannot establish OAuth permissions or validate a live trigger.

## Live-only incremental Gmail scan design

The **later private implementation** uses the same paged Gmail helper in two modes:

- **FULL** scans 45 days when a last-successful-full-run checkpoint is missing or around 23 hours old.
- **FAST** scans 14 days on intervening hourly cycles.
- A full-run checkpoint is recorded only after review rows are successfully written and the dashboard refreshed.
- A failed full scan leaves the next run eligible to retry FULL.

On 29 October 2026 the owner observed FULL scanning 578 threads in 115.1 seconds, immediately followed by FAST scanning 208 threads in 36.9 seconds. This measured improvement trades immediate checking of older messages for a daily backfill. The next recurring FULL run was not yet observed. See the [case study](CASE_STUDY.md).

**The public source snapshot does not include all these later live-only modules and should not be used to overwrite production.**

## Deployment isolation

- **Private deployment:** real Gmail/Sheets, owner-restricted web app, production Script Properties and time-based triggers.
- **Public source:** generic reference modules and credential-free mocked unit tests.
- **Public GitHub Pages demo:** read-only, synthetic browser UI, not connected to the operational system.

See the [Security guide](SECURITY.md) and [Roadmap](ROADMAP.md).
