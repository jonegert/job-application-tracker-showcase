# Public demo: recruiter walkthrough

**[Open the interactive, synthetic-data demo](https://jonegert.github.io/job-application-tracker-showcase/demo/)**

## A 60–90 second walkthrough

1. **Applications:** search for a fictional company and filter applications by status.
2. **Application Detection:** inspect a possible new email event and why a scanner should not directly edit an application.
3. **Approvals:** show where a human decision would sit in the workflow. The public demo deliberately cannot commit changes.
4. **Action Queue:** inspect fictional pending follow-ups.
5. **Job Opportunities:** compare open, needs-recheck and archived lead states; a lead is not an application.

## What this demo is and is not

- **Is:** self-contained HTML/CSS/JavaScript hosted on GitHub Pages, with browser-side filtering, navigation and details.
- **Is:** a safe illustration of the user interface and approval-first architecture using entirely fictional records.
- **Is not:** the private Approval Center deployment, a production-backed dashboard, an OAuth-connected application or an integration test.
- **Does not:** access Gmail, Google Sheets, Apps Script, Pushover or any LLM API; no live data can be changed.

## Final acceptance checklist

- [ ] Open the GitHub Pages link in an incognito browser (no login).
- [ ] Check all five navigation tabs on desktop.
- [ ] Check search, status filters and record-detail dialogs.
- [ ] Check a mobile-width viewport and keyboard navigation.
- [ ] Confirm no private emails, candidate names, IDs or operational links appear.
- [ ] Confirm GitHub Actions CI passes for the public documentation commit.

## Optional screenshots

If capturing images for the portfolio, use the **fictional public demo only**. Good views: dashboard overview, detection detail and opportunity-status filtering. Never publish screenshots of real job applications, private Gmail or CV documents.
