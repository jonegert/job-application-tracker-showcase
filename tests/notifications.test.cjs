const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'JobTrackerNotifications.gs'), 'utf8');

function setup({ entries = [], propOverrides = {}, locked = false, failPush = false } = {}) {
  const saved = new Map(Object.entries({
    JT_APPROVAL_CENTER_URL: 'https://script.google.com/macros/s/test-deployment/exec',
    PUSHOVER_USER_KEY: 'fake-user-key',
    PUSHOVER_API_TOKEN: 'fake-token',
    ...propOverrides
  }));
  const fetchCalls = [];
  let releaseCount = 0;
  const sandbox = {
    JT: { id: 'fake-sheet', inbox: 'Review Inbox' },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => saved.get(key) || '',
        setProperty: (key, value) => saved.set(key, value)
      })
    },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => ({
          getLastRow: () => entries.length + 1,
          getRange: () => ({ getDisplayValues: () => entries })
        })
      })
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => !locked,
        releaseLock: () => { releaseCount += 1; }
      })
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        fetchCalls.push({ url, options });
        return {
          getResponseCode: () => failPush ? 500 : 200,
          getContentText: () => JSON.stringify({ status: failPush ? 0 : 1 })
        };
      }
    },
    Logger: { log() {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'JobTrackerNotifications.gs' });
  return { sandbox, saved, fetchCalls, releaseCount: () => releaseCount };
}

function row(id, status = 'NEW') {
  // Eight Review Inbox columns; company is index 2, role index 3, event index 4.
  return [id, '', 'Example Co', 'Student Engineer', 'APPLICATION', '', 'Email subject', status];
}

test('no pending messages means no alert', () => {
  const x = setup({ entries: [row('id-1', 'REVIEWED')] });
  const result = x.sandbox.jtNotifyPendingEmails_();
  assert.equal(result.sent, 0);
  assert.equal(x.fetchCalls.length, 0);
});

test('one new message sends a push with the configured /exec URL exactly once', () => {
  const x = setup({ entries: [row('id-1')] });
  assert.equal(x.sandbox.jtNotifyPendingEmails_().sent, 1);
  assert.equal(x.fetchCalls.length, 1);
  assert.equal(
    x.fetchCalls[0].options.payload.url,
    'https://script.google.com/macros/s/test-deployment/exec'
  );
  assert.deepEqual(JSON.parse(x.saved.get('JT_PUSH_SENT_IDS_V1')), ['id-1']);
  assert.equal(x.sandbox.jtNotifyPendingEmails_().sent, 0);
  assert.equal(x.fetchCalls.length, 1);
});

test('failed Pushover request does not mark any email as notified', () => {
  const x = setup({ entries: [row('id-2')], failPush: true });
  assert.throws(() => x.sandbox.jtNotifyPendingEmails_(), /Pushover returned an error/);
  assert.equal(x.saved.has('JT_PUSH_SENT_IDS_V1'), false);
  assert.equal(x.releaseCount(), 1);
});

test('lock contention skips without sending or changing notification history', () => {
  const x = setup({ entries: [row('id-3')], locked: true });
  assert.equal(x.sandbox.jtNotifyPendingEmails_().skipped, 'locked');
  assert.equal(x.fetchCalls.length, 0);
  assert.equal(x.saved.has('JT_PUSH_SENT_IDS_V1'), false);
});

test('duplicate pending Gmail IDs fail closed', () => {
  const x = setup({ entries: [row('same'), row('same')] });
  assert.throws(() => x.sandbox.jtNotifyPendingEmails_(), /Duplicate Gmail message IDs/);
  assert.equal(x.fetchCalls.length, 0);
});

test('corrupt notification history fails closed instead of sending duplicates', () => {
  const x = setup({ entries: [row('id-4')], propOverrides: { JT_PUSH_SENT_IDS_V1: '{bad-json' } });
  assert.throws(() => x.sandbox.jtNotifyPendingEmails_(), /Notification history invalid/);
  assert.equal(x.fetchCalls.length, 0);
});
