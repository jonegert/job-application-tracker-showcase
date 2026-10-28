/**
 * JOB TRACKER NOTIFICATIONS — additive module
 *
 * Sends one Pushover alert when unreviewed emails first enter Review Inbox.
 * Never changes Master Tracker, Email Links, inbox statuses, or Gmail.
 * Uses existing JT and scanApplications() definitions.
 *
 * Setup: run jtInstallNotificationTriggers() ONCE from Apps Script.
 * Do not run the old installAutomation()/installHourlyTrigger() later,
 * because those functions recreate the scanApplications trigger.
 */

const JT_PUSH_SENT_IDS_PROPERTY = 'JT_PUSH_SENT_IDS_V1';

// Published, permanent Approval Center URL (not the /dev test URL).
const JT_APPROVAL_CENTER_URL = PropertiesService.getScriptProperties().getProperty('JT_APPROVAL_CENTER_URL') || '';

/** Existing scanner + notification hook, intended for an hourly trigger. */
function jtMonitorAndNotify() {
  scanApplications();
  return jtNotifyPendingEmails_();
}

/**
 * Sends a single summary for NEW email IDs not previously notified.
 * Script lock prevents duplicate notifications from concurrent runs.
 * The sent-ID ledger is written only AFTER a successful Pushover response.
 */
function jtNotifyPendingEmails_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Notification skipped: another job is running; retry next hour.');
    return { sent: 0, skipped: 'locked' };
  }
  try {
    const ss = SpreadsheetApp.openById(JT.id);
    const inbox = ss.getSheetByName(JT.inbox);
    if (!inbox) throw new Error('Review Inbox missing.');

    const rows = inbox.getLastRow() > 1
      ? inbox.getRange(2, 1, inbox.getLastRow() - 1, 8).getDisplayValues()
      : [];

    const pending = rows.filter(function(row) {
      return String(row[0] || '').trim() &&
        String(row[7] || '').trim().toUpperCase() === 'NEW';
    });

    // Reject inconsistent Inbox data rather than making potentially wrong alerts.
    const pendingIds = pending.map(function(row) { return String(row[0]).trim(); });
    if (new Set(pendingIds).size !== pendingIds.length) {
      throw new Error('Duplicate Gmail message IDs in pending Review Inbox.');
    }

    const props = PropertiesService.getScriptProperties();
    let sentIds;
    try {
      sentIds = JSON.parse(props.getProperty(JT_PUSH_SENT_IDS_PROPERTY) || '[]');
    } catch (error) {
      throw new Error('Notification history invalid; inspect script property before proceeding.');
    }
    if (!Array.isArray(sentIds)) throw new Error('Notification history is not an array.');
    const seen = new Set(sentIds);
    const fresh = pending.filter(function(row) { return !seen.has(String(row[0]).trim()); });

    if (!fresh.length) {
      Logger.log('Pushover: no newly pending email. Currently NEW: ' + pending.length);
      return { sent: 0, pending: pending.length };
    }

    const token = props.getProperty('PUSHOVER_API_TOKEN');
    const user = props.getProperty('PUSHOVER_USER_KEY');
    if (!token || !user) throw new Error('Missing Pushover Script Properties.');

    // Always link to the exact published /exec deployment.
    // Do not rely on getService().getUrl(), which may refer to a different deployment.
    const destination = JT_APPROVAL_CENTER_URL;

    const preview = fresh.slice(0, 5).map(function(row) {
      const company = String(row[2] || 'Company unknown').trim();
      const event = String(row[4] || 'REVIEW').trim();
      const role = String(row[3] || '').trim();
      return '\u2022 ' + company + ' \u2014 ' + event + (role ? ' \u2014 ' + role : '');
    });
    const body = (
      fresh.length + ' new email(s) require your review in Job Tracker.\n' +
      preview.join('\n') +
      (fresh.length > 5 ? '\n+ ' + (fresh.length - 5) + ' additional email(s)' : '')
    ).slice(0, 950);

    const response = UrlFetchApp.fetch('https://api.pushover.net/1/messages.json', {
      method: 'post',
      payload: {
        token: token,
        user: user,
        title: 'Job Tracker: ' + fresh.length + ' new email(s)',
        message: body,
        url: destination,
        url_title: 'Open Approval Center',
        priority: '0'
      },
      muteHttpExceptions: true
    });
    let result;
    try { result = JSON.parse(response.getContentText()); } catch (error) {
      throw new Error('Pushover response was not valid JSON (HTTP ' + response.getResponseCode() + ').');
    }
    if (response.getResponseCode() !== 200 || result.status !== 1) {
      throw new Error('Pushover returned an error (HTTP ' + response.getResponseCode() + ').');
    }

    const nextIds = sentIds.concat(fresh.map(function(row) { return String(row[0]).trim(); }));
    props.setProperty(JT_PUSH_SENT_IDS_PROPERTY, JSON.stringify(nextIds.slice(-350)));
    Logger.log('Pushover sent for ' + fresh.length + ' NEW email(s). Duplicate notifications prevented.');
    return { sent: fresh.length, pending: pending.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Installs only one hourly scan+push trigger, plus a daily missing-title email.
 * Creates the replacement first, then removes obsolete scan-only triggers.
 * Does NOT run a scan or send a push notification itself.
 */
function jtInstallNotificationTriggers() {
  const existing = ScriptApp.getProjectTriggers();
  let monitor = existing.filter(function(trigger) {
    return trigger.getHandlerFunction() === 'jtMonitorAndNotify';
  });
  if (!monitor.length) {
    ScriptApp.newTrigger('jtMonitorAndNotify').timeBased().everyHours(1).create();
  }
  // Only the obsolete scanner trigger is replaced. Leave unrelated triggers alone.
  existing.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'scanApplications') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  // Keep a single monitor trigger when setup is run twice.
  monitor = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'jtMonitorAndNotify';
  });
  monitor.slice(1).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });

  const hasDaily = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'dailyMissingRoleSummary';
  });
  if (!hasDaily) {
    ScriptApp.newTrigger('dailyMissingRoleSummary')
      .timeBased().everyDays(1).atHour(18).inTimezone('Asia/Jerusalem').create();
  }
  Logger.log('Installed: hourly jtMonitorAndNotify + dailyMissingRoleSummary at ~18:00 Israel time.');
  Logger.log('Old scanApplications-only trigger removed. No sheet rows changed.');
}

/** READ ONLY — checks the expected triggers after installation. */
function jtVerifyNotificationTriggers() {
  const names = ScriptApp.getProjectTriggers().map(function(trigger) {
    return trigger.getHandlerFunction();
  });
  Logger.log('Trigger functions: ' + JSON.stringify(names));
  const hourly = names.filter(function(x) { return x === 'jtMonitorAndNotify'; }).length;
  const daily = names.filter(function(x) { return x === 'dailyMissingRoleSummary'; }).length;
  const obsolete = names.filter(function(x) { return x === 'scanApplications'; }).length;
  if (hourly !== 1 || daily !== 1 || obsolete !== 0) {
    throw new Error('Trigger setup inconsistent. Check Triggers before proceeding.');
  }
  Logger.log('PASS: one scan+push trigger, one daily summary trigger, no obsolete scan-only trigger.');
}

/**
 * READ ONLY — confirms the exact published destination used in Pushover alerts.
 * Does not send an alert or change any data.
 */
function jtVerifyApprovalCenterNotificationUrl() {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(JT_APPROVAL_CENTER_URL)) {
    throw new Error('Approval Center URL must be the published /exec Web App URL.');
  }
  Logger.log('PASS: Pushover destination is the published Approval Center: ' +
    JT_APPROVAL_CENTER_URL);
  return JT_APPROVAL_CENTER_URL;
}
