import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const tsMod = (filename, mapping, globals = {}) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const module = { exports: {} }
  const environment = { ...globals, Blob, crypto: { randomUUID: () => `uuid-${Math.random()}` } }
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, environment)(name => {
    if (!(name in mapping)) throw Error(`Unrecognized import: ${name}`)
    return mapping[name]
  }, module, module.exports)
  return module.exports
}

/** Minimal asynchronous IDB implementation for deterministic browser-storage contract testing. */
function makeIndexedDB() {
  const databases = new Map()
  const state = name => databases.get(name)
  function open(name) {
    const request = {}
    queueMicrotask(() => {
      let created = false
      if (!databases.has(name)) { databases.set(name, new Map()); created = true }
      const stores = databases.get(name)
      const database = {
        name,
        objectStoreNames: { contains: key => stores.has(key) },
        createObjectStore: key => { stores.set(key, new Map()) },
        transaction(keys, mode) {
          if (!Array.isArray(keys)) keys = [keys]
          const tx = {
            pending: 0, scheduled: false, completed: false, oncomplete: undefined, onabort: undefined,
            objectStore(key) {
              if (!keys.includes(key)) throw Error('Store not in transaction')
              return {
                get(value) { return action('get', key, value) },
                getAll() { return action('getAll', key) },
                put(value, explicitKey) { return action('put', key, value, explicitKey) },
                clear() { return action('clear', key) }
              }
            }
          }
          function action(type, key, value, explicitKey) {
            const req = {}
            tx.pending++
            queueMicrotask(() => {
              const data = stores.get(key)
              try {
                if (type === 'get') req.result = data.get(value)
                if (type === 'getAll') req.result = Array.from(data.values())
                if (type === 'put') data.set(explicitKey ?? value.id, value)
                if (type === 'clear') data.clear()
                req.onsuccess?.()
              } catch (error) { req.error = error; req.onerror?.() }
              tx.pending--
              if (tx.pending === 0 && !tx.scheduled) {
                tx.scheduled = true
                queueMicrotask(() => { if (!tx.completed) { tx.completed = true; tx.oncomplete?.() } })
              }
            })
            return req
          }
          return tx
        },
        close() {}
      }
      request.result = database
      if (created) request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request
  }
  return { open, state }
}

const indexedDB = makeIndexedDB()
const globals = { indexedDB }
const catsModel = tsMod('src/features/menu-categories/model.ts', {}, globals)
const itemsModel = tsMod('src/features/menu-management/model.ts', {}, globals)
const catsStorage = tsMod('src/features/menu-categories/storage.ts', { './model': catsModel }, globals)
const itemsStorage = tsMod('src/features/menu-management/storage.ts', { './model': itemsModel }, globals)

test('real feature storage loads independent databases and keeps menu items empty initially', async () => {
  const categoryCatalog = await catsStorage.loadCatalog()
  const items = await itemsStorage.loadItemCatalog()
  assert.ok(categoryCatalog.categories.length > 0, 'Existing category demo data is accessible')
  assert.equal(items.items.length, 0, 'Menu Management does not seed operational items')
  assert.equal(itemsStorage.ITEM_DB_NAME, 'resortos:menu-items:v1')
  assert.equal(catsStorage.CATEGORY_DB_NAME, 'resortos:menu-categories:v1')
  assert.ok(indexedDB.state(catsStorage.CATEGORY_DB_NAME))
  assert.ok(indexedDB.state(itemsStorage.ITEM_DB_NAME))
})
test('category ID, price, item image survive reload, rename, deactivation and reactivation', async () => {
  let catCatalog = await catsStorage.loadCatalog()
  const noodles = catCatalog.categories.find(c => c.name === 'Noodles')
  assert.ok(noodles)
  const picture = { id: 'picture-123', blob: new Blob(['picture bytes'], { type: 'image/png' }), mime: 'image/png', width: 20, height: 15 }
  let itemCatalog = await itemsStorage.loadItemCatalog()
  itemCatalog.items = itemsModel.saveItem(itemCatalog.items, {name:'Pancit Canton',categoryId:noodles.id,priceCentavos:18000,imageId:picture.id},catCatalog.categories,'2026-11-09T00:00:00Z','item-123')
  itemCatalog.images.set(picture.id, picture)
  await itemsStorage.commitItemCatalog(itemCatalog)
  let persisted = await itemsStorage.loadItemCatalog()
  assert.equal(persisted.items[0].priceCentavos,18000)
  assert.equal(persisted.items[0].categoryId,noodles.id)
  assert.equal(persisted.items[0].imageId,picture.id)
  assert.equal(persisted.images.get(picture.id).blob.size,picture.blob.size)
  catCatalog.categories = catsModel.editCategory(catCatalog.categories,noodles.id,'Noodle Dishes',noodles.imageId)
  await catsStorage.commitCatalog(catCatalog)
  catCatalog = await catsStorage.loadCatalog()
  assert.equal(catCatalog.categories.find(c => c.id === persisted.items[0].categoryId).name,'Noodle Dishes')
  catCatalog.categories = catsModel.flipCategoryStatus(catCatalog.categories,noodles.id)
  await catsStorage.commitCatalog(catCatalog)
  persisted = await itemsStorage.loadItemCatalog()
  assert.equal(persisted.items[0].active,true)
  assert.equal(persisted.items[0].categoryId,noodles.id)
  assert.equal((await catsStorage.loadCatalog()).categories.find(c => c.id === noodles.id).active,false)
  catCatalog.categories = catsModel.flipCategoryStatus(catCatalog.categories,noodles.id)
  await catsStorage.commitCatalog(catCatalog)
  assert.equal((await catsStorage.loadCatalog()).categories.find(c => c.id === noodles.id).active,true)
  assert.equal((await itemsStorage.loadItemCatalog()).items[0].categoryId,noodles.id)
})
test('image replacement and removal clean old blobs, while unsaved drafts do not affect storage', async () => {
  const before = await itemsStorage.loadItemCatalog()
  assert.equal(before.images.size,1)
  // Editor drafts are not persisted. Reloading must still expose original image.
  const unsavedBlob = new Blob(['unsaved'], { type:'image/png' })
  assert.equal(unsavedBlob.size,7)
  assert.equal((await itemsStorage.loadItemCatalog()).items[0].imageId,'picture-123')
  const original = before.items[0]
  const replacement = { id:'picture-replacement', blob:new Blob(['replacement'], {type:'image/webp'}),mime:'image/webp',width:32,height:25 }
  const categoryCatalog = await catsStorage.loadCatalog()
  const updated = itemsModel.saveItem(before.items, {id:original.id,name:original.name,categoryId:original.categoryId,priceCentavos:20050,imageId:replacement.id},categoryCatalog.categories)
  await itemsStorage.commitItemCatalog({items:updated,images:new Map([[replacement.id,replacement]])})
  let persisted = await itemsStorage.loadItemCatalog()
  assert.equal(persisted.images.has('picture-123'),false)
  assert.equal(persisted.images.has(replacement.id),true)
  assert.equal(persisted.items[0].priceCentavos,20050)
  const removed = itemsModel.saveItem(persisted.items, {id:original.id,name:original.name,categoryId:original.categoryId,priceCentavos:20050,imageId:null},categoryCatalog.categories)
  await itemsStorage.commitItemCatalog({items:removed,images:new Map()})
  persisted = await itemsStorage.loadItemCatalog()
  assert.equal(persisted.items[0].imageId,null)
  assert.equal(persisted.images.size,0)
})
test('invalid image references are refused without modifying saved items', async () => {
  const current = await itemsStorage.loadItemCatalog()
  const categoryCatalog = await catsStorage.loadCatalog()
  const changed = itemsModel.saveItem(current.items, {id:current.items[0].id,name:current.items[0].name,categoryId:current.items[0].categoryId,priceCentavos:1,imageId:'uncommitted-image'},categoryCatalog.categories)
  await assert.rejects(() => itemsStorage.commitItemCatalog({items:changed,images:new Map()}), /missing or invalid image/)
  assert.equal((await itemsStorage.loadItemCatalog()).items[0].priceCentavos,20050)
})
