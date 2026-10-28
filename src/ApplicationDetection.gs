/**

 * JOB TRACKER — APPLICATION DETECTION v3

 *

 * READ-ONLY PREVIEW

 *

 * Reads:

 * - Master Tracker

 * - Review Inbox

 * - Email Links

 *

 * Does not modify spreadsheets or Gmail.

 */

function previewApplicationDetection() {

  const ss = SpreadsheetApp.openById(JT.id);

  const master = ss.getSheetByName(JT.master);

  const inbox = ss.getSheetByName(JT.inbox);

  const links = ss.getSheetByName(JT.links);

  if (!master || !inbox || !links) {

    throw new Error('Required sheet is missing.');

  }

  function readRows(sheet, width) {

    const count = sheet.getLastRow() - 1;

    return count > 0

      ? sheet.getRange(2, 1, count, width).getDisplayValues()

      : [];

  }

  const masterRows = readRows(master, 10);

  const inboxRows = readRows(inbox, 14);

  const linkRows = readRows(links, 7);

  function normalize(value) {

    return String(value || '')

      .toLowerCase()

      .replace(/[^a-z0-9\u0590-\u05ff]+/g, ' ')

      .replace(/\s+/g, ' ')

      .trim();

  }

  function normalizeCompany(value) {

    const name = normalize(value);

    const aliases = {

      'acme labs': 'acme',

      'acme': 'acme',

      'northstar systems': 'northstar',

      'northstar': 'northstar',

      'example ltd': 'example co'

    };

    return aliases[name] || name;

  }

  function cleanRole(value) {

    return String(value || '')

      .replace(/\s+/g, ' ')

      .replace(/\s+(?:position|role)\s*$/i, '')

      .trim();

  }

  function validRole(value) {

    const role = normalize(cleanRole(value));

    if (!role || role.length < 5) return false;

    const invalid = [

      'position',

      'role',

      'unknown',

      'not identified',

      'application',

      'thank you',

      'thanks for applying',

      'exact title not established',

      'role not specified'

    ];

    return !invalid.includes(role);

  }

  function extractJobId(subject) {

    const s = String(subject || '');

    const patterns = [

      /\b(?:job|req|requisition|reference)\s*(?:id|number|no|#)?\s*[:#-]?\s*(JR[-\s]?\d{4,}|\d{5,})\b/i,

      /\b(JR[-\s]?\d{4,})\b/i,

      /\b(\d{5,})\s*$/,

      /\b(?:position|role)\s*#\s*(\d{4,})\b/i

    ];

    for (const pattern of patterns) {

      const match = s.match(pattern);

      if (match && match[1]) {

        return match[1].toUpperCase().replace(/\s+/g, '');

      }

    }

    return '';

  }

  function extractRole(subject) {

    const s = String(subject || '')

      .replace(/^\s*(re:|fw:|fwd:)\s*/ig, '')

      .trim();

    const patterns = [

      /application confirmation\s*\|\s*(.+)$/i,

      /thanks for applying to the\s*(.+?)\s+position at/i,

      /thank you for applying for the\s*(.+?)\s+position at/i,

      /thanks for applying for\s*(.+?)\s+position(?:\s+position)?\s*(?:@|at)\s/i,

      /thanks for applying for\s*(.+?)\s*(?:@|at)\s/i,

      /thanks for applying for\s*(.+)$/i,

      /your application for\s*(.+?)\s+\d{5,}\s*$/i,

      /exampleco\s*[-–]\s*(.+)$/i,

      /applying to the\s*(.+?)\s+position at/i

    ];

    for (const pattern of patterns) {

      const match = s.match(pattern);

      if (!match || !match[1]) continue;

      const role = cleanRole(

        match[1].replace(/\s+\d{5,}\s*$/, '')

      );

      if (validRole(role)) return role;

    }

    return '';

  }

  function verifiedEvidence(value) {

    const evidence = normalize(value);

    // Only explicit confirmation categories qualify.

    return (

      evidence.includes('application confirmation') ||

      evidence.includes('confirmed application') ||

      evidence.includes('verified application') ||

      evidence.includes('אישור הגשה')

    );

  }

  function isRejected(value) {

    const status = normalize(value);

    return (

      status.includes('reject') ||

      status.includes('declined') ||

      status.includes('not selected') ||

      status.includes('נדח')

    );

  }

  const applications = masterRows.map(function(row, index) {

    return {

      rowNumber: index + 2,

      company: String(row[0] || '').trim(),

      role: String(row[1] || '').trim(),

      jobId: String(row[2] || '').trim().toUpperCase(),

      evidence: String(row[3] || '').trim(),

      status: String(row[4] || '').trim(),

      applicationId: String(row[9] || '').trim()

    };

  }).filter(function(app) {

    return Boolean(app.company);

  });

  const applicationsById = new Map();

  applications.forEach(function(app) {

    if (!app.applicationId) return;

    if (applicationsById.has(app.applicationId)) {

      throw new Error(

        'Duplicate Application ID: ' + app.applicationId

      );

    }

    applicationsById.set(app.applicationId, app);

  });

  const linkedMessages = new Map();

  linkRows.forEach(function(row) {

    const messageId = String(row[0] || '').trim();

    const applicationId = String(row[6] || '').trim();

    if (!messageId) return;

    if (linkedMessages.has(messageId)) {

      throw new Error(

        'Duplicate Email Links entry: ' + messageId

      );

    }

    linkedMessages.set(messageId, applicationId);

  });

  function classifyExisting(app) {

    if (isRejected(app.status)) {

      return {

        decision: 'ALREADY VERIFIED',

        reason: 'Existing rejected application. Preserve rejection.'

      };

    }

    if (verifiedEvidence(app.evidence)) {

      return {

        decision: 'ALREADY VERIFIED',

        reason: 'Existing application has verified evidence.'

      };

    }

    return {

      decision: 'VERIFY EXISTING',

      reason: 'Existing record has application email evidence, but its current evidence category is not explicitly verified.'

    };

  }

  const results = [];

  inboxRows.forEach(function(row) {

    if (String(row[4] || '').trim() !== 'APPLICATION') {

      return;

    }

    const messageId = String(row[0] || '').trim();

    const company = String(row[2] || '').trim();

    const storedRole = String(row[3] || '').trim();

    const subject = String(row[6] || '').trim();

    const extractedRole = extractRole(subject);

    const role = validRole(extractedRole)

      ? extractedRole

      : validRole(storedRole)

        ? cleanRole(storedRole)

        : '';

    const jobId = extractJobId(subject);

    const result = {

      messageId: messageId,

      company: company,

      role: role,

      jobId: jobId,

      subject: subject,

      decision: '',

      reason: '',

      applicationId: ''

    };

    function useExisting(app, matchReason) {

      const classification = classifyExisting(app);

      result.decision = classification.decision;

      result.reason = matchReason + ' ' + classification.reason;

      result.applicationId = app.applicationId;

    }

    if (linkedMessages.has(messageId)) {

      const appId = linkedMessages.get(messageId);

      const app = applicationsById.get(appId);

      if (!app) {

        result.decision = 'NEEDS REVIEW';

        result.reason = 'Email link references an unknown application.';

      } else {

        useExisting(app, 'Explicit Application ID link.');

      }

      results.push(result);

      return;

    }

    if (!company) {

      result.decision = 'NEEDS REVIEW';

      result.reason = 'Company not identified.';

      results.push(result);

      return;

    }

    const sameCompany = applications.filter(function(app) {

      return normalizeCompany(app.company) ===

        normalizeCompany(company);

    });

    if (jobId) {

      const sameJobId = sameCompany.filter(function(app) {

        return app.jobId === jobId;

      });

      if (sameJobId.length === 1) {

        useExisting(sameJobId[0], 'Company and Job ID match.');

        results.push(result);

        return;

      }

      if (sameJobId.length > 1) {

        result.decision = 'NEEDS REVIEW';

        result.reason = 'Multiple Master records share this Job ID.';

        results.push(result);

        return;

      }

      // Never merge distinct known Job IDs merely by role.

      const conflictingRole = sameCompany.some(function(app) {

        return (

          app.jobId &&

          app.jobId !== jobId &&

          validRole(role) &&

          normalize(app.role) === normalize(role)

        );

      });

      if (conflictingRole) {

        result.decision = 'NEEDS REVIEW';

        result.reason = 'Role matches but Job ID differs.';

        results.push(result);

        return;

      }

    }

    if (!validRole(role)) {

      result.decision = 'NEEDS REVIEW';

      result.reason = 'Exact role not identified.';

      results.push(result);

      return;

    }

    const sameRole = sameCompany.filter(function(app) {

      return (

        normalize(app.role) === normalize(role) &&

        (!jobId || !app.jobId || app.jobId === jobId)

      );

    });

    if (sameRole.length === 1) {

      useExisting(sameRole[0], 'Exact company and role match.');

    } else if (sameRole.length > 1) {

      result.decision = 'NEEDS REVIEW';

      result.reason = 'Multiple matching Master records.';

    } else if (sameCompany.length > 0) {

  result.decision = 'CREATE NEW';

  result.reason =
    'Company exists in Master, but this is a different role. ' +
    'New application candidate; explicit approval required. ' +
    'Verify that this is not a duplicate before approving.';

} else {

  result.decision = 'CREATE NEW';

  result.reason =
    'No matching company in Master. ' +
    'New application candidate; approval required.';

}

    results.push(result);

  });

  const groups = new Map();

  results.forEach(function(result) {

    const key = result.applicationId

      ? 'APP|' + result.applicationId

      : result.company && result.jobId

        ? 'JOB|' + normalizeCompany(result.company) + '|' + result.jobId

        : result.company && validRole(result.role)

          ? 'ROLE|' + normalizeCompany(result.company) + '|' + normalize(result.role)

          : 'EMAIL|' + result.messageId;

    if (!groups.has(key)) {

      groups.set(key, {

        company: result.company,

        role: result.role,

        jobId: result.jobId,

        decision: result.decision,

        reason: result.reason,

        applicationId: result.applicationId,

        emails: []

      });

    }

    groups.get(key).emails.push({

      messageId: result.messageId,

      subject: result.subject

    });

  });

  const grouped = Array.from(groups.values());

  const summary = {

    emails: results.length,

    uniqueGroups: grouped.length,

    createNew: grouped.filter(function(g) {

      return g.decision === 'CREATE NEW';

    }).length,

    alreadyVerified: grouped.filter(function(g) {

      return g.decision === 'ALREADY VERIFIED';

    }).length,

    verifyExisting: grouped.filter(function(g) {

      return g.decision === 'VERIFY EXISTING';

    }).length,

    needsReview: grouped.filter(function(g) {

      return g.decision === 'NEEDS REVIEW';

    }).length

  };

  Logger.log('========== APPLICATION DETECTION v3 ==========');

  Logger.log(JSON.stringify(summary, null, 2));

  grouped.forEach(function(group) {

    Logger.log(JSON.stringify(group));

  });

  Logger.log('==============================================');

  return {

    summary: summary,

    groups: grouped

  };

}
/**

 * Returns application detection results to Approval Center.

 *

 * READ ONLY:

 * - Does not create applications

 * - Does not change statuses

 * - Does not modify spreadsheets or Gmail

 */

function getApplicationDetectionResults() {

  const detection = previewApplicationDetection();

  return {

    summary: detection.summary,

    applications: detection.groups.map(function(group) {

      return {

        company: group.company,

        role: group.role,

        jobId: group.jobId,

        decision: group.decision,

        reason: group.reason,

        applicationId: group.applicationId,

        emailCount: group.emails.length,

        emails: group.emails

      };

    })

  };

}