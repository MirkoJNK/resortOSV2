import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ClipboardList, Search } from 'lucide-react'
import { formatPrice } from '../menu-management/model'
import { readTables } from '../tables-manager/model'
import { loadOperations } from '../restaurant-tables/storage'
import type { Operations, RestaurantOrder, OrderHistoryStatus } from '../restaurant-tables/model'
import { emptyOperations, activeRecordedLines, activeRecordedQuantity, isHistoricalOrder, lineTotal, orderHistoryStatus, orderReference, settlementForOrder } from '../restaurant-tables/model'
import type { FinanceConfig } from '../discount-management/model'
import { calculateOrder, defaultFinanceConfig } from '../discount-management/model'
import { loadFinanceConfig, FINANCE_CHANGED_EVENT } from '../discount-management/storage'
import { FinancialBreakdown } from '../discount-management/FinancialBreakdown'
import type { AppRoute } from '../../shell/navigation'

type Tab = 'active' | 'history'
type DateFilter = 'all' | 'today' | 'week' | 'custom'
const STATUS_LABELS: Record<OrderHistoryStatus,string> = {
  recorded: 'Recorded', 'ready-to-pay': 'Ready to Pay', 'cash-demo': 'Cash Paid (Demo)',
  'room-demo': 'Room Posting (Demo)', canceled: 'Canceled', 'session-ended': 'Session Ended'
}
const dateParts = (timestamp: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp))
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
const displayDate = (timestamp: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(new Date(timestamp))
const recordedAt = (order: RestaurantOrder) => order.lines.map(l => l.recordedAt).sort()[0] ?? order.createdAt
const itemAmount = (order: RestaurantOrder) => lineTotal(order.lines)
const orderAmount = (order: RestaurantOrder, ops:Operations, finance:FinanceConfig) => order.canceledAt ? itemAmount(order) :
  settlementForOrder(ops,order.id)?.amountCentavos ?? calculateOrder(order,order.discountElections??[],finance.service).payableCentavos
const statusTone = (status: OrderHistoryStatus) => status === 'canceled' ? 'canceled' : status === 'ready-to-pay' ? 'ready' : status === 'cash-demo' ? 'cash' : status === 'room-demo' ? 'room' : 'neutral'

function OrderDetails({ order, operations, finance, tableName, onManage }: {
  order: RestaurantOrder; operations: Operations; finance:FinanceConfig; tableName: string; onManage: () => void
}) {
  const status = orderHistoryStatus(operations, order)
  const session = operations.sessions.find(s => s.id === order.sessionId)
  const payment = settlementForOrder(operations, order.id)
  const calculation = payment?.calculation ?? (!order.canceledAt && !payment ? calculateOrder(order,order.discountElections??[],finance.service) : null)
  const included = order.canceledAt ? order.lines.flatMap(line => {
    const quantity = activeRecordedQuantity(line)
    return quantity ? [{...line, quantity}] : []
  }) : activeRecordedLines(order)
  const removed = order.lines.flatMap(line => line.removals?.length ? line.removals.map(event => ({
    ...line, quantity: event.quantity, canceledAt: event.removedAt, id: event.id
  })) : line.canceledAt ? [line] : [])
  const reference = orderReference(order.id, order.displayNumber)
  return <div className="ro-detail ro-detail-enter">
    <div className="ro-detail-heading"><h1 title={reference}>Order {reference}</h1><span className={`ro-status ro-status-${statusTone(status)}`}>{STATUS_LABELS[status]}</span></div>
    <section className="ro-surface ro-meta" aria-label="Order information">
      <div><span>Table</span><strong>{tableName}</strong></div>
      <div><span>First recorded</span><strong>{displayDate(recordedAt(order))}</strong></div>
      <div><span>Last updated</span><strong>{displayDate(order.updatedAt)}</strong></div>
      {order.canceledAt && <div><span>Canceled</span><strong>{displayDate(order.canceledAt)}</strong></div>}
      {session?.closedAt && !order.canceledAt && <div><span>Session ended</span><strong>{displayDate(session.closedAt)}</strong></div>}
    </section>
    <section className="ro-surface" aria-label="Order items">
      <h2>Order Items</h2>
      <div className="ro-lines-head"><span>Item</span><span>Qty</span><span>Unit price</span><span>Amount</span></div>
      {included.map(line => <div className="ro-line" key={line.id}>
        <div><strong>{line.nameSnapshot}</strong>{line.note && <p>{line.note}</p>}</div>
        <span>{line.quantity}</span><span>{formatPrice(line.priceCentavos)}</span><strong>{formatPrice(line.priceCentavos * line.quantity)}</strong>
      </div>)}
      {!included.length && <p className="ro-muted">No included items</p>}
      {calculation&&(calculation.discounts.length>0||calculation.serviceRateBasisPoints>0)&&<FinancialBreakdown calculation={calculation} compact/>}
      <div className="ro-total"><span>{order.canceledAt ? 'Original recorded amount' : 'Order total'}</span><strong>{formatPrice(orderAmount(order,operations,finance))}</strong></div>
      {order.canceledAt && <p className="ro-muted">Canceled order. This amount is historical, not collected revenue</p>}
    </section>
    {removed.length > 0 && <details className="ro-surface ro-removed">
      <summary>Removed Items ({removed.length})</summary>
      {removed.map(line => <div className="ro-removed-line" key={line.id}>
        <div><strong>{line.nameSnapshot}</strong><span>{line.quantity} × {formatPrice(line.priceCentavos)}</span><span>Removed {displayDate(line.canceledAt!)}</span></div>
        <strong>{formatPrice(line.priceCentavos * line.quantity)}</strong>
      </div>)}
    </details>}
    {payment && <section className="ro-surface" aria-label="Demo settlement">
      <h2>Settlement (Demo)</h2>
      <div className="ro-meta ro-settlement-meta">
        <div><span>Method</span><strong>{payment.method === 'cash' ? 'Cash' : 'Charge to Room'}</strong></div>
        {payment.method === 'room' && <div><span>Room</span><strong>{payment.roomNameSnapshot}{payment.roomCodeSnapshot ? ` (${payment.roomCodeSnapshot})` : ''}</strong></div>}
        <div><span>Amount</span><strong>{formatPrice(payment.amountCentavos)}</strong></div>
        <div><span>Recorded</span><strong>{displayDate(payment.recordedAt)}</strong></div>
        <div><span>Handled by</span><strong>Not recorded</strong></div>
        <div><span>Status</span><strong>{payment.method === 'cash' ? 'Demo payment recorded' : 'Demo room posting, not paid'}</strong></div>
      </div>
    </section>}
    {!payment && <section className="ro-surface ro-actors"><h2>Employee Details</h2><p>Order recorded by: <strong>Not recorded</strong></p><p>Payment information: <strong>Not available</strong></p></section>}
    {!isHistoricalOrder(operations, order) && session && !session.closedAt && <button className="rt-btn rt-btn-primary ro-manage" type="button" onClick={onManage}>Open in Tables <ChevronRight size={16}/></button>}
  </div>
}

export function RestaurantOrders({ go, navigationActivation = 0 }: { go: (route: AppRoute) => void; navigationActivation?: number }) {
  const [operations, setOperations] = useState<Operations>(emptyOperations)
  const [finance,setFinance] = useState<FinanceConfig>(defaultFinanceConfig)
  const [tables, setTables] = useState(() => { const result = readTables(); return result.error ? [] : result.data.tables })
  const [tab, setTab] = useState<Tab>('history')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [selected, setSelected] = useState<string | null>(null)
  const entranceFinished = useRef(false)
  useEffect(() => { setSelected(null) }, [navigationActivation])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(() => readTables().error ?? '')
  useEffect(() => {
    let active = true
    Promise.all([loadOperations(),loadFinanceConfig()]).then(([next,policy]) => { if (active) {setOperations(next);setFinance(policy); setLoading(false)} })
      .catch(e => { if (active) {setError(e instanceof Error ? e.message : 'Could not load orders'); setLoading(false)} })
    const refresh = () => { loadOperations().then(next => { if (active) setOperations(next) }).catch(() => { if(active) setError('Could not refresh orders') }) }
    const onFocus = () => {const current = readTables(); if(active && !current.error) setTables(current.data.tables); refresh()}
    const refreshFinance = () => {loadFinanceConfig().then(next => {if(active)setFinance(next)}).catch(()=>{if(active)setError('Could not refresh Restaurant finance settings')})}
    window.addEventListener('focus', onFocus)
    window.addEventListener('focus', refreshFinance)
    window.addEventListener(FINANCE_CHANGED_EVENT,refreshFinance)
    window.addEventListener('restaurant-operations-changed', refresh)
    return () => { active = false; window.removeEventListener('focus',onFocus);window.removeEventListener('focus',refreshFinance);window.removeEventListener(FINANCE_CHANGED_EVENT,refreshFinance); window.removeEventListener('restaurant-operations-changed',refresh) }
  }, [])
  const tableName = (order: RestaurantOrder) => {
    const session = operations.sessions.find(s => s.id === order.sessionId)
    return tables.find(t => t.id === session?.tableId)?.label ?? 'Table unavailable'
  }
  const visible = useMemo(() => {
    const today = dateParts(new Date().toISOString())
    const beginning = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
    const q = query.trim().toLocaleLowerCase()
    return operations.orders.filter(order => {
      const history = isHistoricalOrder(operations, order)
      if (tab === 'history' ? !history : history) return false
      const state = orderHistoryStatus(operations, order)
      if (statusFilter !== 'all' && statusFilter !== state) return false
      if (q && !orderReference(order.id, order.displayNumber).toLowerCase().includes(q) && !tableName(order).toLocaleLowerCase().includes(q)) return false
      const date = dateParts(recordedAt(order))
      if (dateFilter === 'today' && date !== today) return false
      if (dateFilter === 'week' && (date < beginning || date > today)) return false
      if (dateFilter === 'custom' && ((dateFrom && date < dateFrom) || (dateTo && date > dateTo))) return false
      return true
    }).sort((a,b) => (sort === 'newest' ? -1 : 1) * (recordedAt(a).localeCompare(recordedAt(b)) || a.id.localeCompare(b.id)))
  }, [operations, tables, tab, statusFilter, query, dateFilter, dateFrom, dateTo, sort])
  const current = selected ? operations.orders.find(o => o.id === selected) : null
  const changeTab = (next: Tab) => {setTab(next); setStatusFilter('all'); setSelected(null)}
  return <div className="rt-page ro-page">
    {current ? <OrderDetails order={current} operations={operations} finance={finance} tableName={tableName(current)}
      onManage={() => go('restaurant-tables')}/> : <>
      <div className={`rt-page-heading${entranceFinished.current ? '' : ' rt-enter-heading'}`}><h1>Orders</h1></div>
      <div className={`rt-tabs${entranceFinished.current ? '' : ' rt-enter-toolbar'}`} role="tablist" aria-label="Restaurant Orders views">
        <button type="button" role="tab" aria-selected={tab==='active'} className={tab==='active'?'active':''} onClick={() => changeTab('active')}><ClipboardList size={17}/> Active Orders</button>
        <button type="button" role="tab" aria-selected={tab==='history'} className={tab==='history'?'active':''} onClick={() => changeTab('history')}><ClipboardList size={17}/> Order History</button>
      </div>
      <div className={`rt-toolbar ro-toolbar${entranceFinished.current ? '' : ' rt-enter-toolbar'}`}>
        <div className="rt-toolbar-main"><div className="rt-search-box"><Search size={17}/><input aria-label="Search orders" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search orders"/></div></div>
        <div className="rt-toolbar-tools">
          <label className="rt-sr-only" htmlFor="ro-status">Order status</label>
          <select className="rt-select" id="ro-status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>
            {(tab==='active' ? ['recorded','ready-to-pay'] : ['cash-demo','room-demo','canceled','session-ended']).map(s=><option key={s} value={s}>{STATUS_LABELS[s as OrderHistoryStatus]}</option>)}
          </select>
          <label className="rt-sr-only" htmlFor="ro-date">Order date</label><select className="rt-select" id="ro-date" value={dateFilter} onChange={e=>setDateFilter(e.target.value as DateFilter)}>
            <option value="all">All dates</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="custom">Custom range</option>
          </select>
          <label className="rt-sr-only" htmlFor="ro-sort">Sort orders</label><select className="rt-select" id="ro-sort" value={sort} onChange={e=>setSort(e.target.value as 'newest'|'oldest')}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>
      {dateFilter === 'custom' && <div className="ro-date-range"><label>From <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label>To <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e=>setDateTo(e.target.value)}/></label></div>}
      {error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
      {loading ? <div className="rt-empty">Loading orders</div> : <section className={`ro-surface ro-list${entranceFinished.current ? '' : ' ro-list-enter'}`} onAnimationEnd={() => { entranceFinished.current = true }} aria-label={tab === 'active' ? 'Active Orders' : 'Order History'}>
        <div className="ro-list-head"><span>Order</span><span>Table</span><span>Date</span><span>Amount</span><span>Status</span><span>Manage</span></div>
        {visible.map(order => {
          const state = orderHistoryStatus(operations, order)
          return <div className="ro-list-row" key={order.id}>
            <strong className="ro-order-ref" title={orderReference(order.id, order.displayNumber)}>{orderReference(order.id, order.displayNumber)}</strong>
            <span>{tableName(order)}</span>
            <span>{displayDate(recordedAt(order))}</span>
            <strong>{formatPrice(orderAmount(order,operations,finance))}</strong>
            <span><span className={`ro-status ro-status-${statusTone(state)}`}>{STATUS_LABELS[state]}</span></span>
            <button type="button" className="rt-btn rt-btn-small" onClick={() => setSelected(order.id)}>Details</button>
          </div>
        })}
        {!visible.length && <div className="rt-empty">{operations.orders.length === 0 ? 'No recorded orders yet' : 'No orders found'}</div>}
      </section>}
    </>}
  </div>
}
