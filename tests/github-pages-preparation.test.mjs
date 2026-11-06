import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const read = p => readFileSync(p, 'utf8')
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const config = read('vite.config.ts')
const sidebar = read('src/shell/Sidebar.tsx')
const workflow = read('.github/workflows/deploy.yml')
const approved = JSON.parse(read('GITHUB_DEPLOYMENT_APPROVAL.json'))

test('Vite supports the repo base while keeping localhost at root', () => {
  assert.match(config, /loadEnv\(mode, '\.', ''\)\.GITHUB_PAGES_BASE \|\| '\/'/)
  assert.equal(sha('vite.config.ts'), approved.updated_vite_sha256)
})
test('public asset URL helper applies exactly the configured Vite base', () => {
  assert.match(sidebar, /import\.meta\.env\.BASE_URL/)
  assert.match(sidebar, /src=\{publicAssetUrl\("\/assets\/sidebar-brand-approved-v058\.png"\)\}/)
  assert.match(sidebar, /src=\{publicAssetUrl\("\/assets\/sidebar-coastal-approved-v058\.png"\)\}/)
  assert.match(sidebar, /src=\{publicAssetUrl\(item\.iconAsset\)\}/)
  assert.equal(sha('src/shell/Sidebar.tsx'), approved.updated_sidebar_sha256)
})
test('public artwork preserved as unmodified published images', () => {
  for (const name of ['sidebar-brand-approved-v058.png','sidebar-coastal-approved-v058.png','sidebar-icon-dashboard-approved-v058.png','sidebar-icon-support-approved-v058.png','sidebar-icon-audit-approved-v058.png','sidebar-icon-systems-approved-v058.png','resort-illustration.png','resort-shore.png']) {
    assert.ok(existsSync(`public/assets/${name}`),name)
  }
})
test('only one deployment workflow, and no fragile post-build fixer', () => {
  assert.deepEqual(readdirSync('.github/workflows'), ['deploy.yml'])
  assert.match(workflow, /GITHUB_PAGES_BASE: \/resortOSV2\//)
  assert.match(workflow, /uses: actions\/deploy-pages@v4/)
  assert.match(workflow, /run: npm run build/)
  assert.doesNotMatch(workflow, /fix-pages-assets/)
})
test('historical v066 regression data is limited to four preserved fixtures', () => {
  assert.ok(!existsSync('resortOS_v066'))
  for (const file of ['src/components/SupportWorkspace.tsx','src/styles/light-sidebar-v058.css','src/features/dashboard/Dashboard.tsx','public/assets/sidebar-brand-approved-v058.png']) {
    assert.ok(existsSync(`tests/fixtures/v066-historical-source/${file}`),file)
  }
})
test('generated artifacts and secrets are ignored even when tests/builds create them', () => {
  // CI necessarily has node_modules, and TSC may produce tsbuildinfo before tests.
  // Verify the committed-source ignore policy, not temporary runtime absence.
  const ignore = read('.gitignore')
  for (const pattern of ['node_modules/', 'dist/', 'visual-reference.html', '*.tsbuildinfo', '.env'])
    assert.ok(ignore.includes(pattern), pattern)
  assert.ok(!existsSync('QA_Reports'), 'Removed development evidence is not in the source package')
})
