import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
test('recovery successor pins changed assets/code while retaining all original release manifests',()=>{
 const {verify}=require('../scripts/verify-recovery-integrity.cjs')
 assert.ok(verify()>=470)
 for(const file of ['PREMIUM_EXPERIENCE_INTEGRITY.json','RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json','GLOBAL_UI_HOTFIX_APPROVED.json']){
  assert.ok(fs.existsSync(file))
 }
})
