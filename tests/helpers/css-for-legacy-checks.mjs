/**
 * Compatibility for early resortOS tests written against compressed CSS text.
 *
 * The tests should ultimately assert on the parsed CSS declarations instead of
 * requiring a particular whitespace layout. Until then, expose the current CSS
 * in its readable form and in two normalized one-line forms. These forms are
 * generated from the ACTUAL parsed stylesheet, never from an old snapshot.
 *
 * The separate CSS semantic-lock test compares ordered selectors, properties,
 * values and at-rules against the approved v0.6.2 baseline.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const postcss = require('postcss')

function printCompact(node, space) {
  if (node.type === 'comment') return ''
  if (node.type === 'decl') {
    return `${node.prop}:${node.value}${node.important ? '!important' : ''};`
  }
  const children = node.nodes?.map((child) => printCompact(child, space)).join(space ? ' ' : '')
  if (node.type === 'rule') {
    return `${node.selector}${space ? ' { ' : '{'}${children}${space ? ' }' : '}'}`
  }
  if (node.type === 'atrule') {
    const params = node.params || ''
    const head = `@${node.name}${space && params ? ' ' : ''}${params}`
    return children === undefined ? head + ';' : `${head}${space ? ' { ' : '{'}${children}${space ? ' }' : '}'}`
  }
  return children || ''
}

export function cssForLegacyAssertions(filename) {
  const raw = readFileSync(filename, 'utf8')
  const parsed = postcss.parse(raw, { from: String(filename) })
  const compact = parsed.nodes.map((node) => printCompact(node, false)).join('')
  const spaced = parsed.nodes.map((node) => printCompact(node, true)).join('\n')
  return `${raw}\n${compact}\n${spaced}`
}
