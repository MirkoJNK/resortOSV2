import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({server:{host:'127.0.0.1',port:0}})
try {
  await server.listen()
  const local=server.resolvedUrls?.local[0]
  assert.ok(local,'Vite must provide a local address')
  const targets=[
    '/', '/src/App.tsx', '/src/shell/DemoAccountMenu.tsx', '/src/shell/accountOptions.ts',
    '/src/shared/MenuFallbackImage.tsx',
    '/src/features/menu-categories/MenuCategories.tsx',
    '/src/features/menu-management/MenuManagement.tsx',
    '/assets/menu-category-fallback.png', '/assets/menu-item-fallback.png'
  ]
  for(const target of targets){
    const response=await fetch(new URL(target,local))
    assert.equal(response.status,200,`${target} returned HTTP ${response.status}`)
    if(target.endsWith('.png')){
      const data=new Uint8Array(await response.arrayBuffer())
      assert.deepEqual([...data.subarray(0,8)],[137,80,78,71,13,10,26,10])
      assert.equal(response.headers.get('content-type'),'image/png')
    }else{
      const body=await response.text()
      assert.ok(body.length>100,target)
    }
    console.log(`PASS ${target}: HTTP 200`)
  }
}finally{
  await server.close()
}
