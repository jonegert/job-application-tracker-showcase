/**
 * JOB TRACKER — APPLICATION APPROVAL v3
 * Explicit approval only. Does not edit existing application statuses.
 * Prevents creation from REVIEWED / IGNORE emails and guards partial writes.
 */
function approveNewApplication(messageIds, expectedCompany, expectedRole, expectedJobId) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new Error('No confirmation emails supplied.');
  }

  const ids = [...new Set(messageIds.map(function(id) {
    return String(id || '').trim();
  }))];
  if (ids.some(function(id) { return !id; })) {
    throw new Error('Invalid message ID.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Another approval is running. Refresh and retry.');
  }

  try {
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

    function normalize(value) {
      return String(value || '').toLowerCase()
        .replace(/[^a-z0-9\u0590-\u05ff]+/g, ' ')
        .replace(/\s+/g, ' ').trim();
    }

    function normalizeCompany(value) {
      const name = normalize(value);
      const aliases = {
        'acme labs': 'acme',
        'northstar systems': 'northstar',
        'example ltd': 'example co'
      };
      return aliases[name] || name;
    }

    // Re-read live detection inside the lock; do not trust stale UI cards.
    const detection = previewApplicationDetection();
    const matches = detection.groups.filter(function(group) {
      const groupIds = (group.emails || []).map(function(email) {
        return String(email.messageId || '').trim();
      });
      return groupIds.length === ids.length &&
        ids.every(function(id) { return groupIds.includes(id); });
    });
    if (matches.length !== 1) {
      throw new Error('Candidate changed. Refresh Application Detection.');
    }

    const candidate = matches[0];
    if (candidate.decision !== 'CREATE NEW') {
      throw new Error('Candidate is no longer eligible for creation.');
    }
    if (
      candidate.company !== expectedCompany ||
      candidate.role !== expectedRole ||
      String(candidate.jobId || '') !== String(expectedJobId || '')
    ) {
      throw new Error('Application details changed. Refresh before approving.');
    }

    const masterRows = readRows(master, 10);
    const inboxRows = readRows(inbox, 14);
    const linkRows = readRows(links, 7);
    const companyKey = normalizeCompany(candidate.company);
    const roleKey = normalize(candidate.role);
    const jobKey = normalize(candidate.jobId);
    if (!companyKey || !roleKey || roleKey === 'position' || roleKey === 'unknown') {
      throw new Error('Company or exact job title is not established.');
    }

    const duplicateApplication = masterRows.some(function(row) {
      if (normalizeCompany(row[0]) !== companyKey) return false;
      const existingRole = normalize(row[1]);
      const existingJobId = normalize(row[2]);
      if (jobKey && existingJobId) return jobKey === existingJobId;
      return Boolean(roleKey && existingRole && existingRole === roleKey);
    });
    if (duplicateApplication) {
      throw new Error('An application with the same company and role or Job ID already exists. Manual review required.');
    }

    const existingLinks = new Set(linkRows.map(function(row) {
      return String(row[0] || '').trim();
    }));
    if (ids.some(function(id) { return existingLinks.has(id); })) {
      throw new Error('An email is already linked to an application.');
    }

    // Require exactly one pending APPLICATION per requested message ID.
    // A prior REVIEWED or IGNORE decision cannot be silently overridden.
    const emailRows = ids.map(function(id) {
      const found = inboxRows.filter(function(row) {
        return String(row[0] || '').trim() === id;
      });
      if (found.length !== 1) {
        throw new Error('Confirmation email missing or duplicated: ' + id);
      }
      return found[0];
    });
    emailRows.forEach(function(row) {
      if (String(row[4] || '').trim() !== 'APPLICATION') {
        throw new Error('Source email is not an APPLICATION confirmation.');
      }
      if (String(row[7] || '').trim() !== 'NEW') {
        throw new Error('Source email was already reviewed or ignored. Refresh and review manually.');
      }
      const emailCompany = normalizeCompany(row[2]);
      if (!emailCompany || emailCompany !== companyKey) {
        throw new Error('Source email company does not match selected application.');
      }
    });

    const existingIds = new Set(masterRows.map(function(row) {
      return String(row[9] || '').trim();
    }));
    let applicationId;
    do {
      applicationId = 'APP-' + Utilities.getUuid();
    } while (existingIds.has(applicationId));

    const dates = emailRows
      .map(function(row) { return new Date(row[1]); })
      .filter(function(date) { return !isNaN(date.getTime()); });
    const applicationDate = dates.length
      ? new Date(Math.min.apply(null, dates.map(Number))) : '';

    const newRow = [
      candidate.company,
      candidate.role,
      candidate.jobId || '',
      'Application confirmation email — verified',
      'Submitted — outcome unknown',
      applicationDate,
      new Date(),
      'Monitor application updates',
      'Created after explicit approval from Application Detection.',
      applicationId
    ];

    // Sheets provides no cross-tab transaction. Avoid pretending the two
    // writes are atomic: report precise partial-commit details on failure.
    let masterWritten = false;
    try {
      master.appendRow(newRow);
      masterWritten = true;
      const masterRowNumber = master.getLastRow();
      const linkedAt = new Date();
      const newLinks = ids.map(function(id) {
        return [
          id,
          masterRowNumber,
          candidate.company,
          candidate.role,
          linkedAt,
          'Application Detection approval',
          applicationId
        ];
      });
      links.getRange(links.getLastRow() + 1, 1, newLinks.length, 7)
        .setValues(newLinks);
      SpreadsheetApp.flush();
    } catch (error) {
      if (masterWritten) {
        throw new Error(
          'PARTIAL WRITE POSSIBLE. Application ID: ' + applicationId +
          '. Do not retry automatically. Check Master Tracker and Email Links. Cause: ' + error
        );
      }
      throw error;
    }

    return {
      success: true,
      applicationId: applicationId,
      company: candidate.company,
      role: candidate.role,
      linkedEmails: ids.length
    };
  } finally {
    lock.releaseLock();
  }
}
