const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function collect(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const p = path.join(dir, item.name);
    return item.isDirectory() ? collect(p) : /\.(ts|tsx)$/.test(item.name) ? [p] : [];
  });
}

const files = [...collect(path.join(root, 'src')), path.join(root, 'vite.config.ts')];
let failures = 0;
for (const file of files) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
  for (const diag of parsed.parseDiagnostics) {
    const line = parsed.getLineAndCharacterOfPosition(diag.start ?? 0).line + 1;
    console.error(`${path.relative(root, file)}:${line}: ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
    failures++;
  }
}
if (failures) process.exitCode = 1;
else console.log(`TypeScript syntax parsed: ${files.length} files, 0 syntax errors.`);
