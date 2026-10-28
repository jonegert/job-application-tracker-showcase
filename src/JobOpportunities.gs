/**
 * JOB TRACKER — OPPORTUNITY ARCHIVE v1
 * Replace the old jtGetOpportunities() in JobOpportunities.gs with this file.
 * Never deletes rows or writes Master Tracker / Review Inbox / Email Links.
 * READ: Job Opportunities, Master Tracker, Review Inbox.
 * WRITE (only after clicking a UI decision button): Job Opportunities column J.
 */

function jtOppNormalize_(value) {
  return String(value || '').toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function jtOppCompany_(value) {
  const name = jtOppNormalize_(value);
  const aliases = {
    'acme labs': 'acme',
    'northstar systems': 'northstar',
    'example company': 'example co',
    'example co': 'example co',
    'example ltd': 'example co'
  };
  return aliases[name] || name;
}

function jtOppJobId_(value) {
  const valueText = String(value || '').trim().toUpperCase();
  return valueText === '—' || valueText === '-' ? '' : valueText;
}

function jtOppRows_(sheet, width) {
  return sheet && sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getDisplayValues()
    : [];
}

function jtOppIsSameJob_(company, role, jobId, otherCompany, otherRole, otherJobId) {
  if (jtOppCompany_(company) !== jtOppCompany_(otherCompany)) return false;
  const currentId = jtOppJobId_(jobId);
  const otherId = jtOppJobId_(otherJobId);
  if (currentId && otherId) return currentId === otherId;
  const currentRole = jtOppNormalize_(role);
  const foundRole = jtOppNormalize_(otherRole);
  return !!currentRole && currentRole === foundRole;
}

/**
 * Read-only list for the website.
 * Hides explicit SKIP/CLOSED/APPLIED — VERIFY decisions and exact verified
 * application matches. Historical rows stay in Job Opportunities.
 */
function jtGetOpportunities() {
  const ss = SpreadsheetApp.openById(JT.id);
  const opportunitySheet = ss.getSheetByName('Job Opportunities');
  const master = ss.getSheetByName(JT.master);
  const inbox = ss.getSheetByName(JT.inbox);
  if (!opportunitySheet || !master || !inbox) {
    throw new Error('One of the required tracking sheets is missing.');
  }

  const opportunityRows = jtOppRows_(opportunitySheet, 15);
  const masterRows = jtOppRows_(master, 10);
  const emailRows = jtOppRows_(inbox, 14);

  const verifiedApplications = masterRows.filter(function(row) {
    const evidence = String(row[3] || '');
    return /verified application|application confirmation email|application confirmation|confirmed application|linkedin submission confirmation/i.test(evidence);
  });

  // A Gmail APPLICATION is accepted as a temporary exact-match signal.
  // It is not treated as an approved Master record or a status change.
  // If the job title is absent or approximate, it does not auto-hide the job.
  const confirmedEmails = emailRows.filter(function(row) {
    return String(row[4] || '').trim() === 'APPLICATION' &&
      jtOppCompany_(row[2]) && jtOppNormalize_(row[3]) &&
      jtOppNormalize_(row[3]) !== 'not identified';
  });

  // If two different requisitions share an identical title and our email
  // lacks a Job ID, don't auto-hide either based on a name-only match.
  const sameTitleCount = {};
  opportunityRows.forEach(function(row) {
    const key = jtOppCompany_(row[0]) + '|' + jtOppNormalize_(row[1]);
    sameTitleCount[key] = (sameTitleCount[key] || 0) + 1;
  });

  return opportunityRows.map(function(row, index) {
    const rawScore = String(row[3] || '').trim();
    const parsedScore = rawScore ? Number(rawScore.replace(/,/g, '')) : null;
    const rawUrl = String(row[5] || '').trim();
    return {
      rowNumber: index + 2,
      company: row[0], role: row[1],
      category: row[2] || 'Other Technical',
      score: Number.isFinite(parsedScore) ? parsedScore : null,
      location: row[4],
      url: /^https?:\/\//i.test(rawUrl) ? rawUrl : '',
      firstFound: row[6], lastSeen: row[7], postingDate: row[8],
      decision: row[9] || 'NEW', whyItFits: row[10], gaps: row[11],
      jobId: row[12], linkedApplicationId: row[13], source: row[14]
    };
  }).filter(function(job) {
    if (!job.company || !job.role) return false;
    if (['SKIP', 'CLOSED', 'APPLIED — VERIFY', 'APPLIED', 'NEEDS RECHECK'].includes(job.decision)) {
      return false;
    }
        const titleKey = jtOppCompany_(job.company) + '|' + jtOppNormalize_(job.role);

    if (verifiedApplications.some(function(app) {
      // Never hide multiple requisitions based on an ambiguous title.
      if (sameTitleCount[titleKey] > 1 &&
          (!jtOppJobId_(job.jobId) || !jtOppJobId_(app[2]))) {
        return false;
      }

      return jtOppIsSameJob_(
        job.company, job.role, job.jobId,
        app[0], app[1], app[2]
      );
    })) return false;
    if (sameTitleCount[titleKey] === 1 && confirmedEmails.some(function(email) {
      return jtOppIsSameJob_(job.company, job.role, job.jobId, email[2], email[3], '');
    })) return false;

    return true;
  }).sort(function(a, b) {
    return (b.score === null ? -1 : b.score) - (a.score === null ? -1 : a.score);
  });
}

/**
 * Explicit click only. Changes just the Decision cell of the exact matched
 * opportunity. Never deletes rows or updates an actual job application.
 */
function jtSetOpportunityDecision(rowNumber, expectedCompany, expectedRole,
                                    expectedJobId, expectedUrl, newDecision) {
  if (newDecision !== 'SKIP' && newDecision !== 'APPLIED — VERIFY') {
    throw new Error('Unsupported decision.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Another update is in progress. Refresh and retry.');
  }
  try {
    const ss = SpreadsheetApp.openById(JT.id);
    const sheet = ss.getSheetByName('Job Opportunities');
    if (!sheet) throw new Error('Job Opportunities sheet not found.');
    const row = Number(rowNumber);
    if (!Number.isInteger(row) || row < 2 || row > sheet.getLastRow()) {
      throw new Error('Opportunity row no longer exists. Refresh the page.');
    }
    const current = sheet.getRange(row, 1, 1, 15).getDisplayValues()[0];
    if (current[0] !== String(expectedCompany || '') ||
        current[1] !== String(expectedRole || '') ||
        String(current[12] || '') !== String(expectedJobId || '') ||
        String(current[5] || '') !== String(expectedUrl || '')) {
      throw new Error('Opportunity details changed. Refresh before updating.');
    }
    const previous = String(current[9] || 'NEW');
    if (['SKIP','CLOSED','APPLIED — VERIFY'].includes(previous)) {
      throw new Error('This opportunity has already been archived. Refresh.');
    }
    if (!['NEW','CONSIDER','APPLY'].includes(previous)) {
      throw new Error('Unknown existing decision. Nothing was changed.');
    }
    sheet.getRange(row, 10).setValue(newDecision);
    SpreadsheetApp.flush();
    return {success:true, decision:newDecision, company:current[0], role:current[1]};
  } finally {
    lock.releaseLock();
  }
}

/** Read-only smoke test. Optional to run from Apps Script. */
function jtTestOpportunityArchiveReadOnly() {
  const items = jtGetOpportunities();
  Logger.log('READ-ONLY TEST: ' + items.length + ' active opportunities.');
  items.slice(0, 10).forEach(function(item) {
    Logger.log(item.company + ' | ' + item.role + ' | ' + item.score + ' | ' + item.decision);
  });
  Logger.log('No spreadsheet data was changed.');
}
/**
 * JOB TRACKER — THREE VIEW DASHBOARD (READ ONLY)
 * APPEND this entire block ONCE to the end of JobOpportunities.gs.
 * Keep jtGetOpportunities() and jtSetOpportunityDecision() unchanged.
 * Reads Job Opportunities and reuses the existing exact-application matching.
 * Does not write to any spreadsheet or alter archived/application statuses.
 */
/**
 * JOB TRACKER — VACANCY PROOF GATE (READ ONLY)
 * Replace ONLY the existing jtGetOpportunityDashboard() function with this
 * function and the jtOppHasApplicationProof_ helper below it.
 * Keep jtGetOpportunities(), jtSetOpportunityDecision(), and both test
 * functions unchanged.
 *
 * Historical 15 rows (2..16), entered by Oct 26, remain in their existing
 * groups. Newly appended rows do not become 'active' merely because J=NEW.
 * This checks the consistency of an evidence receipt in column O, NOT the
 * live website itself. Real employer availability is verified by the agent.
 */
function jtOppHasApplicationProof_(row) {
  const receipt = String(row[14] || '').trim();
  const savedUrl = String(row[5] || '').trim();
  const firstFound = String(row[6] || '').trim();

  // The daily agent must record evidence in this exact field order.
  const proof = receipt.match(
    /(?:^|\|\s*)OPEN VERIFIED\s*\|\s*checked\s+(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2}\s+Asia\/Jerusalem)?\s*\|\s*Employer\/ATS:\s*([^|]+)\|\s*Job ID:\s*([^|]+)\|\s*Apply URL:\s*([^|]+)\|\s*Evidence:\s*([^|]+)\|\s*Limitations:\s*([^|]+)\|\s*Report:\s*(\d{4}-\d{2}-\d{2})(?:\s*\||\s*$)/i
  );
  if (!proof) return false;

  const checked = proof[1];
  const employer = proof[2].trim();
  const proofUrl = proof[4].trim();
  const evidence = proof[5].trim();
  const limitations = proof[6].trim();
  const reportDate = proof[7];
  const today = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');

  if (!/^https:\/\/[^\s]+/i.test(savedUrl) || proofUrl !== savedUrl) return false;
  if (!employer || /^(unknown|not verified|none)$/i.test(employer)) return false;
  if (checked > today || reportDate > today || checked !== reportDate) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(firstFound) && checked < firstFound) return false;

  // Only a concrete statement that the application START form was reached
  // passes. Merely seeing a posting, careers list, or an Apply label fails.
  if (!/(application\s+(start|form|fields)|apply\s+form|cv\s+upload|resume\s+upload|reached\s+(the\s+)?application)/i.test(evidence)) return false;
  if (/(not\s+tested|not\s+verified|cannot|could\s+not|login\s+required|unavailable|inaccessible|disabled|closed|404|not\s+found)/i.test(evidence + ' ' + limitations)) return false;
  return true;
}

