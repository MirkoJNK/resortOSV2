import type { DiningTable } from '../tables-manager/model'
import type { Room } from '../rooms-manager/model'
import type { MenuItem } from '../menu-management/model'
import type { ServiceRecord } from '../service-catalog/model'
import type { FinanceConfig } from '../discount-management/model'
import { finalizeCheckout, checkoutSummary } from '../front-desk/checkout'
import { postServiceCharge, recordChargePayment } from '../front-desk/charges'
import { createStay, resortDate } from '../front-desk/stays'
import { cancelRecordedOrder, emptyOperations, isValidOperations, readyToPay,
  recordDemoSettlement, recordOrder, startSession } from '../restaurant-tables/model'
import type { Operations } from '../restaurant-tables/model'

/** Permanent versioned dataset. Do not remove or rename the fixture IDs in future releases. */
export const OPERATIONS_SEED_VERSION = 1
export const OPERATIONS_SEED_META_KEY = 'demo-operations-seed-version'
const HISTORIC_STAY = 'demo-history-stay-1'
const HISTORIC_ORDER = 'demo-history-order-1'
const CANCELED_ORDER = 'demo-canceled-order-1'
const daysBefore = (clock: Date, days: number) => new Date(clock.getTime()-days*86_400_000)
const timeBefore = (clock: Date, days: number, minutes = 0) =>
  new Date(clock.getTime()-days*86_400_000+minutes*60_000).toISOString()

/** Add only a fully referential, self-contained historical example; no existing record is rewritten. */
export function addMissingDemoHistory(ops: Operations, tables: DiningTable[], rooms: Room[],
  items: MenuItem[], services: ServiceRecord[], finance: FinanceConfig, clock = new Date()): Operations | null {
  const present = [
    (ops.stays??[]).some(s=>s.id===HISTORIC_STAY),
    ops.orders.some(o=>o.id===HISTORIC_ORDER),
    ops.orders.some(o=>o.id===CANCELED_ORDER)
  ]
  if (present.every(Boolean)) return ops
  if (present.some(Boolean)) throw Error('Demo history fixture ID conflicts with existing records; stored data was preserved')
  const activeTables = tables.filter(t=>t.status==='active')
  const activeRooms = rooms.filter(r=>r.active)
  const activeItems = items.filter(i=>i.active&&i.priceCentavos>0)
  const activeServices = services.filter(s=>s.status==='active'&&s.priceCents>0)
  if (activeTables.length<2 || !activeRooms.length || !activeItems.length || !activeServices.length) return null
  const room = activeRooms[0]
  const item = activeItems[0]
  const at = (days:number, minutes=0) => timeBefore(clock,days,minutes)
  const day = (days:number) => resortDate(daysBefore(clock,days))
  let history = emptyOperations()
  history = createStay(history,rooms,{roomId:room.id,guestName:'Isabella Garcia',
    checkInDate:day(7), expectedCheckoutDate:day(3)},at(7),HISTORIC_STAY)
  history = startSession(history,activeTables[0],null,at(6),'demo-history-session-1')
  history = recordOrder(history,'demo-history-session-1',[{
    id:'demo-history-line-1',menuItemId:item.id,nameSnapshot:item.name,
    priceCentavos:item.priceCentavos,quantity:2,note:''
  }],at(6,2),HISTORIC_ORDER)
  history = readyToPay(history,'demo-history-session-1')
  history = recordDemoSettlement(history,'demo-history-session-1','room',room,at(6,15),
    'demo-history-settlement-1',finance)
  history = postServiceCharge(history,rooms,services,{roomId:room.id,serviceId:activeServices[0].id,quantity:'1'},
    at(5),'demo-history-service-1')
  history = recordChargePayment(history,'service','demo-history-service-1',at(4,10),
    'demo-history-service-payment-1')
  const due = checkoutSummary(history,HISTORIC_STAY).balanceDueCentavos
  history = finalizeCheckout(history,{stayId:HISTORIC_STAY,roomId:room.id,roomName:room.name,
    method:'cash',cashReceived:(due/100).toFixed(2)},at(4,30),'demo-history-checkout-1',
  ['demo-history-checkout-allocation-1'])

  let canceled = emptyOperations()
  canceled = startSession(canceled,activeTables[1],null,at(3),'demo-canceled-session-1')
  canceled = recordOrder(canceled,'demo-canceled-session-1',[{
    id:'demo-canceled-line-1',menuItemId:item.id,nameSnapshot:item.name,
    priceCentavos:item.priceCentavos,quantity:1,note:''
  }],at(3,3),CANCELED_ORDER)
  canceled = cancelRecordedOrder(canceled,'demo-canceled-session-1',at(3,10))
  const nextOrderNumber = Math.max(0,...ops.orders.map(o=>o.displayNumber??0))
  const nextChargeNumber = Math.max(0,...(ops.serviceCharges??[]).map(c=>c.displayNumber))
  const next: Operations = {
    ...ops,
    sessions:[...ops.sessions,...history.sessions,...canceled.sessions],
    orders:[...ops.orders,...history.orders.map(o=>({...o,displayNumber:nextOrderNumber+1})),
      ...canceled.orders.map(o=>({...o,displayNumber:nextOrderNumber+2}))],
    stays:[...(ops.stays??[]),...(history.stays??[])],
    settlements:[...(ops.settlements??[]),...(history.settlements??[])],
    serviceCharges:[...(ops.serviceCharges??[]),...(history.serviceCharges??[]).map(c=>({...c,displayNumber:nextChargeNumber+1}))],
    chargePayments:[...(ops.chargePayments??[]),...(history.chargePayments??[])],
    checkouts:[...(ops.checkouts??[]),...(history.checkouts??[])]
  }
  if (!isValidOperations(next)) throw Error('Demo history failed validation; existing data was preserved')
  return next
}
