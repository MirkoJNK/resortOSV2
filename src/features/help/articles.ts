import type { PermissionId } from '../roles-permissions/catalog'
import type { PermissionState } from '../roles-permissions/model'
import { hasPermission } from '../roles-permissions/model'
import type { Employee } from '../employees/model'
import type { AppRoute } from '../../shell/navigation'

export type HelpArticle = {
  id:string;title:string;category:string;summary:string;keywords:readonly string[]
  contexts:readonly AppRoute[];required?:PermissionId;steps:readonly string[]
  note?:string;related?:readonly string[]
}
/** Version-controlled content that only describes implemented resortOS behavior. */
export const HELP_ARTICLES:readonly HelpArticle[] = [
  {id:'getting-started',title:'Getting started with resortOS',category:'Basics',summary:'Find your workspace and the tools available to your account',
    keywords:['welcome','account','navigation'],contexts:['dashboard','restaurant-dashboard','front-desk-dashboard'],
    steps:['Use the workspace selector at the top left to choose an available workspace','Open pages from the left navigation','Use Search pages to find permitted destinations','Use the profile avatar to switch between local demonstration accounts'],related:['understanding-workspaces','finding-help']},
  {id:'understanding-workspaces',title:'Understanding workspaces',category:'Basics',summary:'Administration, Restaurant and Front Desk have different tasks',
    keywords:['workspace','switcher','access'],contexts:['dashboard','restaurant-dashboard','front-desk-dashboard'],
    steps:['Open the workspace selector at the top of the page','Choose a workspace listed for your account','Only features allowed by your effective permissions are available'],
    note:'Switching workspaces does not change your account or grant additional permissions',related:['getting-started']},
  {id:'finding-help',title:'Searching the Help Center',category:'Basics',summary:'Search instructions that match your access',
    keywords:['help','search','articles'],contexts:['dashboard','restaurant-dashboard','front-desk-dashboard'],
    steps:['Select the question-mark icon in the top bar','Choose Browse Help Center','Type a feature or action into Search for answers','Open an article from the results'],related:['reporting-issues']},
  {id:'reporting-issues',title:'Reporting a problem',category:'Support',summary:'Create an internal ticket for your department',
    keywords:['ticket','report','issue','bug'],contexts:['restaurant-dashboard','front-desk-dashboard'],
    steps:['Open Help and choose Support & Issues','Select New Ticket','Enter the subject and describe the actual problem','Choose Low, Medium, High or Urgent and submit'],
    note:'Only Restaurant and Front Desk employees can create employee support tickets. Never enter guest secrets or passwords',related:['ticket-statuses']},
  {id:'ticket-statuses',title:'Understanding ticket statuses',category:'Support',summary:'Follow your issue through Open, In progress and Closed',
    keywords:['open','closed','priority','activity'],contexts:['support','employee-support'],
    steps:['Open Support & Issues from Help','Choose a status tab to filter the inbox','Select a ticket to read its Conversation, Details and Activity','Administration controls priority, assignment and status after creation'],
    note:'Closed ticket conversations are read-only until Administration reopens them',related:['reporting-issues']},
  {id:'create-orders',title:'Creating a Restaurant order',category:'Restaurant',summary:'Start an order at an available table',
    keywords:['table','order','create'],contexts:['restaurant-tables','restaurant-orders'],required:'restaurant.orders.create',
    steps:['Open Restaurant Tables','Choose an available table','Start a table session and open the order workspace','Add menu items to the draft'],related:['record-orders','receive-order-payment']},
  {id:'record-orders',title:'Recording ordered items',category:'Restaurant',summary:'Save draft items to an active order',
    keywords:['place order','record','menu'],contexts:['restaurant-tables','restaurant-orders'],required:'restaurant.orders.edit',
    steps:['Open an active table session','Add items and adjust draft quantities or notes','Select Place Order to record the draft','Review the recorded items and updated total'],
    note:'You may freely remove a draft item before recording. Recorded lines follow separate adjustment permissions',related:['remove-recorded-items']},
  {id:'remove-recorded-items',title:'Removing recorded items',category:'Restaurant',summary:'Adjust recorded quantities before payment when authorized',
    keywords:['remove','recorded','quantity','manager'],contexts:['restaurant-tables','restaurant-orders'],required:'restaurant.orders.remove-recorded-items',
    steps:['Open an active Restaurant table order that has not been finalized or paid','Select Remove beside the recorded item','Choose the quantity to remove and confirm','Review the remaining total and adjustment history'],
    note:'Finalized, paid, canceled or room-posted orders cannot have recorded items removed, including by Super Admin',related:['record-orders']},
  {id:'receive-order-payment',title:'Recording Restaurant payment',category:'Restaurant',summary:'Record an eligible direct payment',
    keywords:['pay','cash','receipt','settle'],contexts:['restaurant-tables','restaurant-orders'],required:'restaurant.orders.record-payment',
    steps:['Open the active order and review recorded items','Mark the order Ready to Pay','Choose an available settlement option','Confirm payment using the current totals'],
    note:'Issued receipts and settled orders remain historical records',related:['post-room-charge']},
  {id:'post-room-charge',title:'Posting an order to a room',category:'Restaurant',summary:'Send eligible Restaurant charges to an active guest stay',
    keywords:['room','posting','front desk','settlement'],contexts:['restaurant-tables','restaurant-orders'],required:'restaurant.orders.record-payment',
    steps:['Open a recorded order that is Ready to Pay','Choose room posting as the settlement method','Select an active guest room and verify its stay','Confirm the room posting'],
    note:'The posted charge becomes part of the Front Desk balance. It is not a direct cash payment'},
  {id:'restaurant-tables',title:'Working with Restaurant tables',category:'Restaurant',summary:'Use the table list and active sessions',
    keywords:['floor plan','sessions','table'],contexts:['restaurant-tables'],required:'restaurant.tables.view',
    steps:['Open Tables in the Restaurant workspace','Select a table from the available layout or list','Open its active order or start a session when available']},
  {id:'front-desk-stays',title:'Managing room stays',category:'Front Desk',summary:'Check in a guest using configured rooms',
    keywords:['check in','stay','guest','rooms'],contexts:['front-desk-rooms'],required:'front-desk.rooms.manage',
    steps:['Open Front Desk Rooms','Choose an available configured room','Enter the guest and stay details','Confirm the check-in'],
    note:'Room identities are configured separately by Administration'},
  {id:'front-desk-charges',title:'Recording service charges',category:'Front Desk',summary:'Post a service to an active room stay',
    keywords:['charges','services','rental','room'],contexts:['front-desk-charges'],required:'front-desk.charges.create',
    steps:['Open Front Desk Charges','Choose the currently active room stay','Select a configured service and quantity','Confirm the charge and verify the outstanding balance'],related:['front-desk-charge-payment','front-desk-checkout']},
  {id:'front-desk-charge-payment',title:'Recording a charge payment',category:'Front Desk',summary:'Settle an individual room charge',
    keywords:['payment','individual','settle','balance'],contexts:['front-desk-charges','front-desk-checkout'],required:'front-desk.charges.record-payment',
    steps:['Open the room Charges page','Select an unpaid eligible charge','Record its payment through the available payment action','Verify the updated outstanding balance']},
  {id:'front-desk-checkout',title:'Processing checkout',category:'Front Desk',summary:'Settle the balance and complete a guest stay',
    keywords:['checkout','receipt','settlement'],contexts:['front-desk-checkout'],required:'front-desk.checkout.process',
    steps:['Open Front Desk Checkout','Select an active stay','Review restaurant postings, services and prior payments','Settle the remaining balance and confirm checkout'],
    note:'Historical checkout and issued receipts must not be changed retroactively',related:['front-desk-charges']},
  {id:'configure-rooms',title:'Configuring resort rooms',category:'Administration',summary:'Add, edit or deactivate room identities',
    keywords:['rooms manager','room code'],contexts:['rooms','systems'],required:'administration.rooms.manage',
    steps:['Open System Management','Select Rooms Manager','Add a unique display name and optional room code, or edit an existing room','Save the change']},
  {id:'manage-employees',title:'Managing employees',category:'Administration',summary:'Maintain the employee directory safely',
    keywords:['people','staff','accounts'],contexts:['employees','systems'],required:'administration.employees.manage',
    steps:['Open Employees through System Management','Use Add Employee to create a new record','Select an eligible employee to edit their name or role','Use the available status action to deactivate or reactivate'],
    note:'The protected System Administrator cannot be edited or removed'},
  {id:'manage-menu',title:'Managing menu items',category:'Administration',summary:'Maintain the configured Restaurant menu',
    keywords:['menu','items','prices'],contexts:['menu','systems'],required:'restaurant.menu.manage',
    steps:['Open System Management','Select Menu Management','Add an item or edit an existing item','Save changes to the catalog']},
  {id:'manage-payment-methods',title:'Managing payment methods',category:'Administration',summary:'Configure the available payment options',
    keywords:['payment','methods','cash'],contexts:['payment-methods','systems'],required:'administration.payments.manage',
    steps:['Open System Management','Select Payment Methods','Add or edit a configured method','Save changes']},
  {id:'support-management',title:'Managing support tickets',category:'Administration',summary:'Update priorities, assignments and ticket status',
    keywords:['admin','support','assign'],contexts:['support'],required:'support.tickets.manage',
    steps:['Open Support & Issues in Administration','Select a ticket from the inbox','Use the status, priority or assignment controls','Review the Activity tab for the recorded change'],
    note:'The originating department does not change when a ticket is assigned to a different handling team'}
]

export const visibleArticles=(employee:Employee,permissions:PermissionState):HelpArticle[]=>
  employee.active?HELP_ARTICLES.filter(article=>!article.required||hasPermission(permissions,employee,article.required)):[]
export const articleById=(employee:Employee,permissions:PermissionState,id:string):HelpArticle|undefined=>
  visibleArticles(employee,permissions).find(article=>article.id===id)
export function searchArticles(articles:readonly HelpArticle[],query:string):HelpArticle[] {
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return [...articles]
  return articles.filter(article=>{
    const searchable=[article.title,article.summary,article.category,...article.keywords].join(' ').toLocaleLowerCase()
    return terms.every(term=>searchable.includes(term))
  })
}
export const suggestedArticles=(articles:readonly HelpArticle[],context:AppRoute):HelpArticle[]=>
  articles.filter(article=>article.contexts.includes(context)).slice(0,6)
