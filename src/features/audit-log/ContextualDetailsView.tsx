import type { ContextualDetails, DetailBlock, DetailFact } from './contextual-details'
import { money } from './presentation'

function Facts({ rows }: { rows: DetailFact[] }) {
  return <dl className="al-context-facts">{rows.map((row, index) =>
    <div key={`${row.label}:${index}`} className={row.strong ? 'al-context-emphasis' : undefined}>
      <dt>{row.label}</dt><dd>{row.value}</dd>
    </div>)}</dl>
}

function Blocks({ blocks }: { blocks: DetailBlock[] }) {
  return <>{blocks.map((block, index) => <section className="al-context-section" key={`${block.title}:${index}`}>
    <h3>{block.title}</h3>
    {block.kind === 'facts' ? <Facts rows={block.rows}/> :
      block.kind === 'items' ? <table className="al-context-items"><thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Amount</th></tr></thead>
        <tbody>{block.rows.length ? block.rows.map((item, i) => <tr key={`${item.name}:${i}`}>
          <td><strong>{item.name}</strong><small>{money(item.unitCentavos)} each
            {item.employee && <> · Removed by {item.employee}</>}</small></td>
          <td>{item.quantity}</td><td>{money(item.totalCentavos)}</td>
        </tr>) : <tr><td colSpan={3}>No recorded items</td></tr>}</tbody></table> :
      block.kind === 'list' ? <ul className="al-context-list">{block.rows.map((row,i)=><li key={`${row}:${i}`}>{row}</li>)}</ul> :
      block.kind === 'changes' ? <div className="al-context-changes">{block.rows.map((row,i) => <div key={`${row.field}:${i}`}>
        <strong>{row.field}</strong><span><del>{row.before}</del><span aria-hidden="true">→</span><ins>{row.after}</ins></span>
      </div>)}</div> :
      <div className="al-context-charges">{block.rows.map((charge,i) =>
        charge.order ? <details key={`${charge.label}:${i}`} className="al-context-order">
          <summary><span>{charge.label}<small>Show order breakdown</small></span>
            <strong>{money(charge.amountCentavos)}</strong></summary>
          <div className="al-context-order-content"><Blocks blocks={charge.order}/></div>
        </details> : <div key={`${charge.label}:${i}`} className="al-context-charge">
          <span>{charge.label}</span><strong>{money(charge.amountCentavos)}</strong>
        </div>)}</div>}
  </section>)}</>
}

/** Shared category-specific presentation for the Event dialog and Trace selected node. */
export function ContextualDetailsView({ detail }: { detail: ContextualDetails }) {
  return <div className="al-context-content">
    {detail.failed && <p className="al-context-failure">This action failed</p>}
    <Facts rows={[{label:'Date',value: detail.at}, {label:detail.actorHeading??'Performed by',value:detail.actor}, ...detail.facts]}/>
    <Blocks blocks={detail.blocks}/>
  </div>
}
