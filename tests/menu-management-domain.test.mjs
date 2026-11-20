import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = fs.readFileSync('src/features/menu-management/model.ts', 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const module = { exports: {} }
vm.runInNewContext(`(function(require,module,exports,crypto){${output}\n})`, { Intl, Date, Number, Error, Set, String, Object })(name => { throw Error(`Unexpected runtime import ${name}`) }, module, module.exports, {randomUUID: () => 'new-item-id'})
const M = module.exports
const now = '2026-11-09T00:00:00.000Z'
const categories = [
  { id: 'cat-1', name: 'Noodles', imageId: null, order: 0, active: true, createdAt: now, updatedAt: now },
  { id: 'cat-2', name: 'Drinks', imageId: null, order: 1, active: true, createdAt: now, updatedAt: now },
]
const add = (items, name = 'Pancit Canton', cat = categories) => M.saveItem(items, { name, categoryId: 'cat-1', priceCentavos: 18000, imageId: null }, cat, now, 'item-1')

test('exact decimal parsing into centavos, nonnegative price and currency formatting', () => {
  for (const [text, expected] of [['0', 0], ['0.00', 0], ['1.1', 110], ['001.01', 101], ['180.00', 18000], ['999999999.99', 99999999999]]) {
    assert.equal(M.parsePriceCentavos(text), expected, text)
  }
  for (const value of ['', '-1', '1.234', '.50', '1.', '1e3', 'NaN', 'Infinity', '1000000000.00', '12,000', 'abc']) {
    assert.equal(M.parsePriceCentavos(value), null, value)
  }
  assert.match(M.formatPrice(18000), /180\.00/)
  assert.equal(M.priceForInput(18000), '180.00')
})
test('item names are clean, duplicate names are case-insensitive and immutable IDs persist after edits', () => {
  const saved = add([], ' Pancit   Canton ')
  assert.equal(saved[0].id, 'item-1')
  assert.equal(saved[0].name, 'Pancit Canton')
  assert.equal(saved[0].createdAt, now)
  assert.equal(saved[0].active, true)
  assert.equal(M.validItems(saved), true)
  assert.equal(M.itemNameError('PANCIT canton', saved), 'An item with this name already exists')
  assert.throws(() => add(saved, 'pancit canton'), /already exists/)
  const edited = M.saveItem(saved, { id: 'item-1', name: 'Noodle Soup', categoryId: 'cat-2', priceCentavos: 22050, imageId: null }, categories, '2026-11-10T00:00:00Z')
  assert.equal(edited[0].id, 'item-1')
  assert.equal(edited[0].createdAt, now)
  assert.equal(edited[0].priceCentavos, 22050)
  assert.equal(edited[0].categoryId, 'cat-2')
})
test('category rename does not change the saved category ID and inactive categories remain assigned', () => {
  const saved = add([])
  const renamed = [{ ...categories[0], name: 'Noodle Dishes' }, categories[1]]
  assert.equal(renamed.find(c => c.id === saved[0].categoryId).name, 'Noodle Dishes')
  const inactive = [{ ...renamed[0], active: false }, renamed[1]]
  assert.equal(M.categoryAssignmentError('cat-1', inactive, saved[0]), null)
  assert.equal(M.categoryAssignmentError('cat-1', inactive), 'Choose an active category')
  assert.equal(M.categoryAssignmentError('gone', inactive, saved[0]), 'This category no longer exists. Choose an active category')
  assert.equal(M.saveItem(saved, { id: 'item-1', name: 'Pancit Canton', categoryId: 'cat-1', priceCentavos: 18000, imageId: null }, inactive)[0].categoryId, 'cat-1')
  assert.equal(M.saveItem(saved, { id: 'item-1', name: 'Pancit Canton', categoryId: 'cat-2', priceCentavos: 18000, imageId: null }, inactive)[0].categoryId, 'cat-2')
  assert.throws(() => add([], 'New', inactive), /active category/)
})
test('status toggle preserves records and images, searching/filtering/sorting is stable', () => {
  const first = add([])
  const second = M.saveItem(first, { name: 'Mango Shake', categoryId: 'cat-2', priceCentavos: 12000, imageId: 'image-1' }, categories, now, 'item-2')
  const toggled = M.flipItemStatus(second, 'item-1', now)
  assert.equal(toggled.length, 2)
  assert.equal(toggled[0].active, false)
  assert.equal(toggled[1].imageId, 'image-1')
  assert.equal(M.flipItemStatus(toggled, 'item-1', now)[0].active, true)
  assert.deepEqual(Array.from(M.selectItems(toggled, 'MANGO', 'all', 'az'), x => x.id), ['item-2'])
  assert.deepEqual(Array.from(M.selectItems(toggled, '', 'inactive', 'az'), x => x.id), ['item-1'])
  assert.deepEqual(Array.from(M.selectItems(toggled, '', 'all', 'az'), x => x.id), ['item-2', 'item-1'])
  assert.deepEqual(Array.from(M.selectItems(toggled, '', 'all', 'za'), x => x.id), ['item-1', 'item-2'])
})
test('stored records reject malformed structures, negative prices and broken names', () => {
  const saved = add([])
  for (const bad of [{priceCentavos:-1}, {priceCentavos:NaN}, {name:' Pancit Canton '}, {categoryId:''}, {imageId:0}, {id:''}, {active:'yes'}, {createdAt:'not-date'}, {order:1}]) {
    assert.equal(M.validItems([{ ...saved[0], ...bad }]), false, JSON.stringify(bad))
  }
  assert.equal(M.validItems([...saved, { ...saved[0], id:'item-2', name:'PANCIT canton' }]), false)
})
test('integration sources pin separate item storage and no manual ordering controls', () => {
  const nav = fs.readFileSync('src/shell/navigation.ts', 'utf8')
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  const page = fs.readFileSync('src/features/menu-management/MenuManagement.tsx', 'utf8')
  const storage = fs.readFileSync('src/features/menu-management/storage.ts', 'utf8')
  assert.match(nav, /systems\/menu/)
  assert.match(app, /case 'menu':\s*return <MenuManagement onDirtyChange=\{setItemsDirty\} \/>/)
  assert.match(app, /Discard unsaved item changes\?/)
  assert.match(storage, /resortos:menu-items:v1/)
  assert.match(storage, /transaction\(\[ITEMS, IMAGES, META\], 'readwrite'\)/)
  assert.doesNotMatch(storage, /localStorage|resortos:menu-categories:v1/)
  assert.match(page, /processCategoryImage/)
  assert.match(page, /await loadCatalog\(\)/)
  assert.doesNotMatch(page, /GripVertical|Move Up|Move Down|Drag to reorder|onPointerDown/)
})
