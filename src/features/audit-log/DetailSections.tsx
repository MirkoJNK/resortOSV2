import type {DetailSection} from './transaction-details'

/** Shared compact, scrollable transaction facts in Events and Trace View. */
export function DetailSections({sections}:{sections:DetailSection[]}){
  return <>{sections.map((section,index)=><section className="al-transaction-section" key={`${section.title}:${index}`}>
    <h3>{section.title}</h3>
    <dl>{section.rows.map(([name,value],rowIndex)=><div key={`${name}:${rowIndex}`}>
      <dt>{name}</dt><dd>{value}</dd>
    </div>)}</dl>
  </section>)}</>
}
