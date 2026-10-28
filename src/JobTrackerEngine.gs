/**
 * JOB TRACKER ENGINE v1
 *
 * Unified read-only analysis pipeline.
 *
 * IMPORTANT:
 * - Does not write to any spreadsheet.
 * - Does not change Gmail.
 * - Does not create or approve applications.
 * - Never automatically links emails or changes statuses.
 *
 * Uses existing classifier and title extractor during migration.
 */

function jtEngineNormalize_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jtEngineCompanyKey_(value) {
  const key = jtEngineNormalize_(value);

  const aliases = {
    'northstar systems': 'northstar',
    'acme labs': 'acme',
    'example ltd': 'example co'
  };

  return aliases[key] || key;
}

function jtEngineRoleValid_(value) {
  const role = jtEngineNormalize_(value);

  return role.length >= 5 &&
    ![
      'position',
      'role',
      'unknown',
      'not identified',
      'exact title not established',
      'role not specified'
    ].includes(role);
}

function jtEngineRoleTokens_(value) {
  return jtEngineNormalize_(value)
    .split(' ')
    .filter(function(word) {
      return word &&
        !['position', 'role', 'the', 'a'].includes(word);
    })
    .sort();
}

function jtEngineSimilarity_(a, b) {
  const left = new Set(jtEngineRoleTokens_(a));
  const right = new Set(jtEngineRoleTokens_(b));

  if (!left.size || !right.size) return 0;

  const shared = [...left].filter(function(word) {
    return right.has(word);
  }).length;

  return shared / new Set([...left, ...right]).size;
}

function jtEngineReadRows_(sheet, width) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, width
  ).getDisplayValues();
}

