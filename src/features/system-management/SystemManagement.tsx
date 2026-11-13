import { useMemo, useState } from 'react'
import { Building2, CreditCard, ReceiptText, Search, Store, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Management directory: six implemented managers have routes.
 * The remaining editors stay informational until their React pages exist.
 */
type ManagementTool = { id: string; label: string; description: string; searchTerms?: string }
type ManagementSection = { id: string; title: string; description: string; icon: LucideIcon; tools: ManagementTool[] }

const sections: ManagementSection[] = [
  {
    id: 'resort', title: 'Resort Setup', icon: Building2,
    description: 'Rooms, tables and guest-facing services',
    tools: [
      { id: 'rooms', label: 'Rooms Manager', description: 'Add and organize rooms', searchTerms: 'inventory units accommodation' },
      { id: 'tables', label: 'Tables Manager', description: 'Set up restaurant tables', searchTerms: 'seating floor plan' },
      { id: 'services', label: 'Service Catalog', description: 'Manage offered services and prices', searchTerms: 'front desk offerings' }
    ]
  },
  {
    id: 'restaurant', title: 'Restaurant', icon: Store,
    description: 'Food and beverage configuration',
    tools: [
      { id: 'menu', label: 'Menu Management', description: 'Edit menu items and their prices', searchTerms: 'food drinks dishes' },
      { id: 'menu-categories', label: 'Menu Categories', description: 'Organize menu sections', searchTerms: 'food groups' }
    ]
  },
  {
    id: 'pricing', title: 'Pricing & Payments', icon: CreditCard,
    description: 'Discount rules and accepted payments',
    tools: [
      { id: 'discounts', label: 'Discount Management', description: 'Manage available discount types', searchTerms: 'senior citizen pwd promotions' },
      { id: 'methods', label: 'Payment Methods', description: 'Configure accepted payment options', searchTerms: 'cash card digital' }
    ]
  },
  {
    id: 'receipts', title: 'Receipts', icon: ReceiptText,
    description: 'Printed receipt configuration',
    tools: [
      { id: 'receipt-settings', label: 'Receipt Settings', description: 'Set receipt details and preferences', searchTerms: 'print footer header' },
      { id: 'receipt-builder', label: 'Receipt Builder', description: 'Arrange receipt layout and fields', searchTerms: 'template design' }
    ]
  },
  {
    id: 'people', title: 'People & Access', icon: Users,
    description: 'Team records and access permissions',
    tools: [
      { id: 'employees', label: 'Employees', description: 'Manage employee records', searchTerms: 'staff team people' },
      { id: 'roles', label: 'Roles & Permissions', description: 'Define roles and access levels', searchTerms: 'security rights privileges' }
    ]
  }
]

export function SystemManagement() {
  const [query, setQuery] = useState('')
  const filter = query.trim().toLocaleLowerCase()
  const filtered = useMemo(() => sections.map(section => ({
    ...section,
    tools: section.tools.filter(tool =>
      !filter || [tool.label, tool.description, tool.searchTerms]
        .filter(Boolean).join(' ').toLocaleLowerCase().includes(filter)
    )
  })).filter(section => section.tools.length), [filter])
  const visibleCount = filtered.reduce((total, section) => total + section.tools.length, 0)
  const totalCount = sections.reduce((total, section) => total + section.tools.length, 0)

  return <section className="sm-page" aria-labelledby="sm-page-heading">
    <div className="section-header sm-heading">
      <div>
          <h1 id="sm-page-heading">System Management</h1>
        
      </div>
    </div>

    <div className="sm-toolbar">
      <label className="sm-search" htmlFor="sm-tool-search">
        <Search size={19} aria-hidden="true" />
        <input
          id="sm-tool-search"
          type="search"
          aria-label="Search management tools"
          placeholder="Search management tools"
          autoComplete="off"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        {query && <button type="button" className="sm-clear" onClick={() => setQuery('')} aria-label="Clear search">
          <X size={16} aria-hidden="true" />
        </button>}
      </label>
    </div>
    <span className="sm-announcement" role="status" aria-live="polite" aria-atomic="true">
      {filter ? `${visibleCount} of ${totalCount} tools` : `${totalCount} management tools`}
    </span>

    {/* Stable wrapper: search updates do not replay entrance motion. */}
    <div className="sm-results-stage">
    {filtered.length ? <div className="sm-grid">
      {filtered.map(section => <article className="sm-category" key={section.id}>
        <div className="sm-category-head">
          <span className="sm-category-icon" aria-hidden="true"><section.icon size={19} strokeWidth={1.9} /></span>
          <div>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </div>
        </div>
        <div className="sm-items">
          {section.tools.map(tool => tool.id === 'tables' || tool.id === 'rooms' || tool.id === 'services' || tool.id === 'menu-categories' || tool.id === 'menu' || tool.id === 'methods' || tool.id === 'discounts' ? <a className="sm-tool sm-tool-link" key={tool.id} href={tool.id === 'discounts' ? '#systems/discounts' : tool.id === 'rooms' ? '#systems/rooms' : tool.id === 'services' ? '#systems/services' : tool.id === 'menu-categories' ? '#systems/menu-categories' : tool.id === 'menu' ? '#systems/menu' : tool.id === 'methods' ? '#systems/payment-methods' : '#systems/tables'}>
            <div className="sm-tool-copy"><h3>{tool.label}</h3><p>{tool.description}</p></div>
          </a> : <div className="sm-tool" key={tool.id}>
            <div className="sm-tool-copy">
              <h3>{tool.label}</h3>
              <p>{tool.description}</p>
            </div>
          </div>)}
        </div>
      </article>)}
    </div> : <div className="sm-empty" role="status">
      <Search size={23} aria-hidden="true" />
      <h2>No matching management tools</h2>
      <p>Try searching for rooms, menu, discounts or receipts</p>
      <button type="button" onClick={() => setQuery('')}>Clear search</button>
    </div>}
    </div>
  </section>
}
