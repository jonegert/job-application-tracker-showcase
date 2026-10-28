const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'src');

test('all Apps Script .gs source files parse as JavaScript', () => {
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.gs'));
  assert.ok(files.length >= 10, 'Expected all Apps Script source modules');
  for (const file of files) {
    const script = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.doesNotThrow(() => new vm.Script(script, { filename: file }), file);
  }
});

test('Approval Center inline scripts parse as JavaScript', () => {
  const html = fs.readFileSync(path.join(dir, 'ApprovalPage.html'), 'utf8');
  // Ignore HTML comments that merely *mention* a <script> tag.
  const uncommentedHtml = html.replace(/<!--[\s\S]*?-->/g, '');
  const scripts = [...uncommentedHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1, 'Expected HTML inline scripts');
  scripts.forEach((match, index) => {
    assert.doesNotThrow(
      () => new vm.Script(match[1], { filename: `ApprovalPage-script-${index + 1}.js` }),
      `Inline script #${index + 1} has invalid syntax`
    );
  });
});

test('Apps Script manifest is JSON with V8 runtime', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'appsscript.json'), 'utf8'));
  assert.equal(manifest.runtimeVersion, 'V8');
});
