const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { semanticTree } = require('./css-semantic.cjs');

const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'src/styles');
const files = fs.readdirSync(folder).filter((name) => name.endsWith('.css'));
const write = process.argv.includes('--write');
const check = process.argv.includes('--check') || !write;
const compactLine = (str) => str.replace(/\s*\n\s*/g, ' ').trim();

// This stable, idempotent formatter is available even before Prettier is installed.
// It does not reorder declarations or merge duplicate selectors: CSS cascade wins.
function print(node, indent) {
  const sp = '  '.repeat(indent);
  if (node.type === 'comment') return sp + '/* ' + node.text.trim() + ' */';
  if (node.type === 'decl') return sp + node.prop + ': ' + node.value + (node.important ? ' !important' : '') + ';';
  const children = (node.nodes || []).map((item) => print(item, indent + 1)).filter(Boolean).join('\n');
  if (node.type === 'rule') return sp + compactLine(node.selector) + ' {\n' + children + '\n' + sp + '}';
  if (node.type === 'atrule') {
    const head = sp + '@' + node.name + (node.params ? ' ' + compactLine(node.params) : '');
    return node.nodes ? head + ' {\n' + children + '\n' + sp + '}' : head + ';';
  }
  throw new Error('Unexpected CSS node ' + node.type);
}

let violations = 0;
for (const name of files) {
  const file = path.join(folder, name);
  const current = fs.readFileSync(file, 'utf8');
  const parsed = postcss.parse(current, { from: file });
  const result = parsed.nodes.map((node) => print(node, 0)).join('\n\n') + '\n';
  const formatted = postcss.parse(result, { from: file });
  if (JSON.stringify(semanticTree(parsed)) !== JSON.stringify(semanticTree(formatted))) {
    throw new Error(`Formatting changed CSS semantics: ${name}`);
  }
  if (current === result) continue;
  violations++;
  if (write) {
    fs.writeFileSync(file, result);
    console.log(`Formatted ${name}`);
  } else if (check) {
    console.error(`Needs formatting: src/styles/${name}`);
  }
}
if (write) console.log(`CSS formatting completed: ${files.length} stylesheets; ${violations} updated.`);
else if (violations) process.exitCode = 1;
else console.log(`CSS formatting verified: ${files.length} stylesheets.`);
