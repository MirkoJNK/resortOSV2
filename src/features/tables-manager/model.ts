/** Tables Manager owns a separate, versioned browser-local configuration namespace. */
export type Shape = 'round' | 'square' | 'rectangle'
export type Lifecycle = 'active' | 'inactive'
export type DiningTable = { id: string; label: string; area: string; shape: Shape; chairs: number; status: Lifecycle; x: number; y: number; rotation: number }
export type TableConfiguration = { version: 1; areas: string[]; tables: DiningTable[] }
export const WIDTH = 1240
export const HEIGHT = 680
export const GRID = 8
export const STORAGE_KEY = 'resortos.tables-manager.v1'
export const snap = (n: number) => Math.round(n / GRID) * GRID
export const maxChairs = (shape: Shape) => shape === 'rectangle' ? 20 : 8
export const tableDimensions = (t: Pick<DiningTable, 'shape' | 'chairs'>) => t.shape === 'round' ? {w:78,h:78} : t.shape === 'square' ? {w:88,h:88} : {w:116+Math.max(0,Math.ceil((t.chairs-4)/2))*30,h:76}
export function chairPositions(table: Pick<DiningTable,'shape'|'chairs'>): {x:number;y:number}[] {
  const n=table.chairs; const d=tableDimensions(table)
  if (table.shape==='round') return Array.from({length:n},(_,i)=>({x:snap(Math.cos(-Math.PI/2+2*Math.PI*i/n)*67),y:snap(Math.sin(-Math.PI/2+2*Math.PI*i/n)*67)}))
  if (table.shape==='square') {
    const p=[[0,-64],[64,0],[0,64],[-64,0],[-40,-64],[64,-40],[40,64],[-64,40]]
    return p.slice(0,n).map(([x,y])=>({x,y}))
  }
  const slots=Math.ceil(n/2), span=d.w-26
  return Array.from({length:n},(_,i)=>({x:snap(slots===1?0:-span/2+Math.floor(i/2)*span/(slots-1)),y:i%2?60:-60}))
}
export function extent(table:DiningTable) {
  const d=tableDimensions(table), points:[number,number][]=[[-d.w/2,-d.h/2],[d.w/2,-d.h/2],[d.w/2,d.h/2],[-d.w/2,d.h/2]]
  for(const c of chairPositions(table)) for(const x of [-12,12]) for(const y of [-11,11]) points.push([c.x+x,c.y+y])
  const angle=table.rotation*Math.PI/180, co=Math.cos(angle),si=Math.sin(angle)
  return points.reduce((acc,[x,y])=>({w:Math.max(acc.w,Math.abs(x*co-y*si)*2),h:Math.max(acc.h,Math.abs(x*si+y*co)*2)}),{w:0,h:0})
}
export function inBounds(t:DiningTable) {const e=extent(t);return t.x-e.w/2>=24&&t.y-e.h/2>=24&&t.x+e.w/2<=WIDTH-24&&t.y+e.h/2<=HEIGHT-24}

/** Constrain the entire rotated table and its chairs to the editable area.
 * Keep live dragging continuous; snap only when finalizing a move. */
export function boundedTablePosition(table: DiningTable, x: number, y: number, toGrid = false) {
  const size = extent(table)
  const minX = 24 + size.w / 2, maxX = WIDTH - 24 - size.w / 2
  const minY = 24 + size.h / 2, maxY = HEIGHT - 24 - size.h / 2
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  if (toGrid) {
    return {
      x: clamp(snap(x), Math.ceil(minX / GRID) * GRID, Math.floor(maxX / GRID) * GRID),
      y: clamp(snap(y), Math.ceil(minY / GRID) * GRID, Math.floor(maxY / GRID) * GRID),
    }
  }
  return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) }
}

export function overlaps(a:DiningTable,b:DiningTable){if(a.area!==b.area)return false;const x=extent(a),y=extent(b);return Math.abs(a.x-b.x)<(x.w+y.w)/2-15&&Math.abs(a.y-b.y)<(x.h+y.h)/2-15}
export const copy = (value:TableConfiguration):TableConfiguration => ({version:1,areas:[...value.areas],tables:value.tables.map(t=>({...t}))})
const example=(id:string,label:string,shape:Shape,chairs:number,area:string,x:number,y:number,status:Lifecycle='active'):DiningTable=>({id,label,shape,chairs,area,x,y,status,rotation:0})
export const sampleConfiguration:TableConfiguration={version:1,areas:['Main Dining','Terrace','VIP Room','Outdoor Dining'],tables:[
  example('table-001','Table 1','round',4,'Main Dining',180,185),
  example('table-002','Window A','rectangle',6,'Main Dining',510,185),
  example('table-003','VIP Table','square',4,'Main Dining',850,175),
  example('table-004','Table 4','round',2,'Main Dining',290,470),
  example('table-005','Table 5','rectangle',8,'Main Dining',720,480),
  example('table-006','Terrace 1','round',4,'Terrace',300,230),
  example('table-007','Terrace 2','square',2,'Terrace',710,290),
  example('table-008','Garden Table','round',4,'Main Dining',1040,475,'inactive')
]}
export function validateConfig(value:unknown): value is TableConfiguration {
  if(!value||typeof value!=='object')return false
  const v=value as Partial<TableConfiguration>
  if(v.version!==1||!Array.isArray(v.areas)||!Array.isArray(v.tables)||!v.areas.length||v.areas.length>100||v.tables.length>1000)return false
  const names=new Set<string>()
  for(const area of v.areas){if(typeof area!=='string'||!area.trim()||area.length>48||names.has(area.trim().toLowerCase()))return false;names.add(area.trim().toLowerCase())}
  const ids=new Set<string>(),labels=new Set<string>()
  for(const raw of v.tables){
    if(!raw||typeof raw!=='object')return false
    const t=raw as DiningTable
    if(typeof t.id!=='string'||!t.id||ids.has(t.id)||typeof t.label!=='string'||!t.label.trim()||t.label.length>32)return false
    ids.add(t.id)
    if(labels.has(t.label.trim().toLowerCase()))return false;labels.add(t.label.trim().toLowerCase())
    if(!v.areas.includes(t.area)||!['round','square','rectangle'].includes(t.shape)||!Number.isInteger(t.chairs)||t.chairs<1||t.chairs>maxChairs(t.shape)||!['active','inactive'].includes(t.status))return false
    if(!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.rotation)||t.rotation%90!==0||!inBounds(t))return false
  }
  return true
}
export function readTables():{data:TableConfiguration;error?:string}{
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw===null)return{data:copy(sampleConfiguration)};const parsed:unknown=JSON.parse(raw);if(!validateConfig(parsed))return{data:copy(sampleConfiguration),error:'Saved Tables Manager data is invalid. It was not overwritten.'};return{data:copy(parsed)}}
  catch{return{data:copy(sampleConfiguration),error:'Could not read saved Tables Manager data. It was not overwritten.'}}
}
export function writeTables(value:TableConfiguration):{ok:boolean;error?:string}{
  if(!validateConfig(value))return{ok:false,error:'Fix invalid names, chair counts or table positions before saving.'}
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));return{ok:true}}
  catch{return{ok:false,error:'Could not save tables in this browser. Your draft is still available.'}}
}
export function nextId():string {return `table-${crypto.randomUUID()}`}