function jtEngineAnalyze_() {
  const ss = SpreadsheetApp.openById(JT.id);

  const master = ss.getSheetByName(JT.master);
  const inbox = ss.getSheetByName(JT.inbox);
  const links = ss.getSheetByName(JT.links);

  if (!master || !inbox || !links) {
    throw new Error('Required Job Tracker sheet missing');
  }

  const masterRows = jtEngineReadRows_(master, 10);
  const inboxRows = jtEngineReadRows_(inbox, 14);
  const linkRows = jtEngineReadRows_(links, 7);

  const applications = masterRows
    .map(function(row, index) {
      return {
        rowNumber: index + 2,
        company: String(row[0] || '').trim(),
        role: String(row[1] || '').trim(),
        jobId: String(row[2] || '').trim(),
        status: String(row[4] || '').trim(),
        applicationId: String(row[9] || '').trim()
      };
    })
    .filter(function(app) {
      return Boolean(app.company);
    });

  const appById = new Map();

  applications.forEach(function(app) {
    if (!app.applicationId) return;

    if (appById.has(app.applicationId)) {
      throw new Error(
        'Duplicate Master Application ID: ' +
        app.applicationId
      );
    }

    appById.set(app.applicationId, app);
  });

  const linksByMessage = new Map();

  linkRows.forEach(function(row) {
    const messageId = String(row[0] || '').trim();
    const applicationId = String(row[6] || '').trim();

    if (!messageId) return;

    if (!linksByMessage.has(messageId)) {
      linksByMessage.set(messageId, []);
    }

    linksByMessage.get(messageId).push(applicationId);
  });

  const results = [];

  inboxRows.forEach(function(row) {
    const messageId = String(row[0] || '').trim();
    if (!messageId) return;

    const storedCompany = String(row[2] || '').trim();
    const storedRole = String(row[3] || '').trim();
    const storedEvent = String(row[4] || '').trim();

    const result = {
      messageId: messageId,
      company: storedCompany,
      role: '',
      jobId: '',
      storedEvent: storedEvent,
      liveEvent: '',
      decision: 'NEEDS_REVIEW',
      reason: '',
      candidates: []
    };

    try {
      const msg = GmailApp.getMessageById(messageId);

      if (!msg) {
        throw new Error('Gmail message not found');
      }

      const subject = msg.getSubject() || '';
      const body = msg.getPlainBody() || '';
      const from = msg.getFrom() || '';

      // Existing classifier: source of truth during migration.
      const liveEvent = jtType_(subject, body, from);

      result.liveEvent = liveEvent || 'UNCLASSIFIED';

      const detectedCompany =
        jtCompany_(subject, from, body);

      const company =
        storedCompany || detectedCompany;

      result.company = company;

      const extracted =
        jtExtractJobTitle_(subject, body);

      result.jobId =
        String(extracted.jobId || '').trim();

      // Trust extracted titles only for application confirmations.
      let role = '';

      if (
        liveEvent === 'APPLICATION' &&
        extracted.confidence === 'HIGH' &&
        jtEngineRoleValid_(extracted.title)
      ) {
        role = extracted.title;
      } else if (jtEngineRoleValid_(storedRole)) {
        role = storedRole;
      } else if (liveEvent === 'APPLICATION') {
        const fallback = jtRole_(subject, company);

        if (jtEngineRoleValid_(fallback)) {
          role = fallback;
        }
      }

      result.role = role;

      const messageLinks =
        linksByMessage.get(messageId) || [];

      if (messageLinks.length > 1) {
        result.decision = 'NEEDS_REVIEW';
        result.reason = 'Duplicate Email Links entries';
        results.push(result);
        return;
      }

      if (messageLinks.length === 1) {
        const linkedApp =
          appById.get(messageLinks[0]);

        if (!linkedApp) {
          result.reason =
            'Email link points to an unknown application';
        } else {
          result.candidates = [linkedApp];
          result.decision = 'ALREADY_LINKED';
          result.reason =
            'Explicit Application ID link exists';
        }

        results.push(result);
        return;
      }

      // Existing Inbox records may have outdated classifications.
      if (storedEvent !== result.liveEvent) {
        result.decision = 'CLASSIFICATION_CONFLICT';
        result.reason =
          'Stored event differs from current Gmail classification';
        results.push(result);
        return;
      }

      if (
        !company ||
        company.toLowerCase() === 'unknown'
      ) {
        result.reason = 'Company not identified';
        results.push(result);
        return;
      }

      if (
        detectedCompany &&
        storedCompany &&
        jtEngineCompanyKey_(detectedCompany) !==
        jtEngineCompanyKey_(storedCompany)
      ) {
        result.reason =
          'Stored company differs from current detection';
        results.push(result);
        return;
      }

      const companyMatches =
        applications.filter(function(app) {
          return jtEngineCompanyKey_(app.company) ===
            jtEngineCompanyKey_(company);
        });

      // Never propose creating an application from a rejection,
      // assessment or status update.
      if (liveEvent !== 'APPLICATION') {
        result.candidates = companyMatches;
        result.decision = 'EVENT_REVIEW';
        result.reason =
          'Non-confirmation event requires explicit review';
        results.push(result);
        return;
      }

      if (!jtEngineRoleValid_(role)) {
        result.reason = 'Job title not established';
        results.push(result);
        return;
      }

      if (!companyMatches.length) {
        result.decision = 'NEW_COMPANY';
        result.reason =
          'Application confirmation; company absent from Master';
        results.push(result);
        return;
      }

      // Job ID is the strongest matching evidence.
      if (result.jobId) {
        const idMatches =
          companyMatches.filter(function(app) {
            return app.jobId === result.jobId;
          });

        if (idMatches.length === 1) {
          result.decision = 'EXACT_JOB_ID';
          result.candidates = idMatches;
          result.reason =
            'Same company and Job ID; approval still required';
          results.push(result);
          return;
        }

        if (idMatches.length > 1) {
          result.reason =
            'Multiple applications share the same Job ID';
          result.candidates = idMatches;
          results.push(result);
          return;
        }
      }

      const roleMatches =
        companyMatches.filter(function(app) {
          return jtEngineNormalize_(app.role) ===
            jtEngineNormalize_(role);
        });

      const compatibleRoleMatches =
        roleMatches.filter(function(app) {
          return !result.jobId ||
            !app.jobId ||
            app.jobId === result.jobId;
        });

      if (
        roleMatches.length !==
        compatibleRoleMatches.length
      ) {
        result.reason =
          'Matching role has a conflicting Job ID';
        result.candidates = roleMatches;
        results.push(result);
        return;
      }

      if (compatibleRoleMatches.length === 1) {
        result.decision = 'EXACT_ROLE';
        result.candidates = compatibleRoleMatches;
        result.reason =
          'Same company and normalized role; verify submission identity';
        results.push(result);
        return;
      }

      if (compatibleRoleMatches.length > 1) {
        result.reason =
          'Multiple existing applications have this role';
        result.candidates = compatibleRoleMatches;
        results.push(result);
        return;
      }

      const similar = companyMatches
        .map(function(app) {
          return {
            application: app,
            score: jtEngineSimilarity_(role, app.role)
          };
        })
        .filter(function(item) {
          return item.score >= 0.65 &&
            (
              !result.jobId ||
              !item.application.jobId ||
              item.application.jobId === result.jobId
            );
        })
        .sort(function(a, b) {
          return b.score - a.score;
        });

      if (similar.length) {
        result.decision = 'POSSIBLE_MATCH';
        result.reason =
          'Similar role found; manual confirmation required';
        result.candidates = similar.map(function(item) {
          return item.application;
        });
      } else {
        result.decision = 'POSSIBLE_NEW_ROLE';
        result.reason =
          'Company exists, but no matching role established';
        result.candidates = companyMatches;
      }

      results.push(result);

    } catch (error) {
      result.decision = 'ERROR';
      result.reason = String(error);
      results.push(result);
    }
  });

  return results;
}

/**
 * Safe diagnostic entry point.
 * READ ONLY.
 */
function jtEnginePreview() {
  const results = jtEngineAnalyze_();

  const summary = {};

  results.forEach(function(result) {
    summary[result.decision] =
      (summary[result.decision] || 0) + 1;
  });

  Logger.log('=== JOB TRACKER ENGINE v1 ===');

  results.forEach(function(result) {
    Logger.log(
      result.company + ' | ' +
      (result.role || '[NO ROLE]') +
      ' | ' + result.liveEvent +
      ' | ' + result.decision +
      ' | ' + result.reason +
      ' | CANDIDATES: ' +
      result.candidates.map(function(app) {
        return app.applicationId + ' (' + app.role + ')';
      }).join('; ') +
      ' | EMAIL: ' + result.messageId
    );
  });

  Logger.log('=== SUMMARY ===');
  Logger.log(JSON.stringify(summary, null, 2));
  Logger.log('READ ONLY — NO DATA CHANGED');

  return summary;
}