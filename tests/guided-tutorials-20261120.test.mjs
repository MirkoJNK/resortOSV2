import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require=createRequire(import.meta.url)
async function moduleFrom(source) {
  const buildResult=await build({entryPoints:[source],bundle:true,platform:'node',format:'cjs',
    packages:'external',write:false,logLevel:'silent',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"'}})
  const module={exports:{}}
  new Function('module','exports','require',buildResult.outputFiles[0].text)(module,module.exports,require)
  return module.exports
}
const {TUTORIAL_MANIFEST,authorizedTutorialSteps,tutorialWorkspaceForRole,validTutorialManifest}=await moduleFrom('src/features/tutorial/tutorialManifest.ts')
const {TutorialClipGate,cueForStep,cueIndexAt,stepAfterEnded}=await moduleFrom('src/features/tutorial/tutorialTiming.ts')
const {selectPreparedTarget}=await moduleFrom('src/features/tutorial/tutorialTargets.ts')
const {primaryRoleDashboard,authorizedTutorialExitRoute}=await moduleFrom('src/features/tutorial/tutorialExit.ts')
const read=(source)=>readFileSync(source,'utf8')
const all=Object.values(TUTORIAL_MANIFEST).flat()

test('Administration, Restaurant and Front Desk each have exactly seven narrated steps',()=>{
  assert.deepEqual(Object.keys(TUTORIAL_MANIFEST).sort(),['admin','front-desk','restaurant'])
  for(const steps of Object.values(TUTORIAL_MANIFEST))assert.equal(steps.length,7)
  assert.equal(all.length,21)
  assert.equal(new Set(all.map(item=>item.audio)).size,21)
  assert.ok(validTutorialManifest())
})

test('all 21 local MP3 recordings exist, have audio bytes and match the selected workspace',()=>{
  for(const [workspace,steps] of Object.entries(TUTORIAL_MANIFEST)) {
    for(const step of steps) {
      assert.ok(step.audio.startsWith(`/assets/tutorial-audio/${workspace}/`),step.audio)
      const filename=`public${step.audio}`
      assert.ok(statSync(filename).size>10000,filename)
      const bytes=readFileSync(filename).subarray(0,3)
      assert.ok(bytes.toString()==='ID3'||bytes[0]===0xff,`Invalid MP3 header: ${filename}`)
    }
  }
})

test('cue times are strictly ordered, begin at zero and stay inside recorded durations',()=>{
  for(const step of all) {
    assert.equal(step.cues[0].at,0,step.id)
    for(let index=0;index<step.cues.length;index++) {
      const cue=step.cues[index]
      assert.ok(cue.at<step.duration,step.id)
      assert.ok(index===0||cue.at>step.cues[index-1].at,step.id)
      assert.ok(cue.target&&cue.fallback&&cue.text,step.id)
    }
  }
})

test('tutorial uses valid navigable workspace routes, including shared in-page tabs',()=>{
  const expected={admin:['dashboard','dashboard','systems','audit','audit','support','dashboard'],
    restaurant:['restaurant-dashboard','restaurant-dashboard','restaurant-tables','restaurant-tables',
      'restaurant-tables','restaurant-orders','restaurant-dashboard'],
    'front-desk':['front-desk-dashboard','front-desk-dashboard','front-desk-rooms','front-desk-charges',
      'front-desk-checkout','front-desk-checkout','front-desk-dashboard']}
  for(const [workspace,steps] of Object.entries(TUTORIAL_MANIFEST))
    assert.deepEqual(steps.map(item=>item.route),expected[workspace])
  assert.equal(TUTORIAL_MANIFEST.admin[3].cues[0].view,'audit-events')
  assert.equal(TUTORIAL_MANIFEST.admin[4].cues[0].view,'audit-traces')
  assert.equal(TUTORIAL_MANIFEST.restaurant[2].cues[0].view,'tables-floor')
  assert.equal(TUTORIAL_MANIFEST.restaurant[2].cues[1].view,'tables-cards')
  assert.equal(TUTORIAL_MANIFEST.restaurant[3].cues[0].view,'tables-reservations')
  assert.equal(TUTORIAL_MANIFEST.restaurant[5].cues.at(-1).view,'orders-history')
  assert.equal(TUTORIAL_MANIFEST['front-desk'][4].cues[0].view,'checkout-current')
  assert.equal(TUTORIAL_MANIFEST['front-desk'][5].cues[0].view,'checkout-history')
})

test('workspace route restrictions omit unauthorized narrated destinations',()=>{
  for(const workspace of Object.keys(TUTORIAL_MANIFEST)) {
    const only=TUTORIAL_MANIFEST[workspace][0].route
    assert.deepEqual(authorizedTutorialSteps(workspace,route=>route===only).map(step=>step.route),
      TUTORIAL_MANIFEST[workspace].filter(step=>step.route===only).map(step=>step.route))
    assert.equal(authorizedTutorialSteps(workspace,()=>false).length,0)
  }
})

test('primary role alone selects Admin, Restaurant or Front Desk narration',()=>{
  assert.equal(tutorialWorkspaceForRole('super-admin'),'admin')
  assert.equal(tutorialWorkspaceForRole('admin'),'admin')
  assert.equal(tutorialWorkspaceForRole('restaurant'),'restaurant')
  assert.equal(tutorialWorkspaceForRole('front-desk'),'front-desk')
  const app=read('src/App.tsx')
  assert.match(app,/tutorialWorkspaceForRole\(activeAccount\.role\)/)
  assert.match(app,/authorizedTutorialSteps\(workspace,canAccess\)/)
  assert.match(app,/primaryRole:activeAccount\.role/)
  assert.doesNotMatch(app,/authorizedTutorialSteps\(activeWorkspace/)
})

test('Restaurant employee with an Administration grant still receives Restaurant-only tour pages',async()=>{
  const {canAccessRoute}=await moduleFrom('src/features/demo/access.ts')
  const employees=await moduleFrom('src/features/employees/model.ts')
  const directory=employees.saveEmployee(employees.emptyEmployeeDirectory(),
    {fullName:'Example Employee',role:'restaurant'},'2026-11-20T00:00:00Z','restaurant-with-admin-grant')
  const employee=directory.employees.find(item=>item.id==='restaurant-with-admin-grant')
  const permissions={version:1,revision:4,subroles:[],events:[],access:[{employeeId:employee.id,
    grants:['administration.audit.view'],restrictions:['restaurant.orders.view'],subroles:[]}]}
  assert.equal(canAccessRoute(permissions,employee,'audit'),true,'Admin grant really works')
  const tutorial=tutorialWorkspaceForRole(employee.role)
  assert.equal(tutorial,'restaurant')
  const authorized=authorizedTutorialSteps(tutorial,route=>canAccessRoute(permissions,employee,route))
  assert.ok(authorized.length>0)
  assert.ok(authorized.every(step=>step.route.startsWith('restaurant-')))
  assert.ok(authorized.every(step=>step.route!=='restaurant-orders'),'restricted Orders page is omitted')
  assert.ok(!authorized.some(step=>step.route==='audit'),'additional Admin grant does not switch tutorial')
})

test('visual focus follows media currentTime, not wall-clock elapsed time',()=>{
  const cues=TUTORIAL_MANIFEST.admin[1].cues
  assert.equal(cueIndexAt(cues,0),0)
  assert.equal(cueIndexAt(cues,8.999),0)
  assert.equal(cueIndexAt(cues,9),1)
  assert.equal(cueIndexAt(cues,18.99),1)
  assert.equal(cueIndexAt(cues,19),2)
  assert.equal(cueIndexAt(cues,NaN),0)
})

test('the next clip is selected only after an accepted media-ended event',()=>{
  const steps=TUTORIAL_MANIFEST.restaurant
  const gate=new TutorialClipGate()
  assert.equal(stepAfterEnded(steps,0),1)
  assert.equal(gate.ended(),true)
  assert.equal(gate.ended(),false)
  assert.equal(stepAfterEnded(steps,steps.length-1),null)
})

test('Restaurant Dashboard to Tables cannot crash with a stale cue index',async()=>{
  const dashboard=TUTORIAL_MANIFEST.restaurant[1]
  const tables=TUTORIAL_MANIFEST.restaurant[2]
  assert.equal(dashboard.cues.length,3)
  assert.equal(tables.cues.length,2)
  const stalePosition={stepIndex:1,index:2}
  assert.equal(tables.cues[stalePosition.index],undefined,'regression reproduces the undefined-cue crash')
  const firstCue=cueForStep(tables,2,stalePosition)
  assert.strictEqual(firstCue,tables.cues[0], 'new narration must start at its first cue')
  const React=require('react')
  const {renderToStaticMarkup}=require('react-dom/server')
  const {TutorialOverlay}=await moduleFrom('src/features/tutorial/TutorialOverlay.tsx')
  assert.throws(()=>renderToStaticMarkup(React.createElement(TutorialOverlay,{workspace:'restaurant',step:tables,
    stepNumber:3,total:7,cue:tables.cues[stalePosition.index],status:'preparing',error:'',onSkip:()=>{},onEnableAudio:()=>{}})),
  /reading 'target'/,'the old index reproduces the React render exception')
  const markup=renderToStaticMarkup(React.createElement(TutorialOverlay,{workspace:'restaurant',step:tables,
    stepNumber:3,total:7,cue:firstCue,status:'preparing',error:'',onSkip:()=>{},onEnableAudio:()=>{}}))
  assert.match(markup,/Tables and floor plan/)
  assert.match(markup,/Skip tutorial/)
  assert.match(read('src/features/tutorial/TutorialController.tsx'),/cue=\{cueForStep\(step,stepIndex,cuePosition\)\}/)
})

test('every Admin, Restaurant and Front Desk clip transition safely resets the cue to zero',()=>{
  for(const [workspace,steps] of Object.entries(TUTORIAL_MANIFEST)){
    for(let nextIndex=1;nextIndex<steps.length;nextIndex++){
      const previous=steps[nextIndex-1]
      const next=steps[nextIndex]
      const stale={stepIndex:nextIndex-1,index:previous.cues.length-1}
      assert.strictEqual(cueForStep(next,nextIndex,stale),next.cues[0],`${workspace} transition ${nextIndex}`)
      assert.strictEqual(cueForStep(next,nextIndex,{stepIndex:nextIndex,index:0}),next.cues[0])
      assert.ok(next.cues[0].target,`${workspace} has no first target`)
    }
  }
})

test('all final feature to dashboard transitions render the first highlight before completion audio',()=>{
  const endScenes={
    admin:{from:'support',to:'dashboard',target:'admin-dashboard-overview'},
    restaurant:{from:'restaurant-orders',to:'restaurant-dashboard',target:'restaurant-dashboard-overview'},
    'front-desk':{from:'front-desk-checkout',to:'front-desk-dashboard',target:'front-desk-dashboard-overview'}
  }
  const code=read('src/features/tutorial/TutorialController.tsx')
  assert.match(code,/const isCompletionStep=stepIndex===steps\.length-1/)
  assert.match(code,/routeRef\.current===step\.route,aborter\.signal,8500,isCompletionStep/)
  assert.match(code,/if\(!target\)\{[\s\S]*?setStatus\('error'\)/)
  assert.match(code,/await afterPaint\(\)[\s\S]*?void beginPlayback\(\)/)
  for(const [workspace,spec] of Object.entries(endScenes)){
    const scenes=TUTORIAL_MANIFEST[workspace]
    const final=scenes.at(-1),previous=scenes.at(-2)
    assert.equal(previous.route,spec.from)
    assert.equal(final.route,spec.to)
    assert.equal(final.cues[0].target,spec.target)
    assert.ok(previous.cues.length>=2)
    assert.equal(final.cues.length,2)
    assert.strictEqual(cueForStep(final,6,{stepIndex:5,index:previous.cues.length-1}),final.cues[0])
  }
})

test('final dashboard playback refuses an unavailable highlight even when the generic shell is mounted',()=>{
  const shell={id:'main-content'}
  const dashboard={id:'dashboard-overview'}
  assert.equal(selectPreparedTarget(null,shell,true),null)
  assert.equal(selectPreparedTarget(dashboard,shell,true),dashboard)
  assert.equal(selectPreparedTarget(null,shell,false),shell)
})

test('a stalled clip cannot advance; duplicate and late ended events do not restart it',()=>{
  const audio=new EventTarget()
  let advanced=0
  const gate=new TutorialClipGate()
  audio.addEventListener('ended',()=>{if(gate.ended())advanced++})
  for(let index=0;index<100;index++)audio.dispatchEvent(new Event('timeupdate'))
  assert.equal(advanced,0)
  audio.dispatchEvent(new Event('ended'))
  audio.dispatchEvent(new Event('ended'))
  assert.equal(advanced,1)
  gate.cancel()
  audio.dispatchEvent(new Event('ended'))
  assert.equal(advanced,1)
})

test('skip cancels the pending clip before an ended event, including a rapid skip',()=>{
  const gate=new TutorialClipGate()
  gate.cancel();gate.cancel()
  assert.equal(gate.ended(),false)
  const replayGate=new TutorialClipGate()
  assert.equal(replayGate.ended(),true)
})

test('Help Center is the exclusive explicit Start Tutorial entry point',()=>{
  const help=read('src/features/help/HelpCenter.tsx')
  const app=read('src/App.tsx')
  assert.match(help,/>Start Tutorial</)
  assert.match(help,/onClick=\{onStartTutorial\}/)
  assert.match(app,/if\(area!=='help'/)
  assert.match(app,/case 'help':/)
  assert.match(app,/onStartTutorial=\{startTutorial\}/)
  assert.doesNotMatch(read('src/shell/Sidebar.tsx'),/Start Tutorial/)
})

test('the single media controller advances on ended and never by a duration timer',()=>{
  const controller=read('src/features/tutorial/TutorialController.tsx')
  assert.match(controller,/new Audio\(\)/)
  assert.match(controller,/audio\.play\(\)/)
  assert.match(controller,/audio\.currentTime/)
  assert.match(controller,/audio\.addEventListener\('ended'/)
  assert.match(controller,/if\(stale\(\)\|\|mediaFailed\|\|!clipGate\.ended\(\)\)return/)
  assert.match(controller,/waitForTourTarget/)
  assert.match(controller,/audio\.pause\(\)/)
  assert.match(controller,/document\.hidden/)
  assert.doesNotMatch(controller,/setTimeout\([^)]*step\.duration/)
})

test('tour navigation uses the existing authorization, dirty and busy guards',()=>{
  const app=read('src/App.tsx')
  assert.match(app,/authorizedTutorialSteps\(workspace,canAccess\)/)
  assert.match(app,/tutorialSession\.permissionsRevision!==demoPermissions\.revision/)
  assert.match(app,/!canAccess\(route\)/)
  assert.match(app,/workspaceForRoute\(route\)!==tutorialSession\.workspace/)
  assert.match(app,/if\(area!==route\)\{/)
  assert.match(app,/history\.replaceState\(null,'',hashForRoute\(route\)\)/)
  assert.match(app,/activeDirty \|\| activeSaveBusy/)
})

test('all in-page tutorial overrides are read-only view selectors',()=>{
  const files=[
    ['src/features/audit-log/AuditLog.tsx',/tutorialTab\?\?tab/],
    ['src/features/restaurant-tables/RestaurantTables.tsx',/tutorialView\?\?view/],
    ['src/features/restaurant-orders/RestaurantOrders.tsx',/tutorialTab\?\?tab/],
    ['src/features/front-desk/FrontDeskCheckout.tsx',/tutorialTab\?\?activeTab/]
  ]
  for(const [file,pattern] of files)assert.match(read(file),pattern,file)
  assert.match(read('src/features/restaurant-tables/RestaurantTables.tsx'),/if\(!tutorialReadOnly\)await seedDemoMenuIfFirstUse/)
  assert.match(read('src/App.tsx'),/inert=\{!!tutorialSession\}/)
})

test('underlying main, sidebar, forms and controls are inert during narration; only Skip responds',async()=>{
  const React=require('react')
  const {renderToStaticMarkup}=require('react-dom/server')
  const {TutorialOverlay}=await moduleFrom('src/features/tutorial/TutorialOverlay.tsx')
  const step=TUTORIAL_MANIFEST.restaurant[1]
  const overlay=renderToStaticMarkup(React.createElement(TutorialOverlay,{workspace:'restaurant',
    step,stepNumber:2,total:7,cue:step.cues[0],status:'playing',error:'',onSkip:()=>{},onEnableAudio:()=>{}}))
  assert.match(overlay,/role="dialog" aria-modal="true"/)
  assert.match(overlay,/class="tour-interaction-shield"/)
  assert.match(overlay,/>Skip tutorial</)
  assert.equal((overlay.match(/<button\b/g)??[]).length,1,'only Skip is interactive while narration runs')
  const shell=read('src/App.tsx')
  assert.match(shell,/<main className="main-shell" inert=\{!!tutorialSession\}/)
  assert.match(shell,/<Sidebar\s+\n?\s*tutorialActive=\{!!tutorialSession\}/)
  assert.match(read('src/shell/Sidebar.tsx'),/inert=\{tutorialActive\}/)
  assert.match(read('src/features/tutorial/tutorial.css'),/\.tour-interaction-shield\{position:absolute;inset:0;pointer-events:auto/)
  assert.match(shell,/if\(!tutorialSession\)setSearchOpen\(true\)/)
})

test('tour storage reads bypass demo seeding, audit upgrades and finance migrations',()=>{
  assert.match(read('src/features/restaurant-tables/storage.ts'),/if\(!initializeDemo\)return current/)
  assert.match(read('src/features/menu-categories/storage.ts'),/!wasInitialized && initializeDemo/)
  assert.match(read('src/features/discount-management/storage.ts'),/migrate\?'readwrite':'readonly'/)
  assert.match(read('src/features/audit-log/storage.ts'),/if\(upgradeFixtures\)operational=await upgradeSimulatedFixtureActors/)
  const features=[
    'src/features/dashboard/Dashboard.tsx','src/features/audit-log/AuditLog.tsx',
    'src/features/restaurant/RestaurantDashboard.tsx','src/features/restaurant-tables/RestaurantTables.tsx',
    'src/features/restaurant-orders/RestaurantOrders.tsx','src/features/front-desk/FrontDeskDashboard.tsx',
    'src/features/front-desk/FrontDeskRooms.tsx','src/features/front-desk/FrontDeskCharges.tsx',
    'src/features/front-desk/FrontDeskCheckout.tsx'
  ]
  for(const file of features)assert.match(read(file),/loadOperations\(!tutorialReadOnly\)/,file)
})

test('finishing or skipping uses one idempotent, primary-role dashboard exit path',()=>{
  const app=read('src/App.tsx')
  assert.match(app,/onSkip=\{finishTutorial\} onComplete=\{finishTutorial\} onAbort=\{finishTutorial\}/)
  assert.match(app,/exitedTutorial\.current===session\.id/)
  assert.match(app,/exitedTutorial\.current=session\.id/)
  assert.match(app,/authorizedTutorialExitRoute\(session\.primaryRole,canAccess/)
  assert.match(app,/setTutorialSession\(null\)/)
  assert.match(app,/setTutorialPresentation\(null\)/)
  assert.match(app,/setWorkspaceTransition\(null\)/)
  assert.match(app,/history\.replaceState\(null,'',hashForRoute\(destination\)\)/)
  assert.match(app,/setActiveWorkspace\(destinationWorkspace\)/)
  assert.match(app,/setArea\(destination\)/)
  assert.doesNotMatch(app,/stopTutorial\(true\)|stopTutorial\(false\)/)
})

test('all primary assigned roles exit to their dashboard regardless of grants or selected workspace',()=>{
  for(const [role,expected] of Object.entries({
    'super-admin':'dashboard',admin:'dashboard',restaurant:'restaurant-dashboard','front-desk':'front-desk-dashboard'})){
    assert.equal(primaryRoleDashboard(role),expected)
    assert.equal(authorizedTutorialExitRoute(role,route=>route===expected,null),expected)
  }
})

test('revoked dashboard access cannot be bypassed when the narration ends',()=>{
  const crossRoleFallback='audit'
  assert.equal(authorizedTutorialExitRoute('restaurant',route=>route==='audit',crossRoleFallback),'audit')
  assert.equal(authorizedTutorialExitRoute('restaurant',()=>false,crossRoleFallback),null)
  assert.equal(authorizedTutorialExitRoute('restaurant',route=>route==='restaurant-dashboard',crossRoleFallback),
    'restaurant-dashboard')
})

test('Skip is in a body portal, above the interaction shield and outside the inert app shell',()=>{
  const overlay=read('src/features/tutorial/TutorialOverlay.tsx')
  const css=read('src/features/tutorial/tutorial.css')
  assert.match(overlay,/createPortal\(content,document\.body\)/)
  assert.match(overlay,/onClick=\{onSkip\}/)
  assert.match(overlay,/ref=\{skipRef\}/)
  assert.match(css,/\.tour-overlay\{position:fixed;inset:0;z-index:2147483647;/)
  assert.match(css,/\.tour-interaction-shield\{position:absolute;inset:0;pointer-events:auto/)
  assert.match(css,/\.tour-skip\{position:fixed;[^}]*z-index:2;[^}]*pointer-events:auto/)
  assert.match(read('src/shell/WorkspaceTransitionOverlay.tsx'),/shell\.inert = true/)
})

test('Skip cancels audio and outstanding ended transitions at every possible stage',()=>{
  const controller=read('src/features/tutorial/TutorialController.tsx')
  assert.match(controller,/generation\.current\+\+\s*\n\s*audioRef\.current\?\.pause\(\)/)
  assert.match(controller,/handlers\.current\.onSkip\(\)/)
  assert.match(controller,/clipGate\.cancel\(\)/)
  assert.match(controller,/aborter\.abort\(\)/)
  assert.match(controller,/window\.clearTimeout\(endingTimer\)/)
  for(const stepIndex of [0,1,3,6]){
    const gate=new TutorialClipGate()
    gate.cancel()
    assert.equal(gate.ended(),false,`late ended callback accepted at step ${stepIndex}`)
  }
})

test('tutorial navigation never opens the full-screen workspace loader or leaves its inert lock behind',()=>{
  const app=read('src/App.tsx')
  assert.match(app,/if\(tutorialSession\)setWorkspaceTransition\(null\)/)
  assert.match(app,/if\(area!==route\)\{[\s\S]*?setWorkspaceTransition\(null\)[\s\S]*?setArea\(route\)/)
  assert.match(app,/const finishTutorial=\(\)=>\{[\s\S]*?setWorkspaceTransition\(null\)/)
  assert.match(app,/setWorkspaceTransition\(null\)\s*\n\s*setTutorialSession\(/)
})

test('all spotlight targets and fallbacks are present in the project and never dynamic DOM clicks',()=>{
  const sources=['src/App.tsx','src/shell/Sidebar.tsx','src/shell/HelpMenu.tsx',
    'src/features/dashboard/Dashboard.tsx','src/features/system-management/SystemManagement.tsx',
    'src/features/audit-log/AuditLog.tsx','src/components/SupportWorkspace.tsx',
    'src/features/restaurant/RestaurantDashboard.tsx','src/features/restaurant-tables/RestaurantTables.tsx',
    'src/features/restaurant-tables/TableOverviews.tsx','src/features/restaurant-tables/Reservations.tsx',
    'src/features/restaurant-orders/RestaurantOrders.tsx','src/features/front-desk/FrontDeskDashboard.tsx',
    'src/features/front-desk/FrontDeskRooms.tsx','src/features/front-desk/FrontDeskCharges.tsx',
    'src/features/front-desk/FrontDeskCheckout.tsx','src/features/front-desk/CheckoutHistoryPanel.tsx']
  const markup=sources.map(read).join('\n')
  for(const step of all)for(const mark of step.cues)for(const target of [mark.target,mark.fallback])
    assert.ok(markup.includes(`data-tour-target="${target}"`) ||
      (target.startsWith('restaurant-orders-')&&markup.includes(`'${target}'`)),`${step.id}: missing ${target}`)
  assert.doesNotMatch(read('src/features/tutorial/TutorialController.tsx'),/\.click\(\)/)
})

test('GitHub Pages base uses the existing repository name while local assets use Vite BASE_URL',()=>{
  const vite=read('vite.config.ts')
  assert.match(vite,/buildEnvironment\.GITHUB_REPOSITORY/)
  assert.match(vite,/buildEnvironment\.GITHUB_ACTIONS/)
  assert.match(vite,/buildEnvironment\.RESORTOS_PAGES_BASE/)
  assert.match(vite,/return repository\[1\]\.toLowerCase\(\)\.endsWith\('\.github\.io'\)\?'\/':`\/\$\{repository\[1\]\}\/`/)
  assert.match(read('src/shell/assets.ts'),/import\.meta\.env\.BASE_URL/)
  assert.doesNotMatch(read('src/features/tutorial/tutorialManifest.ts'),/localhost|127\.0\.0\.1/)
})
