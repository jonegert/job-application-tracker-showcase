/**

 * JOB TRACKER v5

 *

 * Gmail monitoring + Review Inbox + Approval Center

 * Application ID based email linking.

 *

 * SAFETY:

 * - Gmail messages are never modified.

 * - Scanning never modifies Master Tracker.

 * - Linking an email only modifies Email Links.

 * - No automatic approval or rejection updates.

 */

const JT = {

  id: PropertiesService.getScriptProperties().getProperty('JT_SPREADSHEET_ID'),

  master: 'Master Tracker',

  inbox: 'Review Inbox',

  dashboard: 'Dashboard',

  links: 'Email Links',

  days: 45,

  maxThreads: 300,

  owners: [PropertiesService.getScriptProperties().getProperty('JT_OWNER_EMAIL')]

};

const JT_HEADERS = [

  'Message ID',

  'Received at',

  'Company',

  'Role / subject',

  'Event',

  'Sender',

  'Email subject',

  'Review status',

  'Suggested action',

  'Gmail link',

  'Processed at',

  'Match in Master',

  'Confidence',

  'Role missing'

];

const JT_COMPANIES = [
  'Example Co',
  'Northstar Systems',
  'Acme Labs'
];

// =====================================================

// MENU

// =====================================================

function onOpen() {

  SpreadsheetApp.getUi()

    .createMenu('Job Tracker')

    .addItem('Preview emails (no changes)', 'runPreview')

    .addItem('Scan Gmail into Review Inbox', 'scanApplications')


    .addItem('Install hourly scan + push notifications', 'jtInstallNotificationTriggers')

    .addItem('Refresh dashboard', 'refreshDashboard')

    .addToUi();

}

// =====================================================

// SHEET HELPERS

// =====================================================

function jtBook_() {

  return SpreadsheetApp.openById(JT.id);

}

function jtSheet_(name, headers) {

  const ss = jtBook_();

  let sh = ss.getSheetByName(name);

  if (!sh) {

    sh = ss.insertSheet(name);

  }

  if (headers) {

    if (sh.getLastRow() === 0) {

      sh.getRange(1, 1, 1, headers.length)

        .setValues([headers]);

    }

    sh.setFrozenRows(1);

    sh.getRange(1, 1, 1, headers.length)

      .setFontWeight('bold')

      .setBackground('#dce9f6');

  }

  return sh;

}

function jtInbox_() {

  const sh = jtSheet_(JT.inbox, JT_HEADERS);

  sh.getRange(1, 1, 1, JT_HEADERS.length)

    .setValues([JT_HEADERS]);

  sh.getRange('H2:H2000').setDataValidation(

    SpreadsheetApp.newDataValidation()

      .requireValueInList(

        ['NEW', 'REVIEWED', 'IGNORE'],

        true

      )

      .build()

  );

  return sh;

}

// =====================================================

// EMAIL HELPERS

// =====================================================

function jtEmail_(from) {

  const s = String(from || '');

  const m = s.match(/<([^>]+)>/);

  return (m ? m[1] : s)

    .trim()

    .toLowerCase();

}

function jtOwn_(msg) {

  const from = jtEmail_(msg.getFrom());

  return (

    JT.owners.indexOf(from) >= 0 ||

    from === (

      Session.getEffectiveUser().getEmail() || ''

    ).toLowerCase()

  );

}

// =====================================================

// EMAIL EVENT CLASSIFICATION

// =====================================================

