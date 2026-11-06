const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { typescriptSemanticHash, approvedTypeScriptHash } = require('./typescript-semantic.cjs')
const root = path.resolve(__dirname, '..')
const file = path.join(root, 'src/main.tsx')
const addition = "import './styles/system-management.css'"
const tablesAddition = "import './features/tables-manager/tables-manager.css'"
const roomsAddition = "import './features/rooms-manager/rooms-manager.css'"
const serviceAddition = "import './features/service-catalog/service-catalog.css'"
const restaurantAddition = "import './features/restaurant/restaurant-dashboard.css'"
const hotfixAddition = "import './styles/profile-workspace-hotfix.css'"
function verifySystemManagementEntrypoint() {
  const original = fs.readFileSync(file, 'utf8')
  if (original.split(addition).length !== 2) throw Error('Expected one System Management stylesheet import')
  if (!original.includes("import './styles/layout-integration-v062.css'\n" + addition + '\n' + tablesAddition + '\n' + roomsAddition + '\n' + serviceAddition + '\n' + restaurantAddition + '\n' + hotfixAddition)) throw Error('Scoped styles must load in approved order')
  if (original.split(tablesAddition).length !== 2) throw Error('Expected one Tables Manager stylesheet import')
  if (original.split(roomsAddition).length !== 2) throw Error('Expected one Rooms Manager stylesheet import')
  if (original.split(serviceAddition).length !== 2) throw Error('Expected one Service Catalog stylesheet import')
  if (original.split(restaurantAddition).length !== 2) throw Error('Expected one Restaurant-scoped stylesheet import')
  if (original.split(hotfixAddition).length !== 2) throw Error('Expected one approved hotfix stylesheet import')
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ros-v2-main-'))
  try {
    const candidate = path.join(temp, 'main.tsx')
    fs.writeFileSync(candidate, original.replace(addition + '\n', '').replace(tablesAddition + '\n', '').replace(roomsAddition + '\n', '').replace(serviceAddition + '\n', '').replace(restaurantAddition + '\n', '').replace(hotfixAddition + '\n', ''))
    if (typescriptSemanticHash(candidate) !== approvedTypeScriptHash('src/main.tsx')) throw Error('Unrelated entrypoint syntax changed')
  } finally { fs.rmSync(temp, { force: true, recursive: true }) }
  return true
}
if (require.main === module) { try { verifySystemManagementEntrypoint(); console.log('Existing entrypoint preserved; approved stylesheet loaded last.') } catch (e) { console.error(e.message); process.exitCode = 1 } }
module.exports = { verifySystemManagementEntrypoint }
