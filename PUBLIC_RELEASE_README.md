# Public showcase release notes

**This repository is already a separate, public, clean-history demonstration** of a private Job Application Tracker project. It is intentionally not identical to the owner's live Apps Script deployment.

## Included in this public edition

- Sanitized Google Apps Script reference modules and HTML/CSS/JavaScript interface code.
- A self-contained synthetic-data interactive browser demo hosted on GitHub Pages.
- Node.js offline unit tests, GitHub Actions CI and a heuristic privacy scanner.
- Architecture documentation, recruiter walkthrough and an evidence-based engineering case study.

## Deliberately excluded

- Real recruiting messages, application data, personal CV/cover-letter documents, contact details and credentials.
- Private configuration and production Apps Script deployment/project/Sheet links.
- Historical one-off personal corrections, private source Git history and the latest live-only optimization/Job Hunter modules.
- AI-tailored CV / cover-letter generation, which is planned and not yet available.

## Release verification checklist

1. Run **npm test** and **python3 tools/privacy_audit.py** on every public source update.
2. Manually inspect all public code, current Git history, demo assets and repository settings for private information.
3. Open the [GitHub Pages demo](https://jonegert.github.io/job-application-tracker-showcase/demo/) from an unauthenticated browser; test navigation, search, filters and details on desktop and mobile.
4. Check the [case study](docs/CASE_STUDY.md) clearly separates measured private observations from what public reference source implements.
5. Verify GitHub Actions succeeds on the published commit.
6. Keep the original private production/source repository private.

## Caution

The showcase is **not turnkey deployable**. Configuration, private modules and production secrets are intentionally absent; never overwrite the operational Apps Script project with this genericized example. Tests and static scans are helpful but cannot guarantee zero security risks.
