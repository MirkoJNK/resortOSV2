const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { cssSemanticHash } = require('./css-semantic.cjs');
const { typescriptSemanticHash, approvedTypeScriptHash } = require('./typescript-semantic.cjs');
const { verify: verifyShellExtraction } = require('./verify-shell-extraction.cjs');
const { verifySystemManagementEntrypoint } = require('./verify-system-management-entrypoint.cjs');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/v062-approved-baseline.json'), 'utf8'));
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const allowedChanges = JSON.parse(fs.readFileSync(path.join(root, 'V06611_APPROVED_CHANGES.json'),'utf8')).files;
const approvedHotfix = JSON.parse(fs.readFileSync(path.join(root, 'GLOBAL_UI_HOTFIX_APPROVED.json'), 'utf8')).approved_source;
const approvedChange = (rel, full) => fs.existsSync(full) && (Object.hasOwn(approvedHotfix, rel) ? sha(full) === approvedHotfix[rel].after : Object.hasOwn(allowedChanges, rel) && sha(full) === allowedChanges[rel]);
let passed = 0;
const errors = [];
for (const [rel, expected] of Object.entries(manifest.sourceAndAssets)) {
  const actual = path.join(root, rel);
  if (!fs.existsSync(actual) || sha(actual) !== expected) errors.push(`${rel}: changed or missing`);
  else passed++;
}
for (const [rel, expected] of Object.entries(manifest.sourceSemantics)) {
  const actual = path.join(root, rel);
  if (rel === 'src/domain/types.ts') {
    // Authorized nested Tables Manager Area type; guard the entire new file via a release-specific semantic hash.
    const roomsApproval = JSON.parse(fs.readFileSync(path.join(root, 'SERVICE_CATALOG_APPROVED.json'), 'utf8'));
    if (typescriptSemanticHash(actual) === roomsApproval.domainTypesHash) passed++;
    else errors.push('src/domain/types.ts: unauthorized type change');
  } else if (rel === 'src/App.tsx' || rel === 'src/main.tsx') {
    try { rel === 'src/App.tsx' ? verifyShellExtraction() : verifySystemManagementEntrypoint(); passed++; }
    catch (error) { errors.push(error.message); }
  } else if (approvedChange(rel, actual)) passed++;
  else if (!fs.existsSync(actual) || typescriptSemanticHash(actual) !== approvedTypeScriptHash(rel)) errors.push(`${rel}: TypeScript/JSX syntax changed`);
  else passed++;
}
for (const [rel, expected] of Object.entries(manifest.cssSemantics)) {
  const actual = path.join(root, rel);
  if (approvedChange(rel, actual)) passed++;
  else if (!fs.existsSync(actual) || cssSemanticHash(actual) !== expected) errors.push(`${rel}: CSS selector, rule, or declaration changed`);
  else passed++;
}
if (errors.length) {
  console.error('Approved v0.6.2 baseline mismatch:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Approved semantic baseline preserved: ${passed} source / asset / stylesheet comparisons passed.`);
}
