import type { AppRoute, Department } from '../../shell/navigation'
import type { EmployeeRole } from '../employees/model'
import { publicAsset } from '../../shell/assets'

export type TutorialView =
  | 'audit-events' | 'audit-traces'
  | 'tables-floor' | 'tables-cards' | 'tables-reservations'
  | 'orders-active' | 'orders-history'
  | 'checkout-current' | 'checkout-history'

export type TutorialCue = {
  at: number
  target: string
  fallback: string
  text: string
  view?: TutorialView
}
export type TutorialStep = {
  id: string
  title: string
  route: AppRoute
  audio: string
  duration: number
  cues: readonly TutorialCue[]
}

const cue = (at:number,target:string,fallback:string,text:string,view?:TutorialView):TutorialCue =>
  ({at,target,fallback,text,...(view?{view}:{})})
const clip = (workspace:Department,file:string) => publicAsset(`tutorial-audio/${workspace}/${file}.mp3`)
const step = (workspace:Department,id:string,title:string,route:AppRoute,duration:number,
  cues:readonly TutorialCue[]):TutorialStep => ({id,title,route,duration,audio:clip(workspace,id),cues})

/** Timings are initial narration cue marks, measured against the actual MP3 timeline. */
export const TUTORIAL_MANIFEST:Readonly<Record<Department,readonly TutorialStep[]>> = {
  admin: [
    step('admin','01-welcome','Welcome to Administration','dashboard',21.002,[
      cue(0,'admin-dashboard-overview','tour-main','Your Administration workspace at a glance'),
      cue(8,'tour-navigation','admin-dashboard-overview','Use the sidebar to move between Administration tools')]),
    step('admin','02-dashboard','Administration dashboard','dashboard',28.186,[
      cue(0,'admin-dashboard-overview','tour-main','Your operational overview'),
      cue(9,'admin-dashboard-metrics','admin-dashboard-overview','Key room charges and collection indicators'),
      cue(19,'admin-dashboard-charts','admin-dashboard-overview','Charts and recent activity')]),
    step('admin','03-system-management','System Management','systems',27.716,[
      cue(0,'admin-system-heading','tour-main','Configure ResortOS tools'),
      cue(7,'admin-system-tools','admin-system-heading','Management tools organized by category'),
      cue(17,'admin-system-groups','admin-system-tools','Available management groups')]),
    step('admin','04-audit-events','Audit Log: Events','audit',21.551,[
      cue(0,'audit-events-tab','tour-main','Review recorded audit events','audit-events'),
      cue(6,'audit-events-list','audit-events-tab','Activity records and their details'),
      cue(14,'audit-events-filters','audit-events-list','Search and filter the audit log')]),
    step('admin','05-audit-trace','Audit Log: Trace View','audit',24.268,[
      cue(0,'audit-traces-tab','tour-main','Follow room-stay activity','audit-traces'),
      cue(8,'audit-traces-list','audit-traces-tab','Read-only room and checkout traces'),
      cue(16,'audit-traces-list','audit-traces-tab','Existing traces or the honest empty state')]),
    step('admin','06-support','Support & Issues','support',26.122,[
      cue(0,'support-ticket-inbox','tour-main','Organize employee support tickets'),
      cue(9,'support-ticket-inbox','tour-main','Review open and in-progress requests'),
      cue(18,'support-ticket-detail','support-ticket-inbox','See conversations and ticket details')]),
    step('admin','07-complete','Administration tour complete','dashboard',20.114,[
      cue(0,'admin-dashboard-overview','tour-main','You are ready to use Administration'),
      cue(10,'tour-help-entry','admin-dashboard-overview','Start the tutorial again anytime from Help Center')])
  ],
  restaurant: [
    step('restaurant','01-welcome','Welcome to Restaurant','restaurant-dashboard',20.846,[
      cue(0,'restaurant-dashboard-overview','tour-main','Welcome to the Restaurant workspace'),
      cue(9,'tour-navigation','restaurant-dashboard-overview','Your Restaurant navigation')]),
    step('restaurant','02-dashboard','Restaurant dashboard','restaurant-dashboard',23.641,[
      cue(0,'restaurant-dashboard-overview','tour-main','Restaurant activity in one place'),
      cue(8,'restaurant-dashboard-metrics','restaurant-dashboard-overview','Orders and room postings'),
      cue(16,'restaurant-dashboard-extras','restaurant-dashboard-overview','Reservation activity and shortcuts')]),
    step('restaurant','03-tables','Tables and floor plan','restaurant-tables',24.111,[
      cue(0,'restaurant-floor-plan','restaurant-tables-tabs','View your table layout','tables-floor'),
      cue(12,'restaurant-table-cards','restaurant-tables-tabs','Switch to table cards','tables-cards')]),
    step('restaurant','04-reservations','Upcoming Reservations','restaurant-tables',25.234,[
      cue(0,'restaurant-reservations','restaurant-tables-tabs','View upcoming reservations','tables-reservations'),
      cue(8,'restaurant-reservations-list','restaurant-reservations','Reservation information and timing'),
      cue(17,'restaurant-reservations','restaurant-tables-tabs','Review an existing reservation without changing it')]),
    step('restaurant','05-orders-at-tables','Starting orders at tables','restaurant-tables',23.954,[
      cue(0,'restaurant-table-cards','restaurant-tables-tabs','Choose a table card','tables-cards'),
      cue(8,'restaurant-table-cards','restaurant-tables-tabs','Each table provides its own actions'),
      cue(17,'restaurant-table-cards','restaurant-tables-tabs','Select a table to find Start Order — nothing is started here')]),
    step('restaurant','06-orders','Active Orders and Order History','restaurant-orders',23.876,[
      cue(0,'restaurant-orders-active','restaurant-orders-tabs','Follow active Restaurant orders','orders-active'),
      cue(13,'restaurant-orders-history','restaurant-orders-tabs','Review completed and historical orders','orders-history')]),
    step('restaurant','07-complete','Restaurant tour complete','restaurant-dashboard',22.988,[
      cue(0,'restaurant-dashboard-overview','tour-main','You are ready to work in Restaurant'),
      cue(11,'tour-help-entry','restaurant-dashboard-overview','Find the tutorial again in Help Center')])
  ],
  'front-desk': [
    step('front-desk','01-welcome','Welcome to Front Desk','front-desk-dashboard',19.722,[
      cue(0,'front-desk-dashboard-overview','tour-main','Welcome to Front Desk'),
      cue(8,'tour-navigation','front-desk-dashboard-overview','Your Front Desk navigation')]),
    step('front-desk','02-dashboard','Front Desk dashboard','front-desk-dashboard',27.638,[
      cue(0,'front-desk-dashboard-overview','tour-main','Daily Front Desk operations'),
      cue(9,'front-desk-dashboard-metrics','front-desk-dashboard-overview','Charges and checkout collections'),
      cue(19,'front-desk-dashboard-charts','front-desk-dashboard-overview','Charts and related shortcuts')]),
    step('front-desk','03-rooms','Rooms','front-desk-rooms',25.156,[
      cue(0,'front-desk-rooms-heading','tour-main','Find the rooms you manage'),
      cue(8,'front-desk-rooms-list','front-desk-rooms-heading','Current room status and occupancy'),
      cue(16,'front-desk-rooms-list','front-desk-rooms-heading','Read existing stay information')]),
    step('front-desk','04-charges','Charges','front-desk-charges',27.559,[
      cue(0,'front-desk-charges-heading','tour-main','Review outstanding room charges'),
      cue(8,'front-desk-charges-list','front-desk-charges-heading','Existing charge records'),
      cue(18,'front-desk-charges-toolbar','front-desk-charges-heading','Available charge and payment tools')]),
    step('front-desk','05-checkout','Checkout','front-desk-checkout',26.671,[
      cue(0,'front-desk-checkout-current','front-desk-checkout-tabs','Review rooms ready for checkout','checkout-current'),
      cue(9,'front-desk-checkout-current','front-desk-checkout-tabs','Room and stay information'),
      cue(18,'front-desk-checkout-current','front-desk-checkout-tabs','Find checkout review without initiating it')]),
    step('front-desk','06-checkout-history','Checkout History','front-desk-checkout',21.316,[
      cue(0,'front-desk-checkout-history','front-desk-checkout-tabs','Read historical checkout records','checkout-history'),
      cue(8,'front-desk-checkout-history','front-desk-checkout-tabs','Search and inspect checkout history'),
      cue(15,'front-desk-checkout-history','front-desk-checkout-tabs','Existing guest folios remain read-only here')]),
    step('front-desk','07-complete','Front Desk tour complete','front-desk-dashboard',22.674,[
      cue(0,'front-desk-dashboard-overview','tour-main','You are ready to work at Front Desk'),
      cue(11,'tour-help-entry','front-desk-dashboard-overview','Return to Help Center whenever you need this tour')])
  ]
}

export function authorizedTutorialSteps(workspace:Department,canOpen:(route:AppRoute)=>boolean):TutorialStep[] {
  return TUTORIAL_MANIFEST[workspace].filter(item=>canOpen(item.route))
}

/** The employee's primary assigned role is authoritative, even with cross-workspace grants. */
export function tutorialWorkspaceForRole(role:EmployeeRole):Department {
  if(role==='super-admin'||role==='admin')return 'admin'
  return role==='restaurant'?'restaurant':'front-desk'
}

export function validTutorialManifest():boolean {
  return (Object.values(TUTORIAL_MANIFEST) as (readonly TutorialStep[])[]).every(steps=>steps.length===7 &&
    steps.every(item=>item.cues.length>0 && item.audio.endsWith('.mp3') && item.duration>0 &&
      item.cues[0].at===0 && item.cues.every((mark,index)=>mark.at>=0 && mark.at<item.duration &&
        (!index || mark.at>item.cues[index-1].at))))
}
