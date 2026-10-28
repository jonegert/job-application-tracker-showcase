const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScripts(files, extra = {}) {
  // Neither Gmail nor Sheets are accessed by these pure-function tests.
  const props = {
    getProperty: () => '',
    setProperty: () => undefined
  };
  const sandbox = {
    PropertiesService: { getScriptProperties: () => props },
    Logger: { log() {} },
    ...extra
  };
  vm.createContext(sandbox);
  for (const name of files) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
    vm.runInContext(source, sandbox, { filename: name });
  }
  return sandbox;
}

const app = loadScripts(['Code.gs', 'JobTrackerEngine.gs', 'JobOpportunities.gs']);

test('application confirmations are distinguished from rejections', () => {
  assert.equal(
    app.jtType_('Thank you for applying', 'We have received your application.', 'jobs@employer.example'),
    'APPLICATION'
  );
  assert.equal(
    app.jtType_('Update regarding your application', 'We decided to move forward with other candidates.', 'jobs@employer.example'),
    'REJECTION'
  );
});

test('filled positions are manual-review events, not individual rejections', () => {
  assert.equal(
    app.jtType_('Your application', 'This position has been filled.', 'jobs@employer.example'),
    'STATUS UPDATE — REVIEW'
  );
});

test('generic job alerts are not application confirmations', () => {
  assert.equal(
    app.jtType_('Job alert: jobs for you', 'We are hiring', 'jobs@example.test'),
    null
  );
});

test('company aliases are normalized consistently by the engine', () => {
  assert.equal(app.jtEngineCompanyKey_('Northstar Systems'), 'northstar');
  assert.equal(app.jtEngineCompanyKey_('Acme Labs'), 'acme');
});

test('unknown/generic job titles are rejected as matching evidence', () => {
  assert.equal(app.jtEngineRoleValid_('unknown'), false);
  assert.equal(app.jtEngineRoleValid_('role'), false);
  assert.equal(app.jtEngineRoleValid_('Software Engineer'), true);
});

test('token-based role similarity is order-independent', () => {
  assert.equal(
    app.jtEngineSimilarity_('Student Software Engineer', 'Engineer Software Student'),
    1
  );
  assert.equal(app.jtEngineSimilarity_('Data Analyst', 'Software Engineer'), 0);
});

test('exact job IDs match only within the same company', () => {
  assert.equal(app.jtOppIsSameJob_(
    'Sample Company', 'Engineer', 'REQ-101',
    'Sample Company', 'Analyst', 'REQ-101'
  ), true);
  assert.equal(app.jtOppIsSameJob_(
    'Sample Company', 'Engineer', 'REQ-101',
    'Other Company', 'Engineer', 'REQ-101'
  ), false);
});

test('different explicit job IDs do not match, even with the same title', () => {
  assert.equal(app.jtOppIsSameJob_(
    'Sample Company', 'Engineer', 'REQ-101',
    'Sample Company', 'Engineer', 'REQ-102'
  ), false);
});

function proofRow(evidence, overrides = {}) {
  const row = Array(15).fill('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  // The date utility mock below returns this same day.
  row[5] = 'https://jobs.example.test/role/123';
  row[6] = today;
  row[14] =
    'OPEN VERIFIED | checked ' + today +
    ' | Employer/ATS: jobs.example.test | Job ID: 123' +
    ' | Apply URL: https://jobs.example.test/role/123' +
    ' | Evidence: reached the application start form' +
    ' | Limitations: none | Report: ' + today;
  if (evidence !== undefined) row[14] = evidence;
  Object.entries(overrides).forEach(([index, value]) => { row[Number(index)] = value; });
  return row;
}

test('vacancy proof gate blocks evidence-free and untested roles', () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  app.Utilities = { formatDate: () => today };
  assert.equal(app.jtOppHasApplicationProof_(proofRow('')), false);
  const valid = proofRow();
  assert.equal(app.jtOppHasApplicationProof_(valid), true);
  const untested = valid.slice();
  untested[14] = untested[14].replace(
    'reached the application start form', 'saw listing but application form not tested'
  );
  assert.equal(app.jtOppHasApplicationProof_(untested), false);
});

test('vacancy proof gate rejects mismatched URLs', () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  app.Utilities = { formatDate: () => today };
  assert.equal(app.jtOppHasApplicationProof_(proofRow(undefined, {
    5: 'https://jobs.example.test/different-role'
  })), false);
});

test('reusable job-title extractor survives removal of one-off migration scripts', () => {
  const source = loadScripts(['JobTrackerSafety.gs']);
  const result = source.jtExtractJobTitle_(
    'Thank you for applying for Software Engineering Intern',
    'We received your application.'
  );
  assert.equal(result.title, 'Software Engineering Intern');
  assert.equal(result.confidence, 'HIGH');
});
