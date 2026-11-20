import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Operations } from '../restaurant-tables/model'
import { requireCurrentDemoPermission } from '../demo/access'
import { DocumentActions } from '../receipt-settings/DocumentActions'
import { checkoutHistory, filterCheckoutHistory } from './checkoutHistory'
import type { CheckoutDateFilter } from './checkoutHistory'

const fullDate = (date: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric'
}).format(new Date(`${date}T00:00:00Z`))
const checkoutDate = (timestamp: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit'
}).format(new Date(timestamp))

export function CheckoutHistory({ operations, accountId }: { operations: Operations; accountId?: string }) {
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<CheckoutDateFilter>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const all = useMemo(() => checkoutHistory(operations), [operations])
  const visible = useMemo(() => filterCheckoutHistory(all, { query, dateFilter, from, to, sort }),
    [all, query, dateFilter, from, to, sort])
  const checkPermission = () => { if (accountId) requireCurrentDemoPermission(accountId, 'front-desk.checkout.view') }

  return <div className="fd-checkout-history" id="fd-checkout-history-panel" role="tabpanel" aria-labelledby="fd-checkout-history-tab" data-tour-target="front-desk-checkout-history" tabIndex={0}>
    <div className="rt-toolbar ro-toolbar rt-enter-toolbar">
      <div className="rt-toolbar-main"><label className="rt-search-box"><Search size={17} aria-hidden="true"/>
        <input type="search" aria-label="Search checkout history" placeholder="Search checkouts" value={query} onChange={event => setQuery(event.target.value)}/>
      </label></div>
      <div className="rt-toolbar-tools">
        <label className="rt-sr-only" htmlFor="fd-history-date">Checkout date</label>
        <select className="rt-select" id="fd-history-date" value={dateFilter} onChange={event => setDateFilter(event.target.value as CheckoutDateFilter)}>
          <option value="all">All dates</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="custom">Custom range</option>
        </select>
        <label className="rt-sr-only" htmlFor="fd-history-sort">Sort checkouts</label>
        <select className="rt-select" id="fd-history-sort" value={sort} onChange={event => setSort(event.target.value as 'newest' | 'oldest')}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
        </select>
      </div>
    </div>
    {dateFilter === 'custom' && <div className="ro-date-range">
      <label>From <input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)}/></label>
      <label>To <input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)}/></label>
    </div>}
    <section className="ro-surface ro-list ro-list-enter fd-history-list" aria-label="Checkout History" role="table">
      <div className="ro-list-head fd-history-list-head" role="row"><span role="columnheader">Room</span><span role="columnheader">Guest</span><span role="columnheader">Check-in</span><span role="columnheader">Checkout</span><span role="columnheader">Manage</span></div>
      {visible.map(({ checkout, stay }) => <div className="ro-list-row fd-history-list-row" role="row" key={checkout.id}>
        <strong role="cell">{checkout.roomNameSnapshot}</strong><span role="cell">{stay.guestName}</span>
        <span role="cell">{fullDate(stay.checkInDate)}</span><span role="cell">{checkoutDate(checkout.recordedAt)}</span>
        <div role="cell" className="fd-history-manage"><DocumentActions kind="guest-folio" sourceId={checkout.id} reprint beforeOpen={checkPermission} beforePrint={checkPermission}/></div>
      </div>)}
      {!visible.length && <div className="rt-empty" role="row"><span role="cell">{all.length ? 'No checkouts found' : 'No checkout history yet'}</span></div>}
    </section>
  </div>
}
