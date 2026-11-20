import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
let chromium
try {
  const installed = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ;({ chromium } = require(installed ? installed + '/playwright' : 'playwright'))
} catch {
  throw Error('Playwright is needed for optional visual QA: npm install --no-save playwright && npx playwright install chromium')
}

const base = 'http://127.0.0.1:5173/'
const evidence = 'DISCOUNT_MANAGEMENT_QA_EVIDENCE'
await fs.mkdir(evidence, { recursive: true })
const browser = await chromium.launch({
  ...(process.env.RESORTOS_CHROMIUM_PATH
    ? { executablePath: process.env.RESORTOS_CHROMIUM_PATH }
    : process.platform === 'linux' && existsSync('/usr/bin/chromium')
      ? { executablePath: '/usr/bin/chromium' }
      : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const notes = []
try {
  for (const width of [1440, 1024, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => notes.push(`page-error-${width}: ${e.message}`))
      await page.goto(base + '#systems/discounts', { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Discount Management' }).waitFor()
    await page.screenshot({ path: `${evidence}/admin-discounts-${width}.png`, fullPage: true })
    notes.push(
      `admin-${width}: heading=${await page.locator('h1').innerText()}, overflow=${await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`,
    )
    if (width === 1440) {
      await page.getByRole('button', { name: 'Add Discount' }).click()
      await page.getByLabel('Applicability').selectOption('categories')
      const categoryChecks = page.locator('.dm-choices input[type="checkbox"]')
      assert.ok(await categoryChecks.count() > 0, 'Active categories must have checkbox choices')
      const dimensions = await categoryChecks.first().evaluate(element => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
      assert.ok(dimensions.width >= 14 && dimensions.width <= 18, 'Checkbox must be compact')
      assert.ok(dimensions.height >= 14 && dimensions.height <= 18, 'Checkbox must be compact')
      await categoryChecks.first().check()
      assert.equal(await categoryChecks.first().isChecked(), true)
      notes.push(`category-checkbox=${dimensions.width}x${dimensions.height}, toggle=pass`)
      await page.getByLabel('Applicability').selectOption('all')
      await page.getByLabel('Discount name').fill('Browser Test Offer')
      await page.getByLabel('Discount (%)').fill('10')
      await page.getByRole('dialog').getByRole('button', { name: 'Add Discount' }).click()
      await page.getByText('Browser Test Offer').waitFor()
      notes.push(`promotion-created=${await page.getByText('Browser Test Offer').count()}`)
      await page.screenshot({ path: `${evidence}/promotion-created-${width}.png`, fullPage: true })
      await page.getByRole('tab', { name: 'Service Charge' }).click()
      const panels = page.locator('.dm-setting-panel')
      assert.equal(await panels.nth(0).getByLabel('Service charge (%)').inputValue(), '10')
      assert.equal(await panels.nth(0).locator('input[type=checkbox]').isChecked(), true)
      assert.equal(await page.getByText('Reason for change').count(), 0)
      assert.equal(await page.getByText('Configuration history').count(), 0)
      const serviceCheckSize = await panels.nth(0).locator('input[type=checkbox]').evaluate(element => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
      assert.ok(serviceCheckSize.width >= 14 && serviceCheckSize.width <= 18)
      notes.push(`service-default=10%-active, checkbox=${serviceCheckSize.width}x${serviceCheckSize.height}`)
      await panels.nth(0).getByLabel('Service charge (%)').fill('8.5')
      await page.getByRole('button', { name: 'Save Service Charge' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      notes.push(`service-charge-saved=${await panels.nth(0).getByLabel('Service charge (%)').inputValue()}`)
      assert.equal(await panels.nth(1).getByRole('heading', { name: 'Restaurant VAT' }).count(), 1)
      const taxOptions = await panels.nth(1).getByLabel('Menu pricing').locator('option').allTextContents()
      assert.deepEqual(taxOptions, ['VAT Registered', 'Non-VAT Establishment'])
      assert.equal(await panels.nth(1).getByLabel('Menu pricing').inputValue(), 'vat-inclusive')
      await panels.nth(1).getByLabel('Menu pricing').selectOption('non-vat')
      await page.getByRole('button', { name: 'Save VAT Treatment' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      notes.push(`tax-mode-saved=${await panels.nth(1).getByLabel('Menu pricing').inputValue()}`)
      await page.screenshot({ path: `${evidence}/service-configured-${width}.png`, fullPage: true })
      await page.goto(base + '#/restaurant/tables', { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${evidence}/restaurant-tables-${width}.png`, fullPage: true })
      notes.push(
        `tables-buttons=${(await page.getByRole('button').allTextContents())
          .filter((x) => /start|order|table/i.test(x))
          .slice(0, 12)
          .join('|')}`,
      )
    }
    await context.close()
  }
} finally {
  await browser.close()
}
await fs.writeFile(`${evidence}/live-qa-notes.txt`, notes.join('\n') + '\n')
console.log(notes.join('\n'))
