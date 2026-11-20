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


test('first-use demo menu seeds fourteen prices, correct category IDs, and no duplicates on reload',async()=>{
 const categories=(await catsStorage.loadCatalog()).categories
 await itemsStorage.seedDemoMenuIfFirstUse(categories)
 let items=(await itemsStorage.loadItemCatalog()).items
 assert.equal(items.length,14)
 assert.ok(items.every(item=>item.active && categories.some(c=>c.id===item.categoryId)))
 assert.equal(items.find(i=>i.name==='Pancit Canton').priceCentavos,20000)
 await itemsStorage.seedDemoMenuIfFirstUse(categories)
 items=(await itemsStorage.loadItemCatalog()).items
 assert.equal(items.length,14)
})
test('removing every demo item intentionally does not reinitialize demo data',async()=>{
 const categories=(await catsStorage.loadCatalog()).categories
 await itemsStorage.commitItemCatalog({items:[],images:new Map()})
 await itemsStorage.seedDemoMenuIfFirstUse(categories)
 assert.equal((await itemsStorage.loadItemCatalog()).items.length,0)
})
test('existing custom menu contents and prices survive subsequent initializer checks',async()=>{
 const categories=(await catsStorage.loadCatalog()).categories
 const custom={id:'custom-item',name:'Existing Menu Choice',categoryId:categories[0].id,priceCentavos:45678,
 imageId:null,active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
 await itemsStorage.commitItemCatalog({items:[custom],images:new Map()})
 await itemsStorage.seedDemoMenuIfFirstUse(categories)
 const items=(await itemsStorage.loadItemCatalog()).items
 assert.equal(items.length,1)
 assert.equal(items[0].priceCentavos,45678)
})
