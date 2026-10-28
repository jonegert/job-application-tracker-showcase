/**
 * JOB TRACKER — STATUS-BASED DASHBOARD ADAPTER
 * READ ONLY: preserves Master Tracker and all existing application IDs.
 * Generic read-only categories replace one-off status repairs.
 */
function getApplicationsDashboardFixed() {
  const data = getApplicationsDashboard();
  if (!data || !Array.isArray(data.applications)) {
    throw new Error('Invalid applications dashboard data');
  }

  const categoryNames = [
    'active', 'rejected', 'closed', 'unverified',
    'outreach', 'optedOut', 'notApplication'
  ];
  const summary = { total: data.applications.length };
  categoryNames.forEach(function(name) { summary[name] = 0; });

  data.applications.forEach(function(app) {
    const status = String(app.status || '').trim().toLowerCase();

    // A personal opt-out must NOT be reported as an active application.
    if (/\bopted\s+out\b|\bassessment\s+not\s+completed\b|\bchose\s+not\s+to\s+complete\b/i.test(status)) {
      app.category = 'optedOut';
    } else if (/\bno\s+longer\s+available\b|\bposition\s+(?:is\s+|has\s+been\s+)?filled\b|\brole\s+(?:is\s+|has\s+been\s+)?filled\b|\b(?:position|role|vacancy)\s+closed\b/i.test(status)) {
      app.category = 'closed';
    }

    if (!Object.prototype.hasOwnProperty.call(summary, app.category)) {
      // Fail visibly instead of silently miscounting a new category.
      throw new Error('Unexpected application category: ' + app.category);
    }
    summary[app.category] += 1;
  });

  data.summary = summary;
  return data;
}
