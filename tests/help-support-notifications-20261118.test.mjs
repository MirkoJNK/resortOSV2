import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
import {webcrypto} from 'node:crypto'

if(!globalThis.crypto)globalThis.crypto=webcrypto
const state=new Map()
globalThis.localStorage={getItem:key=>state.get(key)??null,setItem:(key,value)=>state.set(key,String(value))}
globalThis.Event=class Event{constructor(type){this.type=type}}
globalThis.window={dispatchEvent:()=>{}}
const moduleFor=async file=>{
  const buildResult=await build({entryPoints:[file],bundle:true,platform:'node',format:'esm',write:false,
    logLevel:'silent',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"'}})
  return import('data:text/javascript;base64,'+Buffer.from(buildResult.outputFiles[0].contents).toString('base64'))
}
const [tickets,employees,notification,attachments,navigation,transition,ui]=await Promise.all([
  'src/features/support/tickets.ts','src/features/employees/model.ts',
  'src/features/notifications/model.ts','src/features/support/attachments.ts',
  'src/shell/navigation.ts','src/shell/workspaceTransition.ts','src/components/SupportWorkspace.tsx'
].map(moduleFor))
const fixed='2026-11-18T09:30:00.000Z'
const people=employees.emptyEmployeeDirectory()
const luis=employees.saveEmployee(people,{fullName:'Luis Ramos',role:'restaurant'},fixed,'demo-restaurant-luis').employees.at(-1)
const sofia=employees.saveEmployee(people,{fullName:'Sofia Cruz',role:'front-desk'},fixed,'demo-frontdesk-sofia').employees.at(-1)
const admin=people.employees[0]
const permissions={version:1,revision:0,subroles:[],access:[],events:[]}

test('shared Help and employee support are not workspaces; initial mount does not animate',()=>{
  assert.equal(navigation.workspaceForRoute('help'),null)
  assert.equal(navigation.workspaceForRoute('employee-support'),null)
  assert.equal(navigation.workspaceForRoute('restaurant-orders'),'restaurant')
  assert.equal(navigation.workspaceForRoute('support'),'admin')
  assert.equal(transition.nextWorkspaceTransition(null,'restaurant','restaurant',false),null)
  assert.ok(transition.nextWorkspaceTransition(null,'restaurant','front-desk',false))
  assert.match(readFileSync('src/features/help/help-center.css','utf8'),/\.hc-search input:focus-visible\s*\{outline:none/)
})

test('simulated support fixtures receive real demo actor IDs without altering authored records',()=>{
  const seeded=tickets.seedTicketCollection(ui.createSupportTickets(),new Date(fixed))
  const authored={...seeded,tickets:seeded.tickets.map((t,i)=>i!==0?t:{...t,messages:[...t.messages,
    {id:'authored-reply',authorId:'real-employee',author:'Actual User',initials:'AU',text:'Real message',
      time:'10:00 AM',sentAt:fixed,side:'requester'}]})}
  const migrated=tickets.migrateSimulatedAttribution(authored)
  assert.equal(migrated.demoAttributionVersion,2)
  assert.equal(tickets.migrateSimulatedAttribution(migrated),migrated)
  assert.equal(tickets.validTicketCollection(migrated),true)
  assert.ok(migrated.tickets.every(t=>t.creatorId&&t.requester!=='Sarah Kim'))
  assert.equal(migrated.tickets[0].messages.at(-1).author,'Actual User')
  assert.equal(migrated.tickets[0].messages.at(-1).authorId,'real-employee')
})

test('employee ticket creation persists description as one initial message and only urgent creations notify',()=>{
  const before=tickets.seedTicketCollection(ui.createSupportTickets(),new Date(fixed))
  const ordinary=tickets.createTicket(before,luis,permissions,{subject:'Broken table',description:'Table leg is loose',priority:'High'},new Date(fixed))
  assert.equal(ordinary.tickets[0].messages.length,1)
  assert.equal(ordinary.tickets[0].messages[0].text,'Table leg is loose')
  assert.equal(ordinary.tickets[0].messages[0].authorId,luis.id)
  assert.equal(ordinary.urgentEvents,undefined)
  const urgent=tickets.createTicket(ordinary,sofia,permissions,{subject:'Serious leak',description:'Water in the hallway',priority:'Urgent'},new Date(fixed))
  assert.equal(urgent.urgentEvents.length,1)
  assert.equal(urgent.urgentEvents[0].department,'Front Desk')
  assert.equal(urgent.urgentEvents[0].ticketId,urgent.tickets[0].id)
  assert.equal(tickets.validTicketCollection(urgent),true)
  const changed=tickets.manageTicket(urgent,admin,permissions,urgent.tickets[0].id,{field:'priority',value:'High'})
  assert.equal(changed.urgentEvents.length,1)
})

test('attachment-only replies retain metadata and permission, duplicate and Closed checks',()=>{
  const before=tickets.createTicket(tickets.seedTicketCollection(ui.createSupportTickets()),luis,permissions,
    {subject:'Broken table',description:'Needs repair',priority:'High'},new Date(fixed))
  const id=before.tickets[0].id
  const meta=[{id:'file-one',name:'proof.png',mime:'image/png',size:100}]
  const posted=tickets.replyTicket(before,luis,permissions,id,'',new Date(fixed),meta,'message-once')
  assert.equal(posted.tickets[0].messages.at(-1).text,'')
  assert.deepEqual(posted.tickets[0].messages.at(-1).attachments,meta)
  assert.equal(tickets.validTicketCollection(posted),true)
  assert.throws(()=>tickets.replyTicket(posted,luis,permissions,id,'again',new Date(fixed),meta,'message-once'),/already been recorded/)
  assert.throws(()=>tickets.replyTicket(posted,sofia,permissions,id,'other department'),/cannot reply/)
  const closed=tickets.manageTicket(posted,admin,permissions,id,{field:'status',value:'Closed'})
  assert.throws(()=>tickets.replyTicket(closed,luis,permissions,id,'Reply'),/closed ticket/)
})

test('file format, size and signature are validated before storing',async()=>{
  const pdf=new File([new Uint8Array([37,80,68,70,45,49,46,55])],'report.pdf',{type:'application/pdf'})
  assert.equal((await attachments.validateAttachment(pdf)).mime,'application/pdf')
  const png=new File([new Uint8Array([137,80,78,71,13,10,26,10,1,2])],'room.png',{type:'image/png'})
  assert.equal((await attachments.validateAttachment(png)).name,'room.png')
  await assert.rejects(()=>attachments.validateAttachment(new File(['<html>malicious</html>'],'fake.pdf',{type:'application/pdf'})),/does not match/)
  await assert.rejects(()=>attachments.validateAttachment(new File(['payload'],'unrecognized.svg',{type:'image/svg+xml'})),/not a supported/)
  await assert.rejects(()=>attachments.validateAttachment(new File(['payload'],'file.pdf',{type:'text/plain'})),/not a supported/)
  await assert.rejects(()=>attachments.validateAttachment(new File([new Uint8Array(10*1024*1024+1)],'large.txt',{type:'text/plain'})),/10 MB/)
  assert.equal(attachments.safeAttachmentName('../bad<name>.txt'),'bad_name_.txt')
})

test('room notification source comes exclusively from a successful posted charge, with original transaction ID',()=>{
  const event={id:'ops:10:room.posting.created:one',type:'room.posting.created',outcome:'Success',
    target:{kind:'settlement',id:'one'},targetLabel:'Room 205',amountCentavos:85000,
    references:[{kind:'order',id:'order-10'}],actor:{id:'demo-restaurant-moy'},at:fixed}
  const record=notification.roomNotificationForAuditEvent(event,'Order #1042')
  assert.equal(record.settlementId,'one')
  assert.equal(record.amountCentavos,85000)
  assert.equal(record.order,'Order #1042')
  assert.equal(notification.roomNotificationForAuditEvent({...event,type:'restaurant.payment.received'}),null)
  assert.equal(notification.roomNotificationForAuditEvent({...event,outcome:'Failed'}),null)
  assert.equal(notification.manilaDate('2026-11-17T16:30:00.000Z'),notification.manilaDate('2026-11-18T05:30:00.000Z'))
  assert.match(readFileSync('src/features/restaurant-tables/storage.ts','utf8'),/demoSeedVersion===undefined[\s\S]*roomNotificationForAuditEvent/)
})

test('Front Desk and Administration receive scoped notifications with independent persisted read state',async()=>{
  const records=new Map()
  globalThis.indexedDB={open:()=>{
    const req={}
    queueMicrotask(()=>{
      const db={objectStoreNames:{contains:name=>records.has(name)},
        createObjectStore(name){records.set(name,new Map());return {createIndex(){}}},close(){},
        transaction(name){
          let pending=0,scheduled=false
          const action=fn=>{
            const result={};pending++
            queueMicrotask(()=>{
              try{result.result=fn();result.onsuccess?.()}
              catch(error){result.error=error;result.onerror?.();tx.onabort?.()}
              pending--
              if(pending===0&&!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;if(pending===0)tx.oncomplete?.()})}
            })
            return result
          }
          const tx={objectStore:()=>({
            getAll(){return action(()=>[...records.get(name).values()])},
            get(key){return action(()=>records.get(name).get(key))},
            add(value){return action(()=>{if(records.get(name).has(value.id))throw Error('Duplicate');records.get(name).set(value.id,value)})},
            delete(key){return action(()=>records.get(name).delete(key))}
          })}
          return tx
        }}
      req.result=db;req.onupgradeneeded?.();req.onsuccess?.()
    })
    return req
  }}
  const directory=employees.saveEmployee(employees.saveEmployee(people,
    {fullName:'Luis Ramos',role:'restaurant'},fixed,'demo-restaurant-luis'),
    {fullName:'Sofia Cruz',role:'front-desk'},fixed,'demo-frontdesk-sofia')
  state.set('resortos.employees.v1',JSON.stringify(directory))
  state.set('resortos.permissions.v1',JSON.stringify(permissions))
  const saved=tickets.seedTicketCollection(ui.createSupportTickets(),new Date(fixed))
  const urgent=tickets.createTicket(saved,sofia,permissions,{subject:'Flooding',description:'Water is entering',priority:'Urgent'},new Date(fixed))
  state.set(tickets.SUPPORT_KEY,JSON.stringify(urgent))
  const record={id:'room:ops:1:room.posting.created:s-1',kind:'room-posted',auditEventId:'ops:1:room.posting.created:s-1',
    settlementId:'s-1',room:'Room 205',order:'Order #1042',amountCentavos:85000,by:luis.id,at:fixed}
  const notices=await moduleFor('src/features/notifications/notifications.ts')
  // First read creates the new versioned store; then record a committed posting fixture.
  state.set('resortos.demo.active-account.v1',admin.id)
  assert.deepEqual(await notices.loadNotifications(admin.id),[...await notices.loadNotifications(admin.id)])
  records.get(notification.ROOM_NOTIFICATIONS_STORE).set(record.id,record)
  const adminItems=await notices.loadNotifications(admin.id)
  assert.equal(adminItems.length,2)
  assert.equal(adminItems.find(item=>item.kind==='room-posted').destination,'audit')
  assert.equal(adminItems.find(item=>item.kind==='urgent-support').destination,'support')
  state.set('resortos.demo.active-account.v1',sofia.id)
  const front=await notices.loadNotifications(sofia.id)
  assert.equal(front.length,1)
  assert.equal(front[0].destination,'front-desk-charges')
  await notices.markNotificationRead(sofia.id,[front[0].id])
  assert.equal((await notices.loadNotifications(sofia.id))[0].read,true)
  state.set('resortos.demo.active-account.v1',admin.id)
  assert.equal((await notices.loadNotifications(admin.id)).filter(item=>!item.read).length,2)
  await assert.rejects(()=>notices.markNotificationRead(admin.id,['not-an-authorized-notice']),/cannot modify/)
  state.set('resortos.demo.active-account.v1',luis.id)
  assert.deepEqual(await notices.loadNotifications(luis.id),[])
})

test('file bytes persist in IndexedDB and are downloadable only through the authorized ticket scope',async()=>{
  state.set('resortos.demo.active-account.v1',luis.id)
  const current=tickets.loadTickets(ui.createSupportTickets())
  const created=tickets.createTicket(current,luis,permissions,{subject:'Damage report',description:'Chair broken',priority:'Low'})
  assert.equal(tickets.validTicketCollection(created),true,`Invalid created collection, revision ${current.revision}->${created.revision}, valid tickets: ${created.tickets.map(t=>tickets.validTicket(t))}`)
  tickets.commitTickets(current,created)
  const target=created.tickets[0]
  const file=new File([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3])],'photo.png',{type:'image/png'})
  const stored=await attachments.stageSupportAttachments(target.id,'message-file-test',[file])
  assert.equal(stored.length,1)
  assert.equal(stored[0].mime,'image/png')
  assert.equal(stored[0].size,file.size)
  const committed=tickets.replyTicket(created,luis,permissions,target.id,'',
    new Date(Date.parse(target.createdAt)+60_000),stored,'message-file-test')
  tickets.commitTickets(created,committed)
  const downloaded=await attachments.readSupportAttachment(target.id,'message-file-test',stored[0].id,luis.id)
  assert.deepEqual(new Uint8Array(await downloaded.blob.arrayBuffer()),new Uint8Array(await file.arrayBuffer()))
  state.set('resortos.demo.active-account.v1',sofia.id)
  await assert.rejects(()=>attachments.readSupportAttachment(target.id,'message-file-test',stored[0].id,sofia.id),/denied/)
  state.set('resortos.demo.active-account.v1',admin.id)
  assert.equal((await attachments.readSupportAttachment(target.id,'message-file-test',stored[0].id,admin.id)).name,'photo.png')
  await assert.rejects(()=>attachments.readSupportAttachment(target.id,'message-file-test','another-file',admin.id),/no longer belongs/)
})
