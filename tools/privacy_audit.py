#!/usr/bin/env python3
"""Conservative local privacy guard. No network; no values printed. Not exhaustive."""
import re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
checks = {
  'email address': re.compile(r'(?<![\w.+-])[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}', re.I),
  'GitHub token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b'),
  'Google API key': re.compile(r'\bAIza[A-Za-z0-9_-]{35}\b'),
  'private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
  'deployed web app': re.compile(r'https://script\.google\.com/macros/s/(?!YOUR_|EXAMPLE_|test-|example-)[A-Za-z0-9_-]{20,}/exec'),
  'actual spreadsheet URL': re.compile(r'https://docs\.google\.com/spreadsheets/d/(?!YOUR_|EXAMPLE_)[A-Za-z0-9_-]{25,}'),
  'legacy personal Gmail ID': re.compile(r'REDACTED_GMAIL_ID_\d+'),
}
findings = []
for path in root.rglob('*'):
  if not path.is_file() or any(part.startswith('.') and part != '.github' for part in path.relative_to(root).parts):
    continue
  if path.suffix not in {'.gs','.html','.js','.md','.cjs','.json','.yml','.yaml','.py','.txt'}:
    continue
  content = path.read_text(encoding='utf-8', errors='replace')
  for label, regex in checks.items():
    for m in regex.finditer(content):
      if label == 'email address' and re.search(r'@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net|test)|example|test|localhost)\b', m.group(0), re.I):
        continue
      findings.append((str(path.relative_to(root)), content.count('\n',0,m.start())+1, label))
print(f'Scanned public export; findings: {len(findings)}.')
for file, line, kind in findings[:40]:
  print(f'  {file}:{line} - {kind}')
print('Automatic scanning is limited. Manually inspect all files before publishing.')
raise SystemExit(bool(findings))