function jtGetOpportunityDashboard() {
  const activeRowNumbers = {};
  jtGetOpportunities().forEach(function(job) {
    activeRowNumbers[job.rowNumber] = true;
  });

  const ss = SpreadsheetApp.openById(JT.id);
  const sheet = ss.getSheetByName('Job Opportunities');
  if (!sheet) throw new Error('Job Opportunities sheet not found.');

  return jtOppRows_(sheet, 15).map(function(row, index) {
    const rowNumber = index + 2;
    const decision = String(row[9] || 'NEW').trim();
    const rawScore = String(row[3] || '').trim();
    const parsedScore = rawScore ? Number(rawScore.replace(/,/g, '')) : null;
    const rawUrl = String(row[5] || '').trim();

    // All roles, without row-number or date exceptions, require proof.
    const proofPassed = jtOppHasApplicationProof_(row);

    let group;
    let displayNote = '';
    if (decision === 'NEEDS RECHECK') {
      group = 'recheck';
      displayNote = 'Application availability has not been confirmed.';
    } else if (['SKIP', 'CLOSED', 'APPLIED — VERIFY', 'APPLIED'].includes(decision)) {
      group = 'archive';
    } else if (!activeRowNumbers[rowNumber]) {
      // Preserve existing exact-application matching even when J says NEW.
      group = 'archive';
      displayNote = 'Matched to application evidence; no sheet decision changed.';
    } else if (!proofPassed) {
      group = 'recheck';
      displayNote = 'NEW job not verified: no qualifying application-proof receipt.';
    } else {
      group = 'active';
    }

    return {
      rowNumber: rowNumber,
      company: row[0],
      role: row[1],
      category: row[2] || 'Other Technical',
      score: Number.isFinite(parsedScore) ? parsedScore : null,
      location: row[4],
      url: /^https?:\/\//i.test(rawUrl) ? rawUrl : '',
      firstFound: row[6],
      lastSeen: row[7],
      postingDate: row[8],
      // This is display-only, NOT a modification of Sheets column J.
      decision: group === 'recheck' && decision === 'NEW' ? 'NEEDS RECHECK' : decision,
      storedDecision: decision,
      whyItFits: row[10],
      gaps: row[11],
      jobId: row[12],
      linkedApplicationId: row[13],
      source: row[14],
      group: group,
      displayNote: displayNote
    };
  }).filter(function(job) {
    return !!job.company && !!job.role;
  }).sort(function(a, b) {
    const aScore = a.score === null ? -1 : a.score;
    const bScore = b.score === null ? -1 : b.score;
    return bScore - aScore;
  });
}

