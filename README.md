# Job Application Tracker

**Approval-first recruiting automation built with Google Apps Script, Gmail, Google Sheets, JavaScript and Pushover.**

**[Live interactive demo](https://jonegert.github.io/job-application-tracker-showcase/demo/)** · [Architecture](docs/ARCHITECTURE.md) · [Engineering case study](docs/CASE_STUDY.md) · [Security](docs/SECURITY.md) · [Roadmap](docs/ROADMAP.md)

> **Important distinction:** The public demo uses invented data and is read-only. The operational personal tracker is private. This repository is a **privacy-sanitized reference source**, not a current or directly deployable copy of the private implementation. Observed live behavior and code available in this public snapshot are described separately below.

## Problem and engineering approach

Application confirmations, interview requests, rejections, newsletters and job alerts arrive through different channels. Simply synchronizing every parsed email with a job-application database creates false positives and duplicate status changes.

**The principle: automate detection; require explicit user approval for consequential changes.**

The private system scans incoming recruiting messages, extracts event candidates, matches companies and requisition IDs, stages proposed updates, and notifies the owner. The review UI separates evidence collection from mutation of the canonical Master Tracker.

## Explore the demo in one minute

1. Open the **[interactive demo](https://jonegert.github.io/job-application-tracker-showcase/demo/)**.
2. In **Applications**, search and filter the fictional application records.
3. In **Application Detection**, inspect possible incoming recruiting events.
4. In **Approvals** and **Action Queue**, observe the explicit approval boundary.
5. In **Job Opportunities**, compare open, recheck and archived job leads.

The public preview is self-contained HTML/CSS/JavaScript. It uses **no credentials, backend, Gmail calls, spreadsheet connection or Pushover API**. Its actions are illustrative, not production writes.

## Engineering capabilities

| Capability | Design and verification |
| --- | --- |
| Email ingestion | Scheduled Apps Script Gmail scanner, classification and separate Review Inbox staging |
| Matching and duplicate protection | Message IDs, company/title matching, official requisition distinctions and manual escalation |
| Human-in-the-loop workflow | Private owner-controlled Approval Center validates individual changes before committing |
| Persistence and dashboards | Separate canonical application tracker, email links, review candidates and job leads in Sheets |
| Notifications | Pushover alerts with a sent-ID ledger and locks; real Gmail-review notification received on phone |
| Reliability | Public mock tests and CI; measured live full/fast scanning reported separately |
| Public demonstration | Five-tab interactive synthetic-data browser preview; independent of the private system |

## Architecture

~~~mermaid
flowchart LR
  A[Gmail recruiting messages] --> B[Scheduled scanner]
  B --> C[Classification and matching]
  C --> D[(Review Inbox in Google Sheets)]
  D --> E[Private Approval Center]
  D --> F[Pushover alert]
  F --> E
  E -->|Explicit approval + validation| G[Controlled actions]
  G --> H[(Master Tracker / Email Links)]
  H --> I[Dashboard]
  J[Job leads] --> K[Separate opportunity review]
  K --> E
~~~

**No direct scanner-to-Master-Tracker write path.** A recruiting email can become a review candidate without becoming an authoritative application decision. See [Architecture](docs/ARCHITECTURE.md).

## Measured private-system improvement

On **29 October 2026**, a completed **45-day FULL** scan inspected **578 unique Gmail threads** in **115.1 seconds**. An immediate **14-day FAST** scan inspected **208 unique threads** in **36.9 seconds**: **approximately 68% lower measured runtime** (3.1× faster). Both scans left the Master Tracker unchanged.

The private implementation is designed to repeat the full paged backfill after approximately **23 hours**. Its first successful checkpoint and the subsequent fast run were verified; the **next scheduled full recurrence was still awaiting observation**. A previous paged full scan surfaced three historical emails that had been missed by an older 300-thread cap, and triggered an **actual Pushover push**. Any resulting application changes required explicit approval.

These are specific operational measurements across different search windows, **not** a guaranteed benchmark. Later private full/fast optimizer and Job Hunter queue modules are **not included** in this older sanitized public source snapshot. Read the [case study](docs/CASE_STUDY.md) for tradeoffs and limitations.

## Technology

JavaScript · Google Apps Script · GmailApp · Google Sheets · HTML/CSS · Pushover HTTP API · Git/GitHub · Node.js test runner · GitHub Actions.

### Project layout

~~~text
src/                         Sanitized Apps Script reference modules (not live config)
demo/index.html              Synthetic interactive, read-only browser demo
tests/*.test.cjs             Mocked logic, notification and syntax checks
.github/workflows/ci.yml     GitHub Actions CI
tools/privacy_audit.py       Heuristic privacy scanner
docs/ARCHITECTURE.md         Data flow and approval boundaries
docs/CASE_STUDY.md           Implementation choices and actual observations
docs/DEMO.md                 Recruiter walkthrough
docs/ROADMAP.md              Verified vs incomplete work
docs/SECURITY.md             Privacy model
CHANGELOG.md                 Public release notes
~~~

### Local checks

Requires Node.js **20+** and Python 3:

~~~bash
npm test
python3 tools/privacy_audit.py
~~~

Tests are mocked/offline. They do not verify a live Google OAuth session, Apps Script deployment, Gmail inbox or Pushover delivery. The privacy scanner is heuristic, not a security certification.

## Status and roadmap

**Working privately:** Gmail monitoring and Review Inbox, owner-controlled application and opportunity tracking, real push notification, verified FULL/FAST scan pair, read-only deduplication checks and private approval UI (Web App version 30).

**Still to verify:** automated daily Job Hunter proposal staging, an actual new-proposal push, the next due 45-day backfill and complete source/deployment parity.

**Planned—not shipped:** per-job AI-generated tailored CV and cover-letter **drafts** using verified facts and human review. No autonomous application submission.

## Security boundary

This public repository and demo do **not** expose private recruiting emails, personal CVs, production sheet/deployment links or credentials. Keep the private operational repository private and **never deploy** this sanitized source over the live Apps Script project. See [Security](docs/SECURITY.md).

*An independent engineering project, not an official Google, GitHub or Pushover product.*
