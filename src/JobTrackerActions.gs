/**
 * JOB TRACKER ACTIONS v1
 * Central approval workflow. No Master status changes or application creation.
 */
function jtGetActionQueue() {
  const ss = SpreadsheetApp.openById(JT.id);
  const inbox = ss.getSheetByName(JT.inbox);
  if (!inbox) throw new Error('Review Inbox missing');
  const rows = inbox.getLastRow() > 1
    ? inbox.getRange(2, 1, inbox.getLastRow() - 1, 14).getDisplayValues()
    : [];
  const inboxById = new Map();
  rows.forEach(function(row) {
    const id = String(row[0] || '').trim();
    if (!id) return;
    if (inboxById.has(id)) throw new Error('Duplicate Review Inbox message: ' + id);
    inboxById.set(id, {
      reviewStatus: String(row[7] || '').trim(),
      subject: String(row[6] || '').trim(),
      gmailLink: String(row[9] || '').trim()
    });
  });
  const results = jtEngineAnalyze_();
  return results.filter(function(result) {
    const inboxItem = inboxById.get(result.messageId);
    return inboxItem && inboxItem.reviewStatus === 'NEW';
  }).map(function(result) {
    const inboxItem = inboxById.get(result.messageId);
    const exactMatch = result.decision === 'EXACT_ROLE' || result.decision === 'EXACT_JOB_ID';
    const canLink = exactMatch && result.liveEvent === 'APPLICATION' &&
      result.storedEvent === 'APPLICATION' && result.candidates.length === 1 &&
      Boolean(result.candidates[0].applicationId);
    let proposedAction = 'MANUAL_REVIEW';
    if (result.decision === 'ALREADY_LINKED') {
      proposedAction = 'REVIEW_LINKED_EVENT';
    } else if (canLink) {
      proposedAction = 'LINK_EXISTING';
    } else if (result.decision === 'CLASSIFICATION_CONFLICT') {
      proposedAction = 'REVIEW_CLASSIFICATION';
    } else if (['REJECTION', 'INTERVIEW', 'ASSESSMENT', 'STATUS UPDATE — REVIEW'].includes(result.liveEvent)) {
      proposedAction = 'REVIEW_STATUS';
    } else if (result.decision === 'NEW_COMPANY' || result.decision === 'POSSIBLE_NEW_ROLE') {
      proposedAction = 'REVIEW_NEW_APPLICATION';
    } else if (result.decision === 'POSSIBLE_MATCH') {
      proposedAction = 'REVIEW_POSSIBLE_MATCH';
    }
    return {
      messageId: result.messageId, company: result.company, role: result.role,
      storedEvent: result.storedEvent, liveEvent: result.liveEvent,
      decision: result.decision, proposedAction: proposedAction, reason: result.reason,
      canLink: canLink, subject: inboxItem.subject, gmailLink: inboxItem.gmailLink,
      candidates: result.candidates.map(function(app) {
        return {applicationId: app.applicationId, company: app.company,
          role: app.role, status: app.status};
      })
    };
  });
}
function jtApproveExactEmailLink(messageId, expectedApplicationId) {
  const id = String(messageId || '').trim();
  const appId = String(expectedApplicationId || '').trim();
  if (!id || !appId) throw new Error('Message ID and Application ID required');
  const matches = jtGetActionQueue().filter(function(item) {
    return item.messageId === id;
  });
  if (matches.length !== 1) throw new Error('Email is missing, duplicated, or no longer pending.');
  const item = matches[0];
  if (!item.canLink || item.proposedAction !== 'LINK_EXISTING') {
    throw new Error('Exact linking is not currently approved for this email.');
  }
  if (item.candidates.length !== 1 || item.candidates[0].applicationId !== appId) {
    throw new Error('Suggested application changed. Refresh before approving.');
  }
  return saveEmailLink(id, appId);
}
function jtPreviewActionQueue() {
  const queue = jtGetActionQueue();
  const summary = {};
  queue.forEach(function(item) {
    summary[item.proposedAction] = (summary[item.proposedAction] || 0) + 1;
  });
  Logger.log('=== JOB TRACKER ACTION QUEUE ===');
  Logger.log(JSON.stringify(summary, null, 2));
  Logger.log('TOTAL PENDING: ' + queue.length);
  Logger.log('READ ONLY — NO DATA CHANGED');
  return summary;
}
function jtMarkOneEmailReviewed(messageId, expectedStoredEvent, expectedLiveEvent) {
  const id = String(messageId || '').trim();
  const stored = String(expectedStoredEvent || '').trim();
  const live = String(expectedLiveEvent || '').trim();
  if (!id || !stored || !live) throw new Error('Required review details are missing.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(JT.id);
    const inbox = ss.getSheetByName(JT.inbox);
    if (!inbox) throw new Error('Review Inbox not found.');
    const lastRow = inbox.getLastRow();
    if (lastRow < 2) throw new Error('Review Inbox is empty.');
    const rows = inbox.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
    const matches = [];
    rows.forEach(function(row, index) {
      if (String(row[0] || '').trim() === id) {
        matches.push({rowNumber: index + 2,
          event: String(row[4] || '').trim(), status: String(row[7] || '').trim()});
      }
    });
    if (matches.length !== 1) throw new Error('Email missing or duplicated. Nothing changed.');
    const match = matches[0];
    if (match.status !== 'NEW') throw new Error('This email is no longer pending review.');
    if (match.event !== stored) throw new Error('Stored classification changed. Refresh first.');
    const message = GmailApp.getMessageById(id);
    if (!message) throw new Error('Original Gmail message not found.');
    const currentEvent = jtType_(message.getSubject() || '', message.getPlainBody() || '', message.getFrom() || '');
    if (currentEvent !== live) throw new Error('Current classification changed. Refresh first.');
    if (stored !== live) throw new Error('Stored and current classifications differ. Resolve before marking reviewed.');
    inbox.getRange(match.rowNumber, 8).setValue('REVIEWED');
    Logger.log('Reviewed email: ' + id + ' | Stored: ' + stored + ' | Current: ' + live);
    return 'Email marked as reviewed. Master unchanged.';
  } finally {
    lock.releaseLock();
  }
}
