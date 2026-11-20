import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Store } from './domain/types'
import { routeFromHash, workspaceForRoute, hashForRoute, restaurantNav, frontDeskNav, primaryNav } from './shell/navigation'
import type { AppRoute, Department } from './shell/navigation'
import { Sidebar } from './shell/Sidebar'
import { Topbar } from './shell/Topbar'
import { GlobalSearch } from './shell/GlobalSearch'
import { loadStore } from './domain/store'
import { qualityScenario, qualityStore, qualitySupportTickets } from './data/qualityFixtures'
import { SupportWorkspace, createSupportTickets } from './components/SupportWorkspace'
import type { SupportChange } from './components/SupportWorkspace'
import { HelpCenter } from './features/help/HelpCenter'
import { TutorialController } from './features/tutorial/TutorialController'
import { authorizedTutorialSteps, tutorialWorkspaceForRole } from './features/tutorial/tutorialManifest'
import type { TutorialStep, TutorialView } from './features/tutorial/tutorialManifest'
import { authorizedTutorialExitRoute } from './features/tutorial/tutorialExit'
import './features/tutorial/tutorial.css'
import { SUPPORT_EVENT, SUPPORT_KEY, actorForMutation, commitTickets, createTicket, loadTickets,
  manageTicket, replyTicket, seedTicketCollection, supportScopeForContext, canSeeTicket } from './features/support/tickets'
import {stageSupportAttachments,removeSupportAttachments,cleanupOrphanedSupportAttachments} from './features/support/attachments'
import type {Notification} from './features/notifications/model'
import type { SupportContext, TicketCollection } from './features/support/tickets'
import { Dashboard } from './features/dashboard/Dashboard'
import { SystemManagement } from './features/system-management/SystemManagement'
import { TablesManager } from './features/tables-manager/TablesManager'
import { RoomsManager } from './features/rooms-manager/RoomsManager'
import { PaymentMethods } from './features/payment-methods/PaymentMethods'
import { Employees } from './features/employees/Employees'
import { DiscountManagement } from './features/discount-management/DiscountManagement'
import { ReceiptSettings } from './features/receipt-settings/ReceiptSettings'
import { ReceiptBuilder } from './features/receipt-builder/ReceiptBuilder'
import { ServiceCatalog } from './features/service-catalog/ServiceCatalog'
import { MenuCategories } from './features/menu-categories/MenuCategories'
import { MenuManagement } from './features/menu-management/MenuManagement'
import { RestaurantDashboard } from './features/restaurant/RestaurantDashboard'
import { FrontDeskDashboard } from './features/front-desk/FrontDeskDashboard'
import { FrontDeskRooms } from './features/front-desk/FrontDeskRooms'
import { FrontDeskCharges } from './features/front-desk/FrontDeskCharges'
import { FrontDeskCheckout } from './features/front-desk/FrontDeskCheckout'
import { RestaurantTables } from './features/restaurant-tables/RestaurantTables'
import { RestaurantOrders } from './features/restaurant-orders/RestaurantOrders'
import { WorkspaceTransitionOverlay } from './shell/WorkspaceTransitionOverlay'
import { nextWorkspaceTransition, prefersReducedWorkspaceMotion, scheduleWorkspaceTransitionEnd } from './shell/workspaceTransition'
import { DiscardChangesDialog } from './shared/useDiscardConfirmation'
import { EMPLOYEES_EVENT, EMPLOYEES_STORAGE_KEY, readEmployees } from './features/employees/storage'
import { PERMISSIONS_EVENT, PERMISSIONS_STORAGE_KEY, readPermissions } from './features/roles-permissions/storage'
import { ensureDemoIdentityFixtures } from './features/demo/seed'
import { ACTIVE_DEMO_ACCOUNT_KEY, availableWorkspaces, canAccessRoute, preferredRoute, readActiveDemoAccount } from './features/demo/access'
import { hasPermission } from './features/roles-permissions/model'
import { systemAdministrator } from './features/employees/model'
import type { EmployeeRole } from './features/employees/model'

const RolesPermissions = lazy(() => import('./features/roles-permissions/RolesPermissions')
  .then(module => ({default: module.RolesPermissions})))
const AuditLog = lazy(() => import('./features/audit-log/AuditLog')
  .then(module => ({default: module.AuditLog})))

type TutorialSession = {
  id:number; workspace:Department; primaryRole:EmployeeRole; accountId:string; permissionsRevision:number; steps:readonly TutorialStep[]
}

/** Stable, appropriately sized Suspense shell: a cold module load never swaps a bare title for a full page. */
function ManagementPageFallback({kind}:{kind:'audit'|'permissions'}) {
  const audit=kind==='audit'
  return <section className={`ros-management-loading ${audit?'al-page':'rp-page'}`} aria-busy="true"
    aria-label={`${audit?'Audit Log':'Roles & Permissions'} loading`}>
    <div className={`fd-charges-heading${audit?' ros-admin-heading':''}`}><h1>{audit?'Audit Log':'Roles & Permissions'}</h1></div>
    <div className="ros-management-loading-tabs" aria-hidden="true"><span/><span/></div>
    <div className="ros-management-loading-surface" aria-hidden="true">
      <span className="ros-management-loading-line"/><span className="ros-management-loading-line short"/>
    </div>
    <span className="rt-sr-only" role="status">Loading {audit?'audit history':'employee permissions'}</span>
  </section>
}

export function App() {
  const [demoDirectory,setDemoDirectory] = useState(() => readEmployees().data)
  const [demoPermissions,setDemoPermissions] = useState(() => readPermissions().data)
  const [accountId,setAccountId] = useState(() => readActiveDemoAccount(readEmployees().data).id)
  const [demoError,setDemoError] = useState('')
  const [pendingAccountId,setPendingAccountId] = useState<string|null>(null)
  const activeAccount = demoDirectory.employees.find(item => item.id === accountId && item.active) ?? systemAdministrator()
  const canAccess = (route: AppRoute) => canAccessRoute(demoPermissions,activeAccount,route)
  const allowedWorkspaces = availableWorkspaces(demoPermissions,activeAccount)
  const [area, setArea] = useState<AppRoute>(routeFromHash)
  const [activeWorkspace,setActiveWorkspace] = useState<Department>(() =>
    workspaceForRoute(routeFromHash()) ??
    (activeAccount.role==='restaurant'?'restaurant':activeAccount.role==='front-desk'?'front-desk':'admin'))
  const [workspaceTransition, setWorkspaceTransition] = useState<ReturnType<typeof nextWorkspaceTransition>>(null)
  const [ordersNavigationActivation, setOrdersNavigationActivation] = useState(0)
  const [tablesNavigationActivation, setTablesNavigationActivation] = useState(0)
  const [chargesNavigationActivation, setChargesNavigationActivation] = useState(0)
  const [checkoutNavigationActivation, setCheckoutNavigationActivation] = useState(0)
  const [store] = useState<Store>(loadStore)
  const [initialSupport] = useState(() => {
    try {return {data:loadTickets(createSupportTickets()),error:''}}
    catch (reason) {return {data:seedTicketCollection(createSupportTickets()),
      error:reason instanceof Error?reason.message:'Could not read support tickets'}}
  })
  const [supportData,setSupportData] = useState<TicketCollection>(initialSupport.data)
  const [supportError,setSupportError] = useState(initialSupport.error)
  const supportTickets = supportData.tickets
  const [helpContext,setHelpContext] = useState<AppRoute>(()=>routeFromHash())
  const [helpFocusSearch,setHelpFocusSearch] = useState(false)
  const [focusTutorialStart,setFocusTutorialStart] = useState(false)
  const [tutorialSession,setTutorialSession] = useState<TutorialSession|null>(null)
  const [tutorialPresentation,setTutorialPresentation] = useState<{route:AppRoute;view?:TutorialView}|null>(null)
  const tutorialSequence=useRef(0)
  const exitedTutorial=useRef<number|null>(null)
  const [ticketArticleId,setTicketArticleId] = useState<string|null>(null)
  const [notificationTicketId,setNotificationTicketId]=useState<string|null>(null)
  const [notificationSettlementId,setNotificationSettlementId]=useState<string|null>(null)
  const [notificationAuditEventId,setNotificationAuditEventId]=useState<string|null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tablesDirty, setTablesDirty] = useState(false)
  const [supportDirty, setSupportDirty] = useState(false)
  const [activeSaveBusy, setActiveSaveBusy] = useState(false)
  const [roomsDirty, setRoomsDirty] = useState(false)
  const [servicesDirty, setServicesDirty] = useState(false)
  const [paymentMethodsDirty, setPaymentMethodsDirty] = useState(false)
  const [employeesDirty, setEmployeesDirty] = useState(false)
  const [permissionsDirty, setPermissionsDirty] = useState(false)
  const [discountsDirty, setDiscountsDirty] = useState(false)
  const [receiptSettingsDirty,setReceiptSettingsDirty] = useState(false)
  const [receiptBuilderDirty,setReceiptBuilderDirty] = useState(false)
  const [categoriesDirty, setCategoriesDirty] = useState(false)
  const [itemsDirty, setItemsDirty] = useState(false)
  const [restaurantTablesDirty, setRestaurantTablesDirty] = useState(false)
  const [frontDeskRoomsDirty, setFrontDeskRoomsDirty] = useState(false)
  const [frontDeskChargesDirty, setFrontDeskChargesDirty] = useState(false)
  const [frontDeskCheckoutDirty, setFrontDeskCheckoutDirty] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<AppRoute | null>(null)
  const approvedHashChange = useRef(false)
  useEffect(() => {
    const refresh = () => {
      const directory = readEmployees(), permissions = readPermissions()
      if (directory.error || permissions.error) {setDemoError(directory.error ?? permissions.error ?? 'Unable to load demo accounts');return}
      setDemoDirectory(directory.data);setDemoPermissions(permissions.data)
      const selected=readActiveDemoAccount(directory.data)
      try {
        if (localStorage.getItem(ACTIVE_DEMO_ACCOUNT_KEY)!==selected.id)
          localStorage.setItem(ACTIVE_DEMO_ACCOUNT_KEY,selected.id)
      } catch {setDemoError('Could not remember the active account')}
      setAccountId(selected.id)
      setPendingAccountId(current => current && !directory.data.employees.some(employee => employee.id===current && employee.active) ? null : current)
    }
    try {ensureDemoIdentityFixtures();setDemoError('')} catch (cause) {setDemoError(cause instanceof Error?cause.message:'Demo accounts could not be initialized')}
    refresh()
    const storage = (event: StorageEvent) => {
      if ([EMPLOYEES_STORAGE_KEY,PERMISSIONS_STORAGE_KEY,ACTIVE_DEMO_ACCOUNT_KEY].includes(event.key??'')) refresh()
    }
    window.addEventListener('storage',storage)
    window.addEventListener(EMPLOYEES_EVENT,refresh)
    window.addEventListener(PERMISSIONS_EVENT,refresh)
    return () => {window.removeEventListener('storage',storage);window.removeEventListener(EMPLOYEES_EVENT,refresh);window.removeEventListener(PERMISSIONS_EVENT,refresh)}
  },[])
  useEffect(()=>{
    const refresh=()=>{
      try {const latest=loadTickets(createSupportTickets());setSupportData(latest);setSupportError('')}
      catch(reason){setSupportError(reason instanceof Error?reason.message:'Support data is unavailable')}
    }
    const storage=(event:StorageEvent)=>{if(event.key===SUPPORT_KEY)refresh()}
    window.addEventListener('storage',storage);window.addEventListener(SUPPORT_EVENT,refresh)
    return ()=>{window.removeEventListener('storage',storage);window.removeEventListener(SUPPORT_EVENT,refresh)}
  },[])
  useEffect(()=>{void cleanupOrphanedSupportAttachments().catch(()=>{ /* Do not alter ticket state if attachment storage is unavailable. */ })},[])
  useEffect(() => {
    if (canAccess(area)) return
    const fallback = preferredRoute(demoPermissions, activeAccount)
    if (fallback) {
      const destination=workspaceForRoute(fallback)
      if(destination&&destination!==activeWorkspace)setActiveWorkspace(destination)
      history.replaceState(null,'',hashForRoute(fallback));setArea(fallback)
    }
  },[area,accountId,demoPermissions,demoDirectory,activeWorkspace])
  const activeDirty = area === 'support' || area === 'employee-support' ? supportDirty : area === 'tables' ? tablesDirty : area === 'rooms' ? roomsDirty :
    area === 'services' ? servicesDirty : area === 'payment-methods' ? paymentMethodsDirty : area === 'employees' ? employeesDirty : area === 'roles-permissions' ? permissionsDirty :
    area === 'discounts' ? discountsDirty : area === 'receipt-settings' ? receiptSettingsDirty : area === 'receipt-builder' ? receiptBuilderDirty :
    area === 'menu-categories' ? categoriesDirty : area === 'menu' ? itemsDirty :
    area === 'restaurant-tables' ? restaurantTablesDirty : area === 'front-desk-rooms' ? frontDeskRoomsDirty :
    area === 'front-desk-charges' ? frontDeskChargesDirty : area === 'front-desk-checkout' ? frontDeskCheckoutDirty : false
  useEffect(()=>{
    if(!tutorialSession)return
    if(tutorialSession.accountId!==accountId || tutorialSession.primaryRole!==activeAccount.role ||
      tutorialSession.permissionsRevision!==demoPermissions.revision ||
      !activeAccount.active || tutorialSession.steps.some(step=>!canAccessRoute(demoPermissions,activeAccount,step.route)) ||
      activeDirty || activeSaveBusy || pendingNavigation || pendingAccountId){
      setTutorialSession(null)
      setTutorialPresentation(null)
    }
  },[tutorialSession,accountId,demoPermissions,activeAccount,activeDirty,activeSaveBusy,pendingNavigation,pendingAccountId])
  useEffect(() => {
    const h = () => {
      const next = routeFromHash()
      if (!canAccess(next)) {
        history.replaceState(null,'',hashForRoute(area))
        return
      }
      if (approvedHashChange.current) approvedHashChange.current = false
      else if (next !== area && activeSaveBusy) {
        history.replaceState(null, '', hashForRoute(area))
        return
      }
      else if (next !== area && activeDirty) {
        // The hash may already have changed through browser Back or an external link.
        // Restore the address immediately, then offer an explicit reversible choice.
        history.replaceState(null, '', hashForRoute(area))
        setPendingNavigation(next)
        return
      }
      // Unknown Front Desk paths resolve within Front Desk, never to an Admin page.
      if (next === 'front-desk-dashboard' && location.hash !== '#/front-desk/dashboard') {
        history.replaceState(null, '', '#/front-desk/dashboard')
      }
      // Unimplemented Restaurant paths must not become a misleading URL or an Admin page.
      if (next === 'restaurant-dashboard' && location.hash !== '#/restaurant/dashboard') {
        history.replaceState(null, '', '#/restaurant/dashboard')
      }
      const destination=workspaceForRoute(next)
      if(destination && destination!==activeWorkspace){
        // Guided navigation is already shown behind the tutorial scrim. Its loader
        // must never obscure or make the Skip control inert.
        if(tutorialSession)setWorkspaceTransition(null)
        else setWorkspaceTransition(current => nextWorkspaceTransition(current,activeWorkspace,destination,prefersReducedWorkspaceMotion()))
        setActiveWorkspace(destination)
      }
      setArea(next)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    if (area === 'front-desk-dashboard' && location.hash !== '#/front-desk/dashboard') {
      history.replaceState(null, '', '#/front-desk/dashboard')
    }
    if (area === 'restaurant-dashboard' && location.hash !== '#/restaurant/dashboard') {
      history.replaceState(null, '', '#/restaurant/dashboard')
    }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [area, activeWorkspace, activeDirty, activeSaveBusy, demoPermissions, demoDirectory, accountId, tutorialSession])
  useEffect(() => {
    if (!activeDirty) return
    const protectRefresh = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protectRefresh)
    return () => window.removeEventListener('beforeunload', protectRefresh)
  }, [activeDirty])
  // A single timer owns each accepted workspace transition; interrupted transitions clean up.
  useEffect(() => {
    if (!workspaceTransition) return
    const transitionId = workspaceTransition.id
    return scheduleWorkspaceTransitionEnd(() => {
      setWorkspaceTransition(current => current?.id === transitionId ? null : current)
    })
  }, [workspaceTransition])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => {
      if (preference.matches) setWorkspaceTransition(null)
    }
    preference.addEventListener('change', onChange)
    return () => preference.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if(!tutorialSession)setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [tutorialSession])
  useEffect(() => {
    if (!menuOpen) return
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
    }
  }, [menuOpen])
  const navigateAccepted = (a: AppRoute) => {
    const nextHash = hashForRoute(a)
    if (location.hash !== nextHash) { approvedHashChange.current = true; location.hash = nextHash }
    else {
      if (a === 'restaurant-tables') setTablesNavigationActivation(n => n + 1)
      if (a === 'restaurant-orders') setOrdersNavigationActivation(n => n + 1)
      if (a === 'front-desk-charges') setChargesNavigationActivation(n => n + 1)
      if (a === 'front-desk-checkout') setCheckoutNavigationActivation(n => n + 1)
      setArea(a)
    }
  }
  const go = (a: AppRoute) => {
    if (pendingNavigation || activeSaveBusy) return
    if (pendingAccountId || !canAccess(a)) return
    if (activeDirty && (a !== area || a === 'restaurant-tables' || a === 'restaurant-orders' || a === 'front-desk-charges' || a === 'front-desk-checkout')) {
      setPendingNavigation(a)
      return
    }
    navigateAccepted(a)
  }
  const acceptPendingNavigation = () => {
    const next = pendingNavigation
    setPendingNavigation(null)
    if (next) navigateAccepted(next)
  }
  const switchAccountAccepted = (id: string) => {
    const directory=readEmployees(),permissions=readPermissions()
    if (directory.error || permissions.error) {
      setDemoError(directory.error ?? permissions.error ?? 'Unable to verify demo accounts')
      setPendingAccountId(null)
      return
    }
    const next = directory.data.employees.find(candidate => candidate.id===id && candidate.active)
    if (!next || activeSaveBusy) {setPendingAccountId(null);return}
    try {localStorage.setItem(ACTIVE_DEMO_ACCOUNT_KEY,next.id)} catch {setDemoError('Could not remember the selected account');return}
    setDemoDirectory(directory.data)
    setDemoPermissions(permissions.data)
    setAccountId(next.id)
    setPendingAccountId(null)
    setDemoError('')
    const nextAvailable=availableWorkspaces(permissions.data,next)
    const targetWorkspace=nextAvailable.includes(activeWorkspace)?activeWorkspace:nextAvailable[0]
    if (targetWorkspace && targetWorkspace!==activeWorkspace) {
      setWorkspaceTransition(current => nextWorkspaceTransition(current,activeWorkspace,targetWorkspace,prefersReducedWorkspaceMotion()))
      setActiveWorkspace(targetWorkspace)
    }
    if (!canAccessRoute(permissions.data,next,area)) {
      const fallback = preferredRoute(permissions.data,next)
      if (fallback) {
        history.replaceState(null,'',hashForRoute(fallback))
        const fallbackWorkspace=workspaceForRoute(fallback)
        if(fallbackWorkspace && fallbackWorkspace!==targetWorkspace){
          setWorkspaceTransition(current=>nextWorkspaceTransition(current,targetWorkspace??activeWorkspace,fallbackWorkspace,prefersReducedWorkspaceMotion()))
          setActiveWorkspace(fallbackWorkspace)
        }
        setArea(fallback)
      }
    }
  }
  const switchAccount = (id: string) => {
    if (activeSaveBusy || pendingNavigation || pendingAccountId || id===accountId) return
    if (activeDirty) setPendingAccountId(id)
    else switchAccountAccepted(id)
  }
  const switchDepartment = (next: Department) => {
    const first = preferredRoute(demoPermissions,activeAccount,next)
    if (first) go(first)
  }
  const openHelp=(focus:boolean)=>{
    if (area!=='help') setHelpContext(area)
    setHelpFocusSearch(focus)
    setFocusTutorialStart(false)
    go('help')
  }
  const startTutorial=()=>{
    if(area!=='help' || tutorialSession || activeDirty || activeSaveBusy || pendingNavigation || pendingAccountId || !canAccess('help'))return
    const workspace=tutorialWorkspaceForRole(activeAccount.role)
    const steps=authorizedTutorialSteps(workspace,canAccess)
    if(!steps.length)return
    setSearchOpen(false)
    setMenuOpen(false)
    setFocusTutorialStart(false)
    setTutorialPresentation(null)
    setWorkspaceTransition(null)
    setTutorialSession({id:++tutorialSequence.current,workspace,primaryRole:activeAccount.role,accountId,
      permissionsRevision:demoPermissions.revision,steps})
  }
  const presentTutorialView=(route:AppRoute,view?:TutorialView)=>{
    setTutorialPresentation(current=>current?.route===route&&current.view===view?current:{route,view})
  }
  const navigateTutorial=(route:AppRoute,view?:TutorialView):boolean=>{
    if(!tutorialSession || activeDirty || activeSaveBusy || pendingNavigation || pendingAccountId || !canAccess(route) ||
      workspaceForRoute(route)!==tutorialSession.workspace)return false
    presentTutorialView(route,view)
    if(area!==route){
      // Read-only tutorial navigation is synchronous and cannot raise a workspace
      // transition (whose full-app inert lock would swallow Skip clicks).
      history.replaceState(null,'',hashForRoute(route))
      approvedHashChange.current=false
      const destination=workspaceForRoute(route)
      if(destination)setActiveWorkspace(destination)
      setWorkspaceTransition(null)
      setArea(route)
      window.scrollTo({top:0,behavior:'instant'})
    }
    return true
  }
  const finishTutorial=()=>{
    const session=tutorialSession
    if(!session||exitedTutorial.current===session.id)return
    exitedTutorial.current=session.id
    const destination=authorizedTutorialExitRoute(session.primaryRole,canAccess,
      preferredRoute(demoPermissions,activeAccount))
    // Completion, Skip and Abort take exactly the same atomic cleanup path.
    // Never rely on asynchronous hashchange or the ordinary navigation guard:
    // those can leave the previous page/transition mounted after narration ends.
    setTutorialSession(null)
    setTutorialPresentation(null)
    setFocusTutorialStart(false)
    setWorkspaceTransition(null)
    if(destination){
      history.replaceState(null,'',hashForRoute(destination))
      approvedHashChange.current=false
      const destinationWorkspace=workspaceForRoute(destination)
      if(destinationWorkspace)setActiveWorkspace(destinationWorkspace)
      setArea(destination)
      window.scrollTo({top:0,behavior:'instant'})
    }
  }
  const openEmployeeSupport=()=>{
    setTicketArticleId(null)
    go(canAccess('employee-support')?'employee-support':'support')
  }
  const openNotification=(notice:Notification)=>{
    if(!canAccess(notice.destination))return
    if(notice.destination==='support')setNotificationTicketId(notice.sourceId)
    if(notice.destination==='front-desk-charges')setNotificationSettlementId(notice.sourceId)
    if(notice.destination==='audit')setNotificationAuditEventId(notice.sourceId)
    go(notice.destination)
  }
  const helpCreateTicket=(articleId:string)=>{
    if (!canAccess('employee-support')) return
    setTicketArticleId(articleId)
    go('employee-support')
  }
  const commitSupport=(change:(current:TicketCollection,actor:typeof activeAccount,permissions:typeof demoPermissions)=>TicketCollection):TicketCollection|null=>{
    try {
      const directory=readEmployees(),permissions=readPermissions()
      if (directory.error||permissions.error) throw Error('Employee permissions are unavailable')
      if (localStorage.getItem(ACTIVE_DEMO_ACCOUNT_KEY)!==accountId)
        throw Error('The acting employee changed before this action was saved')
      const active=readActiveDemoAccount(directory.data)
      const actor=actorForMutation(directory.data,permissions.data,accountId,active.id)
      const current=loadTickets(createSupportTickets())
      const next=change(current,actor,permissions.data)
      const committed=commitTickets(current,next)
      setSupportData(committed);setSupportError('')
      return committed
    } catch(reason) {
      setSupportError(reason instanceof Error?reason.message:'Support change could not be saved')
      return null
    }
  }
  const createEmployeeTicket=(input:{subject:string;description:string;priority:string;articleId?:string}):string|null=>{
    const result=commitSupport((current,actor,permissions)=>createTicket(current,actor,permissions,input))
    return result?.tickets[0]?.id??null
  }
  const sendTicketReply=async (id:string,body:string,files:File[]=[],context:SupportContext='employee'):Promise<boolean>=>{
    let staged:Awaited<ReturnType<typeof stageSupportAttachments>>=[]
    try{
      const directory=readEmployees(),permissions=readPermissions()
      if(directory.error||permissions.error)throw Error('Could not verify employee access')
      const active=readActiveDemoAccount(directory.data)
      if(active.id!==accountId)throw Error('The active employee changed')
      const target=loadTickets(createSupportTickets()).tickets.find(ticket=>ticket.id===id)
      if(!target||!canSeeTicket(supportScopeForContext(active,permissions.data,context),target)||target.status==='Closed')
        throw Error('This ticket is no longer available for replies')
      const messageId=`${id}-${crypto.randomUUID()}`
      staged=await stageSupportAttachments(id,messageId,files)
      const result=commitSupport((current,actor,permissions)=>replyTicket(current,actor,permissions,id,body,
        new Date(),staged,messageId,context))
      if(result)return true
      throw Error('Reply was not committed')
    }catch(error){
      if(staged.length)try{await removeSupportAttachments(staged.map(a=>a.id))}catch{
        setSupportError('The reply was not committed and a staged file could not be cleared')
      }
      setSupportError(error instanceof Error?error.message:'Reply could not be saved')
      return false
    }
  }
  const manageSupportTicket=(id:string,change:SupportChange):boolean=>!!commitSupport((current,actor,permissions)=>manageTicket(current,actor,permissions,id,change))
  const department:Department = activeWorkspace
  const reviewScenario = qualityScenario(location.search)
  const dashboardData = useMemo(() => qualityStore(store, reviewScenario), [store, reviewScenario])
  const dashboardTickets = useMemo(() => qualitySupportTickets(supportTickets, reviewScenario), [supportTickets, reviewScenario])
  const page = useMemo(() => {
    const guidedView=tutorialPresentation?.route===area?tutorialPresentation.view:undefined
    switch (area) {
      case 'dashboard':
        return <Dashboard
          store={dashboardData}
          tickets={dashboardTickets}
          go={go} account={activeAccount} tutorialReadOnly={!!tutorialSession} />
      case 'support':
      case 'employee-support':
        return <SupportWorkspace key={area}
          tickets={supportTickets}
          onDirtyChange={setSupportDirty}
          onBusyChange={setActiveSaveBusy}
          scope={supportScopeForContext(activeAccount,demoPermissions,area==='support'?'management':'employee')} actor={activeAccount}
          canCreate={area==='employee-support'&&activeAccount.active&&
            (activeAccount.role==='restaurant'||activeAccount.role==='front-desk')}
          creationArticleId={area==='employee-support'?ticketArticleId:null}
          openTicketId={area==='support'?notificationTicketId:null}
          onCreateTicket={createEmployeeTicket}
          onReplyTicket={(id,body,files)=>sendTicketReply(id,body,files,area==='support'?'management':'employee')}
          onManageTicket={area==='support'?manageSupportTicket:undefined} />
      case 'help':
        return <HelpCenter employee={activeAccount} permissions={demoPermissions} context={helpContext}
          focusSearch={helpFocusSearch} focusTutorialStart={focusTutorialStart} onCreateSupportTicket={helpCreateTicket} onStartTutorial={startTutorial}/>
      case 'audit':
        return <Suspense fallback={<ManagementPageFallback kind="audit"/>}><AuditLog focusEventId={notificationAuditEventId} tutorialReadOnly={!!tutorialSession}
          tutorialTab={guidedView==='audit-events'?'events':guidedView==='audit-traces'?'traces':undefined}/></Suspense>
      case 'systems':
        return <SystemManagement canOpen={canAccess} />
      case 'tables':
        return <TablesManager onDirtyChange={setTablesDirty} />
      case 'rooms':
        return <RoomsManager onDirtyChange={setRoomsDirty} />
      case 'payment-methods':
        return <PaymentMethods onDirtyChange={setPaymentMethodsDirty} />
      case 'employees':
        return <Employees onDirtyChange={setEmployeesDirty} accountId={activeAccount.id} />
      case 'roles-permissions':
        return <Suspense fallback={<ManagementPageFallback kind="permissions"/>}>
          <RolesPermissions onDirtyChange={setPermissionsDirty} actor={{role:activeAccount.role,id:activeAccount.id,displayName:activeAccount.fullName}} />
        </Suspense>
      case 'discounts':
        return <DiscountManagement onDirtyChange={setDiscountsDirty} onBusyChange={setActiveSaveBusy} />
      case 'receipt-settings':
        return <ReceiptSettings onDirtyChange={setReceiptSettingsDirty} onBusyChange={setActiveSaveBusy} />
      case 'receipt-builder':
        return <ReceiptBuilder onDirtyChange={setReceiptBuilderDirty} onBusyChange={setActiveSaveBusy} />
      case 'services':
        return <ServiceCatalog onDirtyChange={setServicesDirty} />
      case 'menu-categories':
        return <MenuCategories onDirtyChange={setCategoriesDirty} onBusyChange={setActiveSaveBusy} />
      case 'menu':
        return <MenuManagement onDirtyChange={setItemsDirty} onBusyChange={setActiveSaveBusy} />
      case 'front-desk-dashboard':
        return <FrontDeskDashboard go={go} account={activeAccount} tutorialReadOnly={!!tutorialSession}/>
      case 'front-desk-rooms':
        return <FrontDeskRooms onDirtyChange={setFrontDeskRoomsDirty} onBusyChange={setActiveSaveBusy} accountId={activeAccount.id} tutorialReadOnly={!!tutorialSession}/>
      case 'front-desk-charges':
        return <FrontDeskCharges onDirtyChange={setFrontDeskChargesDirty} onBusyChange={setActiveSaveBusy} navigationActivation={chargesNavigationActivation} accountId={activeAccount.id}
          focusSettlementId={notificationSettlementId} tutorialReadOnly={!!tutorialSession}/>
      case 'front-desk-checkout':
        return <FrontDeskCheckout onDirtyChange={setFrontDeskCheckoutDirty} onBusyChange={setActiveSaveBusy} navigationActivation={checkoutNavigationActivation} accountId={activeAccount.id}
          tutorialTab={guidedView==='checkout-current'?'checkout':guidedView==='checkout-history'?'history':undefined} tutorialReadOnly={!!tutorialSession}/>
      case 'restaurant-dashboard':
        return <RestaurantDashboard go={go} account={activeAccount} tutorialReadOnly={!!tutorialSession}/>
      case 'restaurant-tables':
        return <RestaurantTables onDirtyChange={setRestaurantTablesDirty} onBusyChange={setActiveSaveBusy} navigationActivation={tablesNavigationActivation}
          accountId={activeAccount.id} canRemoveRecorded={hasPermission(demoPermissions,activeAccount,'restaurant.orders.remove-recorded-items')}
          tutorialView={guidedView==='tables-floor'?'floor':guidedView==='tables-cards'?'cards':guidedView==='tables-reservations'?'reservations':undefined}
          tutorialReadOnly={!!tutorialSession}/>
      case 'restaurant-orders':
        return <RestaurantOrders go={go} navigationActivation={ordersNavigationActivation}
          tutorialTab={guidedView==='orders-active'?'active':guidedView==='orders-history'?'history':undefined} tutorialReadOnly={!!tutorialSession}/>
      default:
        return <Dashboard
          store={dashboardData}
          tickets={dashboardTickets}
          go={go} account={activeAccount} tutorialReadOnly={!!tutorialSession}/>
    }
  }, [
    area, accountId, demoPermissions, demoDirectory,
    store,
    dashboardData,
    dashboardTickets,
    supportTickets,
    ticketArticleId,
    notificationTicketId,notificationSettlementId,notificationAuditEventId,
    helpContext,
    helpFocusSearch,
    focusTutorialStart,
    tutorialPresentation,
    tutorialSession,
    ordersNavigationActivation,
    tablesNavigationActivation,
    chargesNavigationActivation,
    checkoutNavigationActivation
  ])
  return <div className="app-shell">
    <Sidebar
      tutorialActive={!!tutorialSession}
      area={area === 'tables' || area === 'rooms' || area === 'services' || area === 'menu-categories' || area === 'menu' || area === 'payment-methods' || area === 'discounts' || area === 'receipt-settings' || area === 'receipt-builder' || area === 'employees' || area === 'roles-permissions' ? 'systems' : area}
      items={(department === 'restaurant' ? restaurantNav : department === 'front-desk' ? frontDeskNav : primaryNav.map(item=>({...item,enabled:true})))
        .filter(item => canAccess(item.area as AppRoute))}
      onNavigate={go}
      menuOpen={menuOpen}
      onClose={() => setMenuOpen(false)} />
    <main className="main-shell" inert={!!tutorialSession}>
      <Topbar
        onSearch={() => setSearchOpen(true)}
        onMenu={() => setMenuOpen(true)}
        menuOpen={menuOpen}
        department={department}
        onWorkspaceChange={switchDepartment}
        account={activeAccount} accounts={demoDirectory.employees} permissions={demoPermissions}
        onAccountSwitch={switchAccount} allowedWorkspaces={allowedWorkspaces} accountBusy={activeSaveBusy}
        onBrowseHelp={()=>openHelp(false)} onSupport={openEmployeeSupport}
        onOpenNotification={openNotification}/>
      <div tabIndex={-1} key={accountId} data-tour-target="tour-main" className={`main-content ${area === 'dashboard' || area === 'restaurant-dashboard' || area === 'front-desk-dashboard' ? 'dashboard-motion' : ''}`}>
        {demoError && <div className="rt-alert rt-alert-error" role="alert">{demoError}</div>}
        {supportError && (area==='support'||area==='employee-support') && <div className="rt-alert rt-alert-error" role="alert">{supportError}</div>}
        {canAccess(area) ? page : <section className="sm-page"><h1>Access Denied</h1><p>This account cannot access this page</p></section>}
      </div>
    </main>
    <GlobalSearch
      go={go}
      items={(department === 'restaurant' ? restaurantNav : department === 'front-desk' ? frontDeskNav : primaryNav.map(item=>({...item,enabled:true})))
        .filter(item => item.enabled && canAccess(item.area as AppRoute)).map(item => ({area:item.area as AppRoute,label:item.label}))}
      isOpen={searchOpen}
      onClose={() => setSearchOpen(false)} />
    {workspaceTransition && <WorkspaceTransitionOverlay key={workspaceTransition.id} destination={workspaceTransition.destination} />}
    {pendingNavigation && <DiscardChangesDialog onKeep={() => setPendingNavigation(null)} onDiscard={acceptPendingNavigation} />}
    {pendingAccountId && <DiscardChangesDialog onKeep={() => setPendingAccountId(null)} onDiscard={() => switchAccountAccepted(pendingAccountId)} />}
    {tutorialSession && <TutorialController key={tutorialSession.id} sessionId={tutorialSession.id} workspace={tutorialSession.workspace}
      steps={tutorialSession.steps} route={area} onNavigate={navigateTutorial} onPresent={presentTutorialView}
      onSkip={finishTutorial} onComplete={finishTutorial} onAbort={finishTutorial}/>}
  </div>
}