/** OPTIONAL: Test the proof gate without writing anything to Sheets. */
function jtTestOpportunityProofGateReadOnly() {
  const rows = jtGetOpportunityDashboard();
  const counts = {active: 0, recheck: 0, archive: 0};
  rows.forEach(function(job) { counts[job.group]++; });
  Logger.log('DASHBOARD: ' + rows.length + ' jobs; ' + counts.active + ' active, ' +
    counts.recheck + ' needs recheck, ' + counts.archive + ' archived.');

  const sample = Array(15).fill('');
  const today = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');
  sample[5] = 'https://jobs.example.com/role/123';
  sample[6] = today;
  const noProofBlocked = !jtOppHasApplicationProof_(sample);
  sample[14] = 'OPEN VERIFIED | checked ' + today +
    ' | Employer/ATS: jobs.example.com | Job ID: 123 | Apply URL: ' + sample[5] +
    ' | Evidence: opened official job and reached the application start form for role 123' +
    ' | Limitations: none | Report: ' + today;
  const validProofAccepted = jtOppHasApplicationProof_(sample);
  sample[14] = sample[14].replace('reached the application start form', 'saw listing but form not tested');
  const weakProofBlocked = !jtOppHasApplicationProof_(sample);
  Logger.log('Missing proof blocked: ' + noProofBlocked);
  Logger.log('Correctly formatted sample proof accepted: ' + validProofAccepted);
  Logger.log('Weak proof blocked: ' + weakProofBlocked);
  Logger.log('No spreadsheet data was changed.');
  if (!noProofBlocked || !validProofAccepted || !weakProofBlocked) {
    throw new Error('Vacancy proof gate test failed. Do not deploy.');
  }
}