function jtType_(subject, body, from) {

  const s = String(subject || '');

  const b = String(body || '').slice(0, 9000);

  const opening = b.split(

    /(?:On .{5,120}wrote:|From:|-----Original Message-----|בתאריך .{4,120}כתב)/i

  )[0].slice(0, 6000);

  const t = (s + '\n' + opening)

    .replace(/\s+/g, ' ')

    .replace(/[’‘`]/g, "'");

  // Ignore job alerts and irrelevant notifications.

  if (

    /job alert|recommended jobs|new jobs for you|unsubscribe|weekly digest|hiring trends|interview questions|הצעות עבודה עבורך|הגשת לחברה/i.test(s)

  ) {

    return null;

  }

  // Preserve existing filtering of third-party job notifications.

  if (

    /linkedin\.com|hiremetech|jobmaster/i.test(jtEmail_(from)) &&

    !/application (was )?sent|application submitted|application received/i.test(s)

  ) {

    return null;

  }

  // Rejection always takes priority over application confirmation.

  const rejectionPatterns = [

    /decided\s+to\s+move\s+forward\s+with\s+other\s+candidates/i,

    /decided\s+not\s+to\s+(?:move|proceed)\s+forward/i,

    /(?:will\s+not|won't)\s+be\s+moving\s+forward/i,

    /(?:not\s+moving|not\s+proceeding)\s+forward\s+with\s+your\s+application/i,

    /(?:unfortunately|regret\s+to\s+inform)[\s\S]{0,500}(?:not\s+selected|other\s+candidates|not\s+moving|unable\s+to|decided\s+not\s+to)/i,

    /(?:after\s+(?:careful\s+)?(?:review|consideration)|following\s+(?:careful\s+)?review)[\s\S]{0,500}(?:other\s+candidates|not\s+selected|not\s+moving|unable\s+to|decided\s+not\s+to)/i,

    /(?:not\s+selected|unsuccessful\s+application)/i,

    // Additional rejection patterns:

    /(?:chosen|decided|opted)\s+to\s+(?:pursue|proceed\s+with|move\s+forward\s+with)\s+other\s+(?:applicants|candidates)/i,

    /(?:pursue|proceed\s+with)\s+other\s+(?:applicants|candidates)/i,

    /(?:החלטנו\s+להתקדם\s+עם\s+מועמדים\s+אחרים|החלטנו\s+שלא\s+להתקדם|לא\s+נוכל\s+להמשיך\s+בתהליך|מועמדותך\s+לא\s+התקבלה)/i

  ];

  if (rejectionPatterns.some(pattern => pattern.test(t))) {

    return 'REJECTION';

  }
  // Position closed or filled — requires manual review.
if (
  /(?:role|position|vacancy|job)\s+(?:has\s+been\s+|is\s+|was\s+)?filled/i.test(t) ||
  /(?:role|position|job)\s+(?:is\s+|was\s+)?no\s+longer\s+available/i.test(t) ||
  /no\s+longer\s+accept(?:ing)?\s+applications/i.test(t)
) {
  return 'STATUS UPDATE — REVIEW';
}

  // Interview invitations.

  if (

    /invite\s+(?:you\s+)?to\s+(?:an?\s+)?interview|interview\s+invitation|schedule\s+(?:an?\s+|your\s+)?interview|interview\s+with\s+(?:our|the)\s+team|הזמנה\s+לראיון|לתאם\s+(?:איתך\s+)?ראיון/i.test(t)

  ) {

    return 'INTERVIEW';

  }

  // Technical assessments.

  if (

    /coding\s+challenge|technical\s+(?:assignment|assessment)|online\s+assessment|complete\s+(?:the|your|an)\s+assessment|assessment\s+invitation|מבחן\s+בית|מטלת\s+בית|מבדק\s+מקצועי/i.test(t)

  ) {

    return 'ASSESSMENT';

  }

  // Status updates requiring manual review.

  if (

    /information\s+regarding\s+your\s+application|an\s+update\s+on|application:\s*status\s+update|your\s+interest\s+in\s+texas\s+instruments/i.test(s)

  ) {

    return 'STATUS UPDATE — REVIEW';

  }

  // Application confirmations.

  if (

    /thank\s+you\s+for\s+applying|thanks\s+for\s+applying|application\s+received|we\s+(?:have\s+)?received\s+your\s+application|your\s+application\s+(?:to|for)|application\s+submitted|תודה\s+על\s+הגשת\s+מועמדות|מועמדותך\s+התקבלה/i.test(s + ' ' + opening)

  ) {

    return 'APPLICATION';

  }

  // Other recruitment-related replies.

  if (

    /(application|candidate|position|role|recruit|hiring|מועמדות|גיוס|קורות חיים|ראיון)/i.test(s) &&

    /update|regarding|following up|next steps|בהמשך|עדכון|בנוגע|תשובה/i.test(t.slice(0, 1700))

  ) {

    return 'REPLY / OTHER';

  }

  return null;

}
// =====================================================

// COMPANY DETECTION

// =====================================================

function jtCompany_(subject, from, body) {

  const header = subject + ' ' + from;

  for (const c of JT_COMPANIES) {

    const escaped = c.replace(

      /[.*+?^${}()|[\]\\]/g,

      '\\$&'

    );

    if (

      new RegExp(

        '(^|[^a-z])' + escaped + '([^a-z]|$)',

        'i'

      ).test(header)

    ) {

      return c;

    }

  }

  const email = jtEmail_(from);

  // Illustrative sender-domain maps. Configure vetted company aliases
  // locally as needed; do not commit real personal recruiting history.
  const domains = {
    'recruitment.example.test': 'Example Co'
  };
  const reliable = {};

  for (const marker in reliable) {

    if (email.includes(marker)) {

      return reliable[marker];

    }

  }

  for (const domain in domains) {

    if (

      email.endsWith('@' + domain) &&

      domains[domain]

    ) {

      return domains[domain];

    }

  }

  const m = subject.match(

    /(?:position at|applying to|application to|application at|בחברת)\s+([A-Z][\w&.-]{2,35})\b/i

  );

  if (

    m &&

    !/^(the|for|applying|software|student|position)$/i.test(m[1])

  ) {

    return m[1];

  }

  return '';

}

// =====================================================

// ROLE DETECTION

// =====================================================

function jtRole_(subject, company) {

  const s = String(subject || '')

    .replace(/^\s*(re:|fw:|fwd:)\s*/ig, '')

    .trim();

  const patterns = [

    /applying for (?:the )?(.+?) (?:position )?(?:at|@)\s/i,

    /application for (.+?)(?:\s+\d{5,}|$)/i,

    /application to (.+?)\s+-\s+Example Co/i,

    /applying for (.+?) position/i,

    /update on (.+?) (?:position|role)/i,

    /application confirmation\s*\|\s*(.+)$/i,

    /thanks for applying for\s*(.+?)\s*(?:position|role)?\s*(?:at|@)\s*[A-Z]/i,

    /application to (.+?) - Example Co/i,

    /an update on (.+?) (?:JR\d+|$)/i,

    /we got it:?\s*thanks for applying for (.+)$/i,

    /your interest in Texas Instruments\s*-\s*(.+)$/i

  ];

  for (const re of patterns) {

    const m = s.match(re);

    if (m && m[1]) {

      const value = m[1]

        .replace(/\s+(?:position|role)\s*$/i, '')

        .trim()

        .slice(0, 150);

      if (

        value.length >= 5 &&

        !/^(the|applying|interest in|software technologies)$/i.test(value)

      ) {

        return value;

      }

    }

  }

  return '';

}

// =====================================================

// MASTER MATCHING

// =====================================================

function jtMasterRows_() {

  const sh = jtBook_().getSheetByName(JT.master);

  if (!sh) {

    throw new Error('Master Tracker missing');

  }

  return sh.getLastRow() < 2

    ? []

    : sh.getRange(

        2, 1, sh.getLastRow() - 1, 9

      ).getDisplayValues();

}

function jtMasterMatch_(company, role, rows) {

  if (!company) return 'NEEDS REVIEW';

  const matches = rows.filter(function(r) {

    return r[0].trim().toLowerCase() ===

           company.toLowerCase();

  });

  if (!matches.length) return 'NEW COMPANY';

  const words = role.toLowerCase()

    .replace(/[^a-z0-9 ]/g, ' ')

    .split(/\s+/)

    .filter(function(x) {

      return (

        x.length >= 5 &&

        !/^(application|position|thank|thanks|applying|received|interest|update)$/.test(x)

      );

    });

  const exact = matches.filter(function(r) {

    return words.filter(function(w) {

      return r[1].toLowerCase().includes(w);

    }).length >= 2;

  });

  return exact.length === 1

    ? 'POSSIBLE SAME ROLE'

    : matches.length > 1

      ? 'MULTIPLE ROLES — REVIEW'

      : 'COMPANY FOUND — CHECK ROLE';

}

// =====================================================

// GMAIL COLLECTION

// =====================================================

function jtExistingIds_(inboxSheet) {
  // Read-only deduplication across both intake and linked evidence.
  const ids = new Set();

  function addIds_(sheet) {
    if (!sheet || sheet.getLastRow() < 2) return;
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getDisplayValues();
    values.forEach(function(row) {
      const id = String(row[0] || '').trim();
      if (id) ids.add(id);
    });
  }

  addIds_(inboxSheet);                        // Existing Review Inbox messages
  addIds_(jtBook_().getSheetByName(JT.links)); // Already linked evidence
  return ids;
}

function jtCollect_(preview) {

  const existing = preview

    ? new Set()

    : jtExistingIds_(jtInbox_());

  const master = jtMasterRows_();

  const threads = GmailApp.search(

    'newer_than:' + JT.days + 'd -in:trash -in:spam',

    0,

    JT.maxThreads

  );

  const rows = [];

  threads.forEach(function(th) {

    th.getMessages().forEach(function(msg) {

      if (

        existing.has(msg.getId()) ||

        jtOwn_(msg)

      ) {

        return;

      }

      const subject = msg.getSubject() || '';

      const from = msg.getFrom() || '';

      const body = msg.getPlainBody() || '';

      const type = jtType_(subject, body, from);

      if (!type) return;

      const company = jtCompany_(

        subject,

        from,

        body

      );

      // Improved job title extraction.

      const extracted = jtExtractJobTitle_(subject, body);

      const role = extracted.confidence === 'HIGH'

        ? extracted.title

        : jtRole_(subject, company);

      // Preserve existing Master matching logic.

      const masterMatch = jtMasterMatch_(

        company,

        role,

        master

      );

      const missingRole =

        type === 'APPLICATION' && !role;

      const confidence = !company

        ? 'LOW — UNKNOWN COMPANY'

        : missingRole

          ? 'MISSING ROLE — MANUAL ENTRY'

          : 'REVIEW REQUIRED';

      const action =

        type === 'STATUS UPDATE — REVIEW'

          ? 'Read email; manually determine whether rejection, interview, or other update'

          : type === 'REJECTION'

            ? 'Verify rejection and update Master manually'

            : type === 'INTERVIEW'

              ? 'Respond / coordinate interview'

              : type === 'ASSESSMENT'

                ? 'Check assessment deadline'

                : type === 'APPLICATION'

                  ? 'Verify exact role / add application manually'

                  : 'Read recruiter response';

      rows.push([

        msg.getId(),

        msg.getDate(),

        company,

        role,

        type,

        from,

        subject,

        'NEW',

        missingRole

          ? 'MISSING ROLE — FILL MANUALLY in column D; do not mark REVIEWED until completed'

          : action,

        'https://mail.google.com/mail/u/0/#all/' +

          th.getId(),

        new Date(),

        masterMatch,

        confidence,

        missingRole ? 'YES' : 'NO'

      ]);

    });

  });

  rows.sort(function(a, b) {

    return a[1] - b[1];

  });

  return rows;

}

// =====================================================

// PREVIEW AND SCAN

// =====================================================

function runPreview() {

  const rows = jtCollect_(true);

  Logger.log(

    'PREVIEW ONLY; ' +

    rows.length +

    ' candidate emails; no spreadsheet changes.'

  );

  rows.slice(-40).forEach(function(r) {

    Logger.log(

      r[4] + ' | ' +

      (r[2] || '?') + ' | ' +

      r[6] + ' | ' +

      r[11]

    );

  });

}

function scanApplications() {

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) return;

  try {

    const sh = jtInbox_();

    const rows = jtCollect_(false);

    if (rows.length) {

      sh.getRange(

        sh.getLastRow() + 1,

        1,

        rows.length,

        JT_HEADERS.length

      ).setValues(rows);

    }

    sh.getRange('B2:B2000')

      .setNumberFormat('yyyy-mm-dd hh:mm');

    sh.getRange('K2:K2000')

      .setNumberFormat('yyyy-mm-dd hh:mm');

    jtDashboard_();

    Logger.log(

      'Added ' +

      rows.length +

      ' emails to Review Inbox. Master Tracker untouched.'

    );

  } finally {

    lock.releaseLock();

  }

}

// =====================================================

// DASHBOARD

// =====================================================

function jtDashboard_() {

  const sh = jtInbox_();

  const d = jtSheet_(JT.dashboard);

  const rows = sh.getLastRow() < 2

    ? []

    : sh.getRange(

        2,

        1,

        sh.getLastRow() - 1,

        JT_HEADERS.length

      ).getValues();

  const pending = rows

    .filter(function(r) {

      return r[7] === 'NEW';

    })

    .sort(function(a, b) {

      return new Date(b[1]) - new Date(a[1]);

    });

  const responses = pending.filter(function(r) {

    return [

      'REJECTION',

      'INTERVIEW',

      'ASSESSMENT',

      'REPLY / OTHER',

      'STATUS UPDATE — REVIEW'

    ].includes(r[4]);

  });

  const missing = pending.filter(function(r) {

    return (

      r[4] === 'APPLICATION' &&

      !String(r[3] || '').trim()

    );

  });

  d.clear();

  d.getRange('A1')

    .setValue('JOB APPLICATIONS — ACTION CENTER')

    .setFontSize(16)

    .setFontWeight('bold');

  const last = PropertiesService

    .getScriptProperties()

    .getProperty('JT_LAST_REVIEWED');
      const allHandled = rows.length > 0 && rows.every(function(row) {
    return row[7] === 'REVIEWED' || row[7] === 'IGNORE';
  });
  const reviewDisplay = last
    ? new Date(last)
    : (allHandled
      ? 'All inbox items handled — review time not recorded'
      : 'Review time not recorded');

  d.getRange('A3:B8').setValues([

    [

      'Last recorded review',

      reviewDisplay

    ],

    [

      'NEW emails needing review',

      pending.length

    ],

    [

      'NEW replies / interviews / assessments / rejections',

      responses.length

    ],

    [

      'MISSING JOB TITLE — fill manually',

      missing.length

    ],

    [

      'Review instructions',

      'Open Review Inbox and Gmail links; mark reviewed once you finish'

    ],

    [

      'Safety',

      'Master Tracker remains unchanged — update it after verifying an email'

    ]

  ]);

  d.getRange('B3')

    .setNumberFormat('yyyy-mm-dd hh:mm');

  d.getRange('A10:G10').setValues([[

    'Received',

    'Company',

    'Event',

    'Role missing?',

    'Suggested action',

    'Gmail link',

    'Master match'

  ]])

    .setFontWeight('bold')

    .setBackground('#dce9f6');

  const top = pending.slice(0, 100).map(function(r) {

    return [

      r[1],

      r[2],

      r[4],

      r[4] === 'APPLICATION' &&

      !String(r[3] || '').trim()

        ? 'YES'

        : 'NO',

      r[8],

      r[9],

      r[11]

    ];

  });

  if (top.length) {

    d.getRange(

      11, 1, top.length, 7

    ).setValues(top);

  }

  d.getRange('A11:A110')

    .setNumberFormat('yyyy-mm-dd hh:mm');

  d.setFrozenRows(1);

  d.autoResizeColumns(1, 7);

  if (missing.length) {

    d.getRange('B6')

      .setBackground('#fce8e6');

  }

}

function refreshDashboard() {

  jtDashboard_();

}

// =====================================================

// REVIEW STATUS

// =====================================================

function markReviewed() {
  // Disabled: bulk-clearing NEW messages can hide unreviewed events.
  // Review each email in Approval Center > Action Queue instead.
  throw new Error(
    'Bulk review is disabled for safety. Use Approval Center > Action Queue.'
  );
}

// =====================================================

// DAILY SUMMARY

// =====================================================

function dailyMissingRoleSummary() {

  const sh = jtInbox_();

  if (sh.getLastRow() < 2) return;

  const rows = sh.getRange(

    2, 1, sh.getLastRow() - 1, JT_HEADERS.length

  ).getValues();

  const missing = rows.filter(function(r) {

    return (

      r[7] === 'NEW' &&

      r[4] === 'APPLICATION' &&

      !String(r[3] || '').trim()

    );

  });

  if (!missing.length) return;

  const url =

    'https://docs.google.com/spreadsheets/d/' +

    JT.id +

    '/edit';

  const lines = missing.slice(0, 30).map(function(r) {

    return (

      '- ' +

      (r[2] || 'Unknown company') +

      ' | ' +

      Utilities.formatDate(

        new Date(r[1]),

        'Asia/Jerusalem',

        'yyyy-MM-dd'

      ) +

      ' | ' +

      r[9]

    );

  });

  const body =

    'יש ' +

    missing.length +

    ' הגשות ללא שם משרה. יש לפתוח Review Inbox ולהשלים את עמודה D, ואז לסמן REVIEWED.\n\n' +

    lines.join('\n') +

    '\n\n' +

    url;

  MailApp.sendEmail(

    JT.owners[0],

    'Job Tracker: ' +

    missing.length +

    ' job titles to complete',

    body

  );

}

// =====================================================

// AUTOMATION TRIGGERS

// =====================================================

function installAutomation() {

  const triggers = ScriptApp.getProjectTriggers();

  triggers

    .filter(function(t) {

      return [

        'scanApplications',

        'dailyMissingRoleSummary'

      ].includes(t.getHandlerFunction());

    })

    .forEach(function(t) {

      ScriptApp.deleteTrigger(t);

    });

  ScriptApp.newTrigger('scanApplications')

    .timeBased()

    .everyHours(1)

    .create();

  ScriptApp.newTrigger('dailyMissingRoleSummary')

    .timeBased()

    .everyDays(1)

    .atHour(18)

    .inTimezone('Asia/Jerusalem')

    .create();

  scanApplications();

  SpreadsheetApp.getUi().alert(

    'Hourly scan and daily missing-title summary installed.'

  );

}

function installHourlyTrigger() {

  ScriptApp.getProjectTriggers()

    .filter(function(t) {

      return t.getHandlerFunction() ===

             'scanApplications';

    })

    .forEach(function(t) {

      ScriptApp.deleteTrigger(t);

    });

  ScriptApp.newTrigger('scanApplications')

    .timeBased()

    .everyHours(1)

    .create();

  scanApplications();

  SpreadsheetApp.getUi().alert(

    'Hourly scan enabled.'

  );

}

// =====================================================

// PUSHOVER TEST

// =====================================================

function testPushover() {

  const props = PropertiesService

    .getScriptProperties();

  const user = props.getProperty(

    'PUSHOVER_USER_KEY'

  );

  const token = props.getProperty(

    'PUSHOVER_API_TOKEN'

  );

  if (!user || !token) {

    throw new Error(

      'Missing Pushover credentials'

    );

  }

  const response = UrlFetchApp.fetch(

    'https://api.pushover.net/1/messages.json',

    {

      method: 'post',

      payload: {

        token: token,

        user: user,

        title: 'Job Tracker',

        message: 'החיבור הצליח! ההתראות פועלות.',

        priority: '0'

      },

      muteHttpExceptions: true

    }

  );

  const result = JSON.parse(

    response.getContentText()

  );

  if (result.status !== 1) {

    throw new Error(

      'Pushover error: ' +

      response.getContentText()

    );

  }

  Logger.log(

    'Pushover notification sent successfully'

  );

}

// =====================================================

// WEB APP

// =====================================================

function doGet(e) {

  return HtmlService

    .createHtmlOutputFromFile('ApprovalPage')

    .setTitle('Job Tracker – Approval Center');

}

// =====================================================

// PENDING APPROVALS

// =====================================================

function getPendingApprovals() {

  const sh = jtBook_()

    .getSheetByName(JT.inbox);

  if (!sh || sh.getLastRow() < 2) {

    return [];

  }

  const rows = sh.getRange(

    2, 1, sh.getLastRow() - 1, 14

  ).getValues();

  return rows

    .filter(function(row) {

      return row[7] === 'NEW';

    })

    .map(function(row) {

      return {

        messageId: String(row[0]),

        company: String(

          row[2] || 'Unknown'

        ),

        role: String(

          row[3] || 'Not identified'

        ),

        event: String(

          row[4] || ''

        ),

        suggestedAction: String(

          row[8] || ''

        ),

        gmailLink: String(

          row[9] || ''

        )

      };

    });

}

// =====================================================

// ROLE EXTRACTION FROM SUBJECT

// =====================================================

function jtExtractRoleFromSubject_(subject) {

  const s = String(subject || '')

    .trim()

    .replace(

      /\bthe(?=[A-Z][a-z])/g,

      'the '

    );

  const patterns = [

    /information regarding your application to the (.+?) position at/i,

    /thanks for applying to the\s*(.+?) position at/i,

    /thank you for applying for the (.+?) position at/i,

    /thanks for applying for (.+?) position/i,

    /application to (.+?) position/i,

    /an update on (.+?) JR\d+/i,

    /your application for (.+?) \d{5,}/i,

    /applying for (.+?) position/i,

    /exampleco-\s*(.+)$/i

  ];

  for (const pattern of patterns) {

    const match = s.match(pattern);

    if (match && match[1]) {

      const role = match[1]

        .replace(/\s+position$/i, '')

        .trim();

      if (

        role.length >= 5 &&

        !/^(the|position|unknown)$/i.test(role)

      ) {

        return role;

      }

    }

  }

  return '';

}

// =====================================================

// GET EXISTING APPLICATIONS

// =====================================================

function getExistingApplications() {

  const sh = jtBook_()

    .getSheetByName(JT.master);

  if (!sh || sh.getLastRow() < 2) {

    return [];

  }

  const rows = sh.getRange(

    2, 1, sh.getLastRow() - 1, 10

  ).getDisplayValues();

  return rows

    .map(function(row, index) {

      return {

        rowNumber: index + 2,

        company: String(

          row[0] || ''

        ).trim(),

        role: String(

          row[1] || ''

        ).trim(),

        jobId: String(

          row[2] || ''

        ).trim(),

        applicationId: String(

          row[9] || ''

        ).trim()

      };

    })

    .filter(function(item) {

      return (

        item.company !== '' &&

        item.role !== '' &&

        item.applicationId.startsWith('APP-')

      );

    });

}

// =====================================================

// GROUPED APPROVALS

// =====================================================

function getGroupedApprovals() {

  const ss = jtBook_();

  const inbox = ss.getSheetByName(JT.inbox);

  const links = ss.getSheetByName(JT.links);

  const master = ss.getSheetByName(JT.master);

  if (!inbox || inbox.getLastRow() < 2) {

    return [];

  }

  if (!links || !master) {

    throw new Error('Required sheet is missing.');

  }

  const rows = inbox.getRange(

    2, 1, inbox.getLastRow() - 1, 14

  ).getValues();

  const masterRows = master.getLastRow() > 1

    ? master.getRange(

        2, 1, master.getLastRow() - 1, 10

      ).getDisplayValues()

    : [];

  const applications = {};

  masterRows.forEach(function(row) {

    const appId = String(

      row[9] || ''

    ).trim();

    if (!appId) return;

    if (applications[appId]) {

      throw new Error(

        'Duplicate Application ID: ' + appId

      );

    }

    applications[appId] = {

      company: String(

        row[0] || ''

      ).trim(),

      role: String(

        row[1] || ''

      ).trim()

    };

  });

  const linkedRows = links.getLastRow() > 1

    ? links.getRange(

        2, 1, links.getLastRow() - 1, 7

      ).getDisplayValues()

    : [];

  const emailLinks = {};

  linkedRows.forEach(function(row) {

    const messageId = String(

      row[0] || ''

    ).trim();

    const appId = String(

      row[6] || ''

    ).trim();

    if (!messageId) return;

    if (emailLinks[messageId]) {

      throw new Error(

        'Duplicate email link: ' + messageId

      );

    }

    if (!appId || !applications[appId]) {

      throw new Error(

        'Email link has an invalid Application ID: ' +

        messageId

      );

    }

    emailLinks[messageId] = appId;

  });

  const groups = {};

  function normalizeRole(role) {

    return String(role || '')

      .toLowerCase()

      .replace(/\bposition\b/g, '')

      .replace(/\brole\b/g, '')

      .replace(

        /[^a-z0-9\u0590-\u05ff]+/g,

        ' '

      )

      .replace(/\s+/g, ' ')

      .trim();

  }

  rows.forEach(function(row) {

    if (row[7] !== 'NEW') return;

    const originalCompany = String(

      row[2] || ''

    ).trim();

    const originalRole = String(

      row[3] || ''

    ).trim();

    const subject = String(

      row[6] || ''

    ).trim();

    const messageId = String(

      row[0] || ''

    ).trim();

    const linkedAppId =

      emailLinks[messageId] || '';

    let company = originalCompany;

    let role = originalRole;

    let needsReview = false;

    if (linkedAppId) {

      const application =

        applications[linkedAppId];

      company = application.company;

      role = application.role;

    } else {

      const invalidRoles = [

        '',

        'not identified',

        'position',

        'unknown'

      ];

      if (

        invalidRoles.includes(

          role.toLowerCase()

        )

      ) {

        role = jtExtractRoleFromSubject_(

          subject

        );

      }

      needsReview =

        !company ||

        company.toLowerCase() === 'unknown' ||

        !role ||

        invalidRoles.includes(

          role.toLowerCase()

        );

    }

    const key = linkedAppId

      ? 'application|' + linkedAppId

      : !needsReview

        ? 'detected|' +

          company.toLowerCase() +

          '|' +

          normalizeRole(role)

        : 'unmatched|' + messageId;

    if (!groups[key]) {

      groups[key] = {

        company: company || 'Unknown',

        role: role || 'Not identified',

        applicationId: linkedAppId,

        needsReview: needsReview,

        linked: Boolean(linkedAppId),

        events: [],

        latestEvent: '',

        latestDate: '',

        emails: []

      };

    }

    const timestamp = new Date(

      row[1]

    ).getTime();

    if (!Number.isFinite(timestamp)) {

      throw new Error(

        'Invalid email date: ' +

        messageId

      );

    }

    const event = {

      messageId: messageId,

      date: timestamp,

      type: String(

        row[4] || ''

      ),

      subject: subject,

      gmailLink: String(

        row[9] || ''

      ),

      linked: Boolean(linkedAppId)

    };

    groups[key].events.push(event);

    groups[key].emails.push({

      subject: subject,

      link: event.gmailLink,

      date: timestamp

    });

  });

  return Object.values(groups)

    .map(function(group) {

      group.events.sort(function(a, b) {

        return b.date - a.date;

      });

      group.emails.sort(function(a, b) {

        return b.date - a.date;

      });

      group.latestEvent =

        group.events[0].type;

      group.latestDate = new Date(

        group.events[0].date

      ).toISOString();

      return group;

    })

    .sort(function(a, b) {

      return (

        new Date(b.latestDate) -

        new Date(a.latestDate)

      );

    });

}

// =====================================================

// SAVE EMAIL LINK BY APPLICATION ID

// =====================================================

function saveEmailLink(messageId, applicationId) {

  const id = String(

    messageId || ''

  ).trim();

  const appId = String(

    applicationId || ''

  ).trim();

  if (

    !id ||

    !/^APP-[0-9a-f-]{36}$/i.test(appId)

  ) {

    throw new Error(

      'Invalid email or Application ID.'

    );

  }

  const lock = LockService.getScriptLock();

  lock.waitLock(10000);

  try {

    const ss = jtBook_();

    const master = ss.getSheetByName(

      JT.master

    );

    const inbox = ss.getSheetByName(

      JT.inbox

    );

    const links = ss.getSheetByName(

      JT.links

    );

    if (

      !master ||

      !inbox ||

      !links

    ) {

      throw new Error(

        'Required sheet is missing.'

      );

    }

    if (

      master.getRange('J1')

        .getDisplayValue()

        .trim() !== 'Application ID' ||

      links.getRange('G1')

        .getDisplayValue()

        .trim() !== 'Application ID'

    ) {

      throw new Error(

        'Application ID headers are missing.'

      );

    }

    if (master.getLastRow() < 2) {

      throw new Error(

        'Master Tracker is empty.'

      );

    }

    const masterRows = master.getRange(

      2, 1, master.getLastRow() - 1, 10

    ).getDisplayValues();

    const matches = [];

    masterRows.forEach(function(row, index) {

      if (

        String(row[9] || '').trim() ===

        appId

      ) {

        matches.push({

          rowNumber: index + 2,

          company: String(

            row[0] || ''

          ).trim(),

          role: String(

            row[1] || ''

          ).trim()

        });

      }

    });

    if (matches.length !== 1) {

      throw new Error(

        'Application ID is missing or duplicated in Master Tracker.'

      );

    }

    const selected = matches[0];

    if (

      !selected.company ||

      !selected.role

    ) {

      throw new Error(

        'Selected application is incomplete.'

      );

    }

    const inboxRows =

      inbox.getLastRow() > 1

        ? inbox.getRange(

            2, 1,

            inbox.getLastRow() - 1,

            8

          ).getValues()

        : [];

    const matchingEmails =

      inboxRows.filter(function(row) {

        return (

          String(row[0] || '').trim() ===

          id

        );

      });

    if (matchingEmails.length !== 1) {

      throw new Error(

        'Email is missing or duplicated in Review Inbox.'

      );

    }

    const email = matchingEmails[0];

    if (email[7] !== 'NEW') {

      throw new Error(

        'Email is no longer pending review.'

      );

    }

    const emailCompany = String(

      email[2] || ''

    ).trim();

    if (

      emailCompany &&

      emailCompany.toLowerCase() !== 'unknown' &&

      emailCompany.toLowerCase() !==

        selected.company.toLowerCase()

    ) {

      throw new Error(

        'Company mismatch. Link was not saved.'

      );

    }

    const existing =

      links.getLastRow() > 1

        ? links.getRange(

            2, 1,

            links.getLastRow() - 1,

            7

          ).getDisplayValues()

        : [];

    const previous = existing.filter(

      function(row) {

        return (

          String(row[0] || '').trim() ===

          id

        );

      }

    );

    if (previous.length > 0) {

      const alreadyLinkedToSameApplication =

        previous.length === 1 &&

        String(

          previous[0][6] || ''

        ).trim() === appId;

      if (

        alreadyLinkedToSameApplication

      ) {

        return (

          'This email is already linked to this application.'

        );

      }

      throw new Error(

        'This email is already linked or has conflicting links.'

      );

    }

    // Only Email Links is modified.

    links.appendRow([

      id,

      selected.rowNumber,

      selected.company,

      selected.role,

      new Date(),

      Session.getEffectiveUser()

        .getEmail(),

      appId

    ]);

    return (

      'Email linked successfully. Master Tracker was not changed.'

    );

  } finally {

    lock.releaseLock();

  }

}

// =====================================================

// ASSIGN APPLICATION IDS (ONE-TIME / IDEMPOTENT)

// =====================================================

function assignApplicationIds() {

  const ss = jtBook_();

  const sh = ss.getSheetByName(

    JT.master

  );

  if (!sh) {

    throw new Error(

      'Master Tracker sheet not found.'

    );

  }

  if (

    sh.getRange('J1')

      .getDisplayValue()

      .trim() !== 'Application ID'

  ) {

    throw new Error(

      'Column J must be named Application ID.'

    );

  }

  const lastRow = sh.getLastRow();

  if (lastRow < 2) {

    return 'No applications found.';

  }

  const companies = sh.getRange(

    2, 1, lastRow - 1, 1

  ).getDisplayValues();

  const ids = sh.getRange(

    2, 10, lastRow - 1, 1

  ).getDisplayValues();

  const existingIds = new Set();

  ids.forEach(function(row) {

    const id = String(

      row[0] || ''

    ).trim();

    if (id) {

      if (

        existingIds.has(id)

      ) {

        throw new Error(

          'Duplicate Application ID found: ' +

          id

        );

      }

      existingIds.add(id);

    }

  });

  let created = 0;

  for (

    let i = 0;

    i < ids.length;

    i++

  ) {

    const company = String(

      companies[i][0] || ''

    ).trim();

    const currentId = String(

      ids[i][0] || ''

    ).trim();

    if (

      !company ||

      currentId

    ) {

      continue;

    }

    let newId;

    do {

      newId =

        'APP-' +

        Utilities.getUuid();

    } while (

      existingIds.has(newId)

    );

    sh.getRange(

      i + 2, 10

    ).setValue(newId);

    existingIds.add(newId);

    created++;

  }

  return (

    'Created ' +

    created +

    ' Application IDs.'

  );

}

// =====================================================

// MIGRATE EXISTING EMAIL LINKS

// =====================================================

function migrateEmailLinksToApplicationIds() {

  const ss = jtBook_();

  const master = ss.getSheetByName(

    JT.master

  );

  const links = ss.getSheetByName(

    JT.links

  );

  if (

    !master ||

    !links

  ) {

    throw new Error(

      'Required sheet is missing.'

    );

  }

  if (

    master.getRange('J1')

      .getDisplayValue()

      .trim() !== 'Application ID' ||

    links.getRange('G1')

      .getDisplayValue()

      .trim() !== 'Application ID'

  ) {

    throw new Error(

      'Application ID headers are missing.'

    );

  }

  const lastRow = links.getLastRow();

  if (lastRow < 2) {

    return (

      'No existing email links to migrate.'

    );

  }

  const records = links.getRange(

    2, 1, lastRow - 1, 7

  ).getDisplayValues();

  const updates = [];

  records.forEach(function(record, index) {

    const sheetRow = index + 2;

    const messageId = String(

      record[0] || ''

    ).trim();

    const masterRow = Number(

      record[1]

    );

    const linkedCompany = String(

      record[2] || ''

    ).trim();

    const linkedRole = String(

      record[3] || ''

    ).trim();

    const existingId = String(

      record[6] || ''

    ).trim();

    if (

      !messageId ||

      existingId

    ) {

      return;

    }

    if (

      !Number.isInteger(masterRow) ||

      masterRow < 2 ||

      masterRow > master.getLastRow()

    ) {

      throw new Error(

        'Invalid Master Row in Email Links row ' +

        sheetRow

      );

    }

    const application = master.getRange(

      masterRow, 1, 1, 10

    ).getDisplayValues()[0];

    const company = String(

      application[0] || ''

    ).trim();

    const role = String(

      application[1] || ''

    ).trim();

    const applicationId = String(

      application[9] || ''

    ).trim();

    if (

      company.toLowerCase() !==

        linkedCompany.toLowerCase() ||

      role !== linkedRole ||

      !applicationId.startsWith('APP-')

    ) {

      throw new Error(

        'Application mismatch in Email Links row ' +

        sheetRow +

        '. No changes were made.'

      );

    }

    updates.push({

      row: sheetRow,

      id: applicationId

    });

  });

  updates.forEach(function(update) {

    links.getRange(

      update.row, 7

    ).setValue(update.id);

  });

  return (

    'Migrated ' +

    updates.length +

    ' email links.'

  );

}
/** Read-only classifier regression check using synthetic messages only. */
function jtTestClosedEmailReadOnly() {
  const checks = [
    ['Position filled', 'Hiring update', 'The position has been filled.', 'STATUS UPDATE — REVIEW'],
    ['Personal rejection', 'Application update', 'We decided to move forward with other candidates.', 'REJECTION'],
    ['Application confirmation', 'Thanks for applying', 'We received your application.', 'APPLICATION']
  ];
  checks.forEach(function(test) {
    const actual = jtType_(test[1], test[2], 'recruiter@example.com');
    if (actual !== test[3]) throw new Error('Test failed: ' + test[0]);
    Logger.log('PASS | ' + test[0]);
  });
}

function jtMvpPatchSelfTestReadOnly() {
  const book = jtBook_();
  const inbox = book.getSheetByName(JT.inbox);
  const links = book.getSheetByName(JT.links);
  if (!inbox || !links) throw new Error('Required sheet missing');
  const known = jtExistingIds_(inbox);
  const linked = links.getLastRow() < 2 ? []
    : links.getRange(2, 1, links.getLastRow() - 1, 1).getDisplayValues()
      .map(function(row) { return String(row[0] || '').trim(); }).filter(Boolean);
  const missing = linked.filter(function(id) { return !known.has(id); });
  if (missing.length) throw new Error('Linked emails not excluded from rescan: ' + missing.length);
  Logger.log('PASS: all ' + linked.length + ' Email Links IDs are in the skip-set.');
  const values = inbox.getLastRow() < 2 ? []
    : inbox.getRange(2, 8, inbox.getLastRow() - 1, 1).getDisplayValues().flat();
  const open = values.filter(function(status) { return status === 'NEW'; }).length;
  Logger.log('Inbox: ' + values.length + ' rows, ' + open + ' new. No changes made.');
}