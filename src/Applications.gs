/**
 * JOB TRACKER — APPLICATIONS MODULE
 *
 * Read-only dashboard for Master Tracker.
 *
 * SAFETY:
 * - Does not modify any spreadsheet.
 * - Does not modify Gmail.
 * - Does not create, delete, or update applications.
 *
 * Uses JT configuration from Code.gs.
 */
function getApplicationsDashboard() {
  const ss = SpreadsheetApp.openById(JT.id);
  const master = ss.getSheetByName(JT.master);

  if (!master) {
    throw new Error('Master Tracker not found.');
  }

  const lastRow = master.getLastRow();
  const lastColumn = master.getLastColumn();
  const emptySummary = {
    total: 0,
    active: 0,
    rejected: 0,
    unverified: 0,
    outreach: 0,
    notApplication: 0
  };

  if (lastRow < 2) {
    return {
      columns: [],
      applications: [],
      summary: emptySummary
    };
  }

  const headers = master
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0];
  const rows = master
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getDisplayValues();

  function findColumn(name) {
    return headers.findIndex(function(header) {
      return String(header).trim().toLowerCase() === name.toLowerCase();
    });
  }

  const evidenceColumn = findColumn('Evidence category');
  const statusColumn = findColumn('Current status (as known)');
  const idColumn = findColumn('Application ID');

  if (evidenceColumn === -1 || statusColumn === -1) {
    throw new Error(
      'Required columns not found: Evidence category / Current status (as known)'
    );
  }

  /**
   * Classify an application for dashboard display.
   *
   * Important:
   * The original status remains unchanged in Master Tracker.
   * This function only determines the dashboard category.
   */
  function classifyApplication(evidence, status) {
    const e = String(evidence || '').trim().toLowerCase();
    const s = String(status || '').trim().toLowerCase();

    // 1. Records that are explicitly not applications.
    if (e === 'job alert only' || s === 'not an application') {
      return 'notApplication';
    }

    // 2. Inactive applications: rejected, closed, unavailable, or withdrawn.
    // All are grouped under "rejected" in the base dashboard,
    // while preserving their exact original status.
    if (
      /reject|declin|not selected|not moving forward|לא התקבל|נדח|דחייה|no longer available|position closed|role closed|withdrawn/i.test(s)
    ) {
      return 'rejected';
    }

    // 3. Verified applications that are still active.
    if (
      e.includes('verified application') ||
      e.includes('application confirmation email') ||
      e.includes('application submitted — verified')
    ) {
      return 'active';
    }

    // 4. Applications whose submission is not verified.
    if (
      e.includes('submission unverified') ||
      e.includes('application discussed') ||
      e.includes('unverified lead')
    ) {
      return 'unverified';
    }

    // 5. Other outreach, referrals, and leads.
    return 'outreach';
  }

  const applications = rows
    .map(function(row, index) {
      const company = String(row[0] || '').trim();
      if (!company) return null;

      const role = String(row[1] || '').trim();
      const evidence = String(row[evidenceColumn] || '').trim();
      const status = String(row[statusColumn] || '').trim();
      const applicationId = idColumn >= 0
        ? String(row[idColumn] || '').trim()
        : '';
      const category = classifyApplication(evidence, status);

      return {
        applicationId: applicationId,
        company: company,
        role: role,
        evidence: evidence,
        status: status,
        category: category,
        details: row,
        rowNumber: index + 2
      };
    })
    .filter(Boolean);

  const summary = {
    total: applications.length,
    active: 0,
    rejected: 0,
    unverified: 0,
    outreach: 0,
    notApplication: 0
  };

  applications.forEach(function(app) {
    summary[app.category]++;
  });

  Logger.log('========== APPLICATIONS DASHBOARD ==========');
  Logger.log(JSON.stringify(summary, null, 2));
  Logger.log('============================================');

  return {
    columns: headers,
    applications: applications,
    summary: summary
  };
}
