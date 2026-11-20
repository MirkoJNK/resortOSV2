import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
try {
  await server.listen()
  const address = server.resolvedUrls?.local[0]
  assert.ok(address, 'Vite must report a local address')
  const targets = [
    '/',
    '/src/App.tsx',
    '/src/shell/Topbar.tsx',
    '/src/shell/HelpMenu.tsx',
    '/src/features/restaurant-tables/RestaurantTables.tsx',
    '/src/features/restaurant-tables/DialogFrame.tsx',
    '/src/features/front-desk/FrontDeskCheckout.tsx',
    '/src/features/front-desk/CheckoutHistoryPanel.tsx',
    '/src/features/front-desk/checkoutHistory.ts',
  ]
  for (const target of targets) {
    const response = await fetch(new URL(target, address))
    const content = await response.text()
    assert.equal(response.status, 200, `${target}: HTTP ${response.status}\n${content.slice(0, 400)}`)
    if (target.endsWith('RestaurantTables.tsx')) {
      assert.match(content, /Upcoming reservation/)
      assert.doesNotMatch(content, /window\.confirm\(/)
    }
    if (target.endsWith('HelpMenu.tsx')) assert.doesNotMatch(content, /Search Help/)
    console.log(`PASS ${target}: 200`)
  }
} finally {
  await server.close()
}
