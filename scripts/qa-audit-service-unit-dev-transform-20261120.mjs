import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
try {
  await server.listen()
  const address = server.resolvedUrls?.local[0]
  assert.ok(address, 'Vite must report a local address')
  const targets = [
    '/',
    '/src/features/audit-log/AuditLog.tsx',
    '/src/features/audit-log/EventDetails.tsx',
    '/src/features/audit-log/AuditTraceGraph.tsx',
    '/src/features/audit-log/contextual-details.ts',
    '/src/features/audit-log/room-trace.ts',
    '/src/features/audit-log/transaction-details.ts',
    '/src/features/audit-log/service-billing-quantity.ts',
    '/src/features/front-desk/CheckoutHistoryPanel.tsx'
  ]
  for (const target of targets) {
    const response = await fetch(new URL(target, address))
    const content = await response.text()
    assert.equal(response.status, 200, `${target}: HTTP ${response.status}\n${content.slice(0, 400)}`)
    console.log(`PASS ${target}: HTTP 200`)
  }
} finally {
  await server.close()
}
