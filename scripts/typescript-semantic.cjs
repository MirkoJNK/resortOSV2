const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const ts = require('typescript')

/**
 * Compute a syntax fingerprint with the locally installed TypeScript parser.
 * SyntaxKind numeric values can change between compiler versions, so the
 * fingerprint stores readable syntax-kind names instead.
 *
 * JSX whitespace is preserved unless it contains only indentation/newlines;
 * these formatting-only nodes do not change rendered content.
 */
function typescriptSemanticHash(file) {
  const source = fs.readFileSync(file, 'utf8')
  const kind = String(file).endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const tree = ts.createSourceFile(String(file), source, ts.ScriptTarget.Latest, true, kind)
  if (tree.parseDiagnostics.length) {
    throw new Error(`Cannot compare invalid TypeScript: ${file}`)
  }

  const contents = []
  function visit(node) {
    if (ts.isParenthesizedExpression(node) || ts.isParenthesizedTypeNode(node)) {
      ts.forEachChild(node, visit)
      return
    }
    if (ts.isJsxText(node) && /^\s*\n\s*$/.test(node.text)) return

    const text = node.escapedText ?? (
      ts.isStringLiteralLike(node) ||
      ts.isNumericLiteral(node) ||
      ts.isRegularExpressionLiteral(node) ||
      ts.isJsxText(node)
        ? node.text
        : undefined
    )
    contents.push([ts.SyntaxKind[node.kind], text])
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return crypto.createHash('sha256').update(JSON.stringify(contents)).digest('hex')
}

/**
 * Derive the approved hash using this machine's TypeScript version, not a
 * hash recorded using a different compiler release. The protected snapshots
 * are copied from the approved v0.6.4 application source (no functional edits).
 */
const approvedHashCache = new Map()

function approvedTypeScriptHash(relativeFile) {
  if (approvedHashCache.has(relativeFile)) return approvedHashCache.get(relativeFile)
  const root = path.resolve(__dirname, '..')
  const snapshot = path.join(root, 'tests/fixtures/approved-v064-source', relativeFile)
  if (!fs.existsSync(snapshot)) {
    throw new Error(`Missing approved TypeScript source snapshot: ${relativeFile}`)
  }
  const hash = typescriptSemanticHash(snapshot)
  approvedHashCache.set(relativeFile, hash)
  return hash
}

module.exports = { typescriptSemanticHash, approvedTypeScriptHash }
