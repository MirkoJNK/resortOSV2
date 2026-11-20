import type { PaymentMethod } from './model'
export function PaymentMethodSelect({ methods, value, onChange, disabled=false, id='payment-method' }: {
  methods: PaymentMethod[]; value: string; onChange: (id:string)=>void; disabled?:boolean; id?:string
}) {
  return <label className="pm-payment-select" htmlFor={id}>Payment Method
    <select id={id} value={value} disabled={disabled||methods.length===0} onChange={e=>onChange(e.target.value)} required>
      <option value="">Select payment method</option>
      {methods.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
    {!methods.some(m=>m.active)&&<span className="pm-payment-unavailable">No active payment methods</span>}
  </label>
}