/** Read-only smoke test: expects 3 active / 8 recheck / 4 archive as of Oct 26. */
function jtTestOpportunityDashboardReadOnly() {
  const rows = jtGetOpportunityDashboard();
  const counts = {active: 0, recheck: 0, archive: 0};
  rows.forEach(function(job) {
    counts[job.group] += 1;
  });
  Logger.log('READ-ONLY DASHBOARD TEST: ' + rows.length + ' total opportunities.');
  Logger.log('Active: ' + counts.active);
  Logger.log('Needs recheck: ' + counts.recheck);
  Logger.log('Archive: ' + counts.archive);
  Logger.log('No spreadsheet data was changed.');
}

function jtTestDuplicateOpportunitySafetyReadOnly() {
  function shouldHide(job, application, sameTitleCount) {
    const titleKey =
      jtOppCompany_(job.company) + '|' +
      jtOppNormalize_(job.role);

    // Same safety condition as jtGetOpportunities().
    if (sameTitleCount[titleKey] > 1 &&
        (!jtOppJobId_(job.jobId) ||
         !jtOppJobId_(application.jobId))) {
      return false;
    }

    return jtOppIsSameJob_(
      job.company, job.role, job.jobId,
      application.company, application.role, application.jobId
    );
  }

  const counts = {
    'example co|software engineer': 2,
    'acme labs|customer success engineer': 1
  };

  const tests = [
    {
      name: 'Matching job ID is hidden',
      job: {company: 'Example Co', role: 'Software Engineer', jobId: 'JOB-1'},
      app: {company: 'Example Co', role: 'Software Engineer', jobId: 'JOB-1'},
      expected: true
    },
    {
      name: 'Different job ID stays visible',
      job: {company: 'Example Co', role: 'Software Engineer', jobId: 'JOB-2'},
      app: {company: 'Example Co', role: 'Software Engineer', jobId: 'JOB-1'},
      expected: false
    },
    {
      name: 'Ambiguous application stays visible',
      job: {company: 'Example Co', role: 'Software Engineer', jobId: 'JOB-2'},
      app: {company: 'Example Co', role: 'Software Engineer', jobId: ''},
      expected: false
    },
    {
      name: 'Unique exact job is hidden',
      job: {company: 'Acme Labs', role: 'Customer Success Engineer', jobId: ''},
      app: {company: 'Acme Labs', role: 'Customer Success Engineer', jobId: ''},
      expected: true
    },
    {
      name: 'Different company stays visible',
      job: {company: 'Acme Labs', role: 'Customer Success Engineer', jobId: ''},
      app: {company: 'Example Co', role: 'Customer Success Engineer', jobId: ''},
      expected: false
    }
  ];

  tests.forEach(function(test) {
    const actual = shouldHide(test.job, test.app, counts);
    if (actual !== test.expected) {
      throw new Error('FAIL: ' + test.name);
    }
    Logger.log('PASS: ' + test.name);
  });

  const jobs = jtGetOpportunityDashboard();
  const groups = {active: 0, recheck: 0, archive: 0};

  jobs.forEach(function(job) {
    groups[job.group]++;
  });

  Logger.log('Dashboard: ' + JSON.stringify(groups));
  Logger.log('ALL 5 TESTS PASSED');
  Logger.log('READ ONLY — NO DATA CHANGED');
}
