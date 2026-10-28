/**
 * Safe email inspection helpers and reusable job-title extraction.
 *
 * Only reusable, read-only helpers are included in the public source.
 * Individual-candidate history repair scripts were excluded entirely.
 * All writes require explicit approval through dedicated action modules.
 */

function jtClassifyMessageSafely_(messageId) {
  const id = String(messageId || '').trim();
  if (!id) throw new Error('Missing Gmail message ID');

  const msg = GmailApp.getMessageById(id);
  if (!msg) throw new Error('Gmail message not found: ' + id);

  // Single source of truth: Code.gs classifier.
  // In particular, a CLOSED/FILLED vacancy is NOT a candidate rejection.
  // Read-only; does not modify Gmail, Review Inbox, or Master Tracker.
  return jtType_(
    msg.getSubject() || '',
    msg.getPlainBody() || '',
    msg.getFrom() || ''
  ) || 'NEEDS REVIEW';
}

/**

 * Compare new classifications against Review Inbox.

 *

 * READ-ONLY.

 * Does not change spreadsheet data.

 */

function jtPreviewClassificationCorrections() {

  const sh = SpreadsheetApp

    .openById(JT.id)

    .getSheetByName(JT.inbox);

  if (!sh) {

    throw new Error('Review Inbox missing');

  }

  const n = sh.getLastRow() - 1;

  const rows = n > 0

    ? sh.getRange(2, 1, n, 14).getValues()

    : [];

  const changes = [];

  rows.forEach((r, i) => {

    const id = String(r[0] || '').trim();

    if (!id) return;

    try {

      const proposed = jtClassifyMessageSafely_(id);

      const current = String(r[4] || '').trim();

      if (proposed !== current) {

        changes.push({

          row: i + 2,

          messageId: id,

          current: current,

          proposed: proposed,

          subject: String(r[6] || '')

        });

      }

    } catch (err) {

      changes.push({

        row: i + 2,

        messageId: id,

        error: String(err)

      });

    }

  });

  Logger.log(JSON.stringify(changes, null, 2));

  return changes;

}

function jtExtractJobTitle_(subject, body) {

  function clean(value) {

    return String(value || '')

      .replace(/\s+/g, ' ')

      .trim();

  }

  const subjectText = clean(subject);

  const bodyText = clean(

    String(body || '')

      .split(

        /(?:On .{5,120}wrote:|-----Original Message-----|בתאריך .{4,120}כתב)/i

      )[0]

      .slice(0, 6000)

  );

  function isValidTitle(value) {

    const title = clean(value);

    const t = title.toLowerCase();

    if (title.length < 4 || title.length > 140) {

      return false;

    }

    const invalidPatterns = [

      /^for\b/,

      /^to\b/,

      /^a position\b/,

      /^the position\b/,

      /^this position\b/,

      /^your application\b/,

      /^our company\b/,

      /^the role\b/,

      /\bcareer opportunity\b/,

      /\bposition at\b/,

      /\bopportunity within\b/,

      /\bapplication for\b/,

      /\bapplying for\b/,

      /\bapplying to\b/,

      /^thanks for applying\b/,

      /^thank you for applying\b/

    ];

    return !invalidPatterns.some(pattern => pattern.test(t));

  }

  function extractJobId(text) {

    const explicit = text.match(

      /\b(?:job\s*(?:id|number|#)|requisition\s*(?:id|number|#))\s*[:#-]?\s*(\d{4,10})\b/i

    );

    if (explicit) {

      return explicit[1];

    }

    // ATS-style numeric identifier at the end of a subject.

    if (/^your application for\b/i.test(text)) {

      const trailing = text.match(/\s(\d{5,10})$/);

      if (trailing) {

        return trailing[1];

      }

    }

    return '';

  }

  const jobId = extractJobId(subjectText);

  const patterns = [

    // Comeet / Spark Hire

    {

      source: 'subject',

      regex: /^we got it:\s*thanks for applying for\s+(.+)$/i

    },

    // General confirmation subjects

    {

      source: 'subject',

      regex: /^(?:thanks|thank you) for applying for\s+(.+)$/i

    },

    // ATS-style

    {

      source: 'subject',

      regex: /application confirmation\s*\|\s*(.+)$/i

    },

    // ATS-style

    {

      source: 'subject',

      regex: /^your application for\s+(.+)$/i

    },

    // Existing supported subject patterns

    {

      source: 'subject',

      regex: /(?:thanks|thank you) for applying to the (.{4,140}?) position at\b/i

    },

    {

      source: 'subject',

      regex: /thank you for applying for .{2,60}?\s*[-–]\s*(.{4,140})$/i

    },

    // Existing body patterns

    {

      source: 'body',

      regex: /received your application for (?:our|the) (.{4,120}?) position\b/i

    },

    {

      source: 'body',

      regex: /interest in .{2,80}? and the (.{4,120}?) role\b/i

    },

    {

      source: 'body',

      regex: /application for (?:the|our) (.{4,120}?) position\b/i

    },

    {

      source: 'body',

      regex: /thank you for applying (?!for\b|to\b)(.{4,140}?)(?:\.|!|we(?:'|’)ve received)/i

    }

  ];

  for (const pattern of patterns) {

    const text = pattern.source === 'subject'

      ? subjectText

      : bodyText;

    const match = text.match(pattern.regex);

    if (!match) {

      continue;

    }

    let title = clean(match[1]);

    // Remove a trailing numeric job identifier.

    if (jobId) {

      title = title.replace(

        new RegExp('\\s+' + jobId + '$'),

        ''

      );

    }

    // Remove common email subject suffixes.

    title = title

      .replace(/\s+position\s+position\s*@.+$/i, ' Position')

      .replace(/\s+position\s*@.+$/i, '')

      .replace(/\s+@\s*[^@]+$/i, '')

      .replace(/[.,;:!?]+$/, '')

      .trim();

    if (!isValidTitle(title)) {

  continue;

}

// Reject text that looks like a sentence rather than a job title.

if (

  /\b(?:at this time|while this|unfortunately|we regret|your application|other candidates|other applicants)\b/i.test(title) ||

  /[.!?]\s+[A-Z]/.test(title)

) {

  continue;

}

    // Flag potentially incomplete titles.

    const potentiallyIncomplete =

      /\b(?:and|or|of|for|with|in|at|&)\s*$/i.test(title) ||

      /(?:fraud\s*&\s*anomaly)$/i.test(title);

    return {

      title: title,

      jobId: jobId,

      confidence: potentiallyIncomplete ? 'REVIEW' : 'HIGH',

      source: pattern.source,

      pattern: pattern.regex.source

    };

  }

  return {

    title: '',

    jobId: jobId,

    confidence: 'NONE',

    source: '',

    pattern: ''

  };

}
