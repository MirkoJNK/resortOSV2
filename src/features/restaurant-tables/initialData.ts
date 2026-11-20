import type { DiningTable } from '../tables-manager/model'
import type { Room } from '../rooms-manager/model'
import type { MenuItem } from '../menu-management/model'
import type { ServiceRecord } from '../service-catalog/model'
import type { FinanceConfig } from '../discount-management/model'
import { calculateOrder } from '../discount-management/model'
import { resortDate } from '../front-desk/stays'
import { isValidOperations, readyToPay, recordDemoSettlement, recordOrder, reservationError, startSession } from './model'
import type { Operations, DraftLine } from './model'

/** Initial local operational records are linked to the customer's actual configuration. */
export function initialOperationalRecords(tables: DiningTable[], rooms: Room[], items: MenuItem[],
  services: ServiceRecord[], finance: FinanceConfig, clock = new Date()): Operations | null {
  const availableTables=tables.filter(t=>t.status==='active')
  const availableRooms=rooms.filter(r=>r.active)
  const availableItems=items.filter(i=>i.active && i.priceCentavos>0)
  const availableServices=services.filter(s=>s.status==='active')
  if (availableTables.length<4 || availableRooms.length<2 || availableItems.length<2 || availableServices.length<2) return null
  const timestamp=(minutes:number)=>new Date(clock.getTime()+minutes*60000).toISOString()
  const now=timestamp(0)
  const day=(days:number)=>resortDate(new Date(clock.getTime()+days*86400000))
  const laterDay=(days:number)=>day(days)
  let result:Operations={sessions:[],orders:[],reservations:[],settlements:[],stays:[],serviceCharges:[],chargePayments:[],checkouts:[],revision:0}
  const roomOne=availableRooms[0],roomTwo=availableRooms[1]
  result.stays=[
    {id:'initial-stay-1',roomId:roomOne.id,guestName:'Andrea Reyes',checkInDate:day(-1),expectedCheckoutDate:laterDay(2),
      checkedInAt:timestamp(-480),status:'active',createdAt:timestamp(-480),updatedAt:timestamp(-480)},
    {id:'initial-stay-2',roomId:roomTwo.id,guestName:'Miguel Santos',checkInDate:day(-1),expectedCheckoutDate:laterDay(3),
      checkedInAt:timestamp(-420),status:'active',createdAt:timestamp(-420),updatedAt:timestamp(-420)}
  ]
  // Use configured menu identities and exact configured prices so active orders can be edited.
  const preferred=(name:string,fallback:number)=>availableItems.find(i=>i.name===name)??availableItems[fallback%availableItems.length]
  const menu=[preferred('Chicken Adobo',0),preferred('Calamansi Juice',1),preferred('Chicken Wings',2)]
  const addOrder=(table:DiningTable,index:number,opened:number,quantity:number,ready:boolean,completed=false)=>{
    const sessionId=`initial-session-${index}`
    result=startSession(result,table,null,timestamp(opened),sessionId)
    const item=menu[index%menu.length]
    const lines:DraftLine[]=[{id:`initial-line-${index}`,menuItemId:item.id,nameSnapshot:item.name,priceCentavos:item.priceCentavos,
      quantity,note:''}]
    result=recordOrder(result,sessionId,lines,timestamp(opened+2),`initial-order-${index}`)
    if (ready||completed) result=readyToPay(result,sessionId)
    return sessionId
  }
  addOrder(availableTables[0],0,-30,2,false)
  addOrder(availableTables[1],1,-52,2,true)
  const cashSession=addOrder(availableTables[2],2,-230,1,true,true)
  const paidOrder=result.orders.find(o=>o.sessionId===cashSession)!
  const paidDue=calculateOrder(paidOrder,[],finance.service,timestamp(-205),finance.taxMode).payableCentavos
  result=recordDemoSettlement(result,cashSession,'restaurant',undefined,timestamp(-205),'initial-settlement-direct-1',finance,
    {methodId:'cash',methodNameSnapshot:'Cash',methodBehaviorSnapshot:'cash',cashReceivedCentavos:paidDue+500,changeCentavos:500})
  const roomSession=addOrder(availableTables[3],3,-180,1,true,true)
  result=recordDemoSettlement(result,roomSession,'room',roomOne,timestamp(-150),'initial-settlement-room-1',finance)
  // Two outstanding service charges, with a separate settled service charge for payment history.
  const serviceOne=availableServices[0],serviceTwo=availableServices[1]
  const charge=(id:string,service:ServiceRecord,room:Room,stayId:string,at:string,number:number)=>({
    id,roomId:room.id,stayId,roomNameSnapshot:room.name,serviceId:service.id,displayNumber:number,
    serviceNameSnapshot:service.name,serviceCodeSnapshot:service.code,unit:service.unit,
    priceCents:service.priceCents,quantityMilli:1000,amountCentavos:service.priceCents,recordedAt:at,simulated:true as const
  })
  const open1=charge('initial-service-1',serviceOne,roomOne,'initial-stay-1',timestamp(-100),1)
  const open2=charge('initial-service-2',serviceTwo,roomTwo,'initial-stay-2',timestamp(-80),2)
  const paid=charge('initial-service-3',serviceOne,roomTwo,'initial-stay-2',timestamp(-125),3)
  result.serviceCharges=[open1,open2,paid]
  result.chargePayments=[{id:'initial-charge-payment-1',source:'service',sourceId:paid.id,stayId:'initial-stay-2',
    amountCentavos:paid.amountCentavos,recordedAt:timestamp(-95),simulated:true,methodId:'cash',
    methodNameSnapshot:'Cash',methodBehaviorSnapshot:'cash',cashReceivedCentavos:paid.amountCentavos,
    changeCentavos:0}]
  const reservedTables=availableTables.slice(4)
  // Future reservations must not be placed on occupied tables.
  const targetTables=reservedTables.length?reservedTables:availableTables.slice(2)
  for(let index=0;index<Math.min(2,targetTables.length);index++){
    const at=new Date(clock.getTime()+(index?6:3)*3600000)
    at.setUTCMinutes(0,0,0)
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at)
    const draft={id:`initial-reservation-${index+1}`,tableId:targetTables[index].id,
      label:index?'Santos Family':'Garcia Party',date:resortDate(at),time:parts,notes:''}
    if (!reservationError(draft,result,tables,clock.getTime())) result.reservations.push({...draft,status:'active',
      createdAt:now,updatedAt:now})
  }
  if (!isValidOperations(result)) throw Error('Initial operational data failed integrity validation')
  return result
}
