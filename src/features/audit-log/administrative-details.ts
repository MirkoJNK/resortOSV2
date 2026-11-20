import type { AuditEvent, AuditValue } from './model'
import type { DetailBlock, DetailFact } from './contextual-details'
import { PERMISSION_CATALOG } from '../roles-permissions/catalog'
import { isEmployeeRole, roleLabels } from '../employees/model'
import { money } from './presentation'

export type AdministrativeDetails = {
  title: string; actorHeading: string; facts: DetailFact[]; blocks: DetailBlock[]
}
const absent = 'Not recorded'
const item = (label: string, value: string | null | undefined): DetailFact => ({label,value:value || absent})
const valueText = (value: AuditValue | undefined) => value === null || value === undefined || value === '' ? absent : String(value)
const nice = (value: string) => value.replace(/[-_]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())
const role = (value: AuditValue | undefined) => isEmployeeRole(value) ? roleLabels[value].replace(/ Employee$/,'') : valueText(value)
const entityLabel: Record<string,string> = {
  employee:'Employee',room:'Room',table:'Table','menu-item':'Menu item',service:'Service',ticket:'Ticket'
}
const actionHeading = (action: string) => action === 'created' ? 'Created by' : action === 'updated' ? 'Changed by' :
  action === 'deleted' ? 'Deleted by' : action === 'deactivated' ? 'Deactivated by' :
  action === 'reactivated' ? 'Reactivated by' : 'Performed by'
type TableDetail = {area:string;shape:string;chairs:string;position:string;rotation:string}
const tableDetail=(state:AuditValue|undefined):TableDetail|null=>{
  if(typeof state!=='string')return null
  const match=/^(.*)\/(round|square|rectangle)\/(\d{1,2})\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+)$/.exec(state)
  return match?{area:match[1],shape:nice(match[2]),chairs:match[3],
    position:`${match[4]}, ${match[5]}`,rotation:`${match[6]}°`}:null
}

/** Display only recorded, business-meaningful differences. Technical snapshots stay in audit evidence. */
function managementChanges(event: AuditEvent): DetailBlock[] {
  const before=event.before??{},after=event.after??{}
  const kind=event.target.kind
  const rows: Extract<DetailBlock,{kind:'changes'}>['rows']=[]
  for(const key of [...new Set([...Object.keys(before),...Object.keys(after)])]) {
    if(before[key]===after[key])continue
    if(key==='name') rows.push({field:'Name',before:valueText(before[key]),after:valueText(after[key])})
    if(key==='active' && !/\.(deactivated|reactivated)$/.test(event.type)) rows.push({field:'Availability',
      before:before[key]===true?'Active':before[key]===false?'Inactive':absent,
      after:after[key]===true?'Active':after[key]===false?'Inactive':absent})
    if(key==='status')rows.push({field:'Status',before:valueText(before[key]),after:valueText(after[key])})
    if(key==='value')rows.push({field:event.type.includes('priority')?'Priority':
      event.type.includes('assignee')?'Assignee':kind==='ticket'?'Status':
      kind==='service'||kind==='menu-item'?'Price':kind==='discount'?'Discount amount':'Change',
      before:['service','menu-item','discount'].includes(kind)&&typeof before[key]==='number' ? money(Number(before[key])) : valueText(before[key]),
      after:['service','menu-item','discount'].includes(kind)&&typeof after[key]==='number' ? money(Number(after[key])) : valueText(after[key])})
    if(key==='state') {
      if(kind==='employee') rows.push({field:'Main role',before:role(before[key]),after:role(after[key])})
      else if(kind==='room')rows.push({field:'Room code',before:valueText(before[key]),after:valueText(after[key])})
      else if(kind==='service')rows.push({field:'Billing unit',before:valueText(before[key]),after:valueText(after[key])})
      else if(kind==='table'){
        const oldTable=tableDetail(before[key]),newTable=tableDetail(after[key])
        if(oldTable&&newTable)for(const [field,label] of ([['area','Dining area'],['shape','Shape'],
          ['chairs','Chairs'],['position','Position on floor plan'],['rotation','Rotation']] as const)){
          if(oldTable[field]!==newTable[field])rows.push({field:label,before:oldTable[field],after:newTable[field]})
        }
      }
    }
  }
  return rows.length?[{kind:'changes',title:'Changes',rows}]:[]
}

export function managementDetails(event: AuditEvent): AdministrativeDetails {
  const kind=event.target.kind
  const name=event.after?.name??event.targetLabel??event.before?.name??
    (kind==='ticket'&&/^\d{1,9}$/.test(event.target.id)?`Ticket #${event.target.id}`:undefined)
  const noun=entityLabel[kind]??nice(kind)
  const action=event.type.split('.').at(-1)??'updated'
  const employee=kind==='employee'
  const changes=managementChanges(event)
  const changedFields=changes.flatMap(block=>block.kind==='changes'?block.rows.map(row=>row.field):[])
  const onlyRole=action==='updated'&&employee&&changedFields.length===1&&changedFields[0]==='Main role'
  const onlyName=action==='updated'&&employee&&changedFields.length===1&&changedFields[0]==='Name'
  const title=onlyRole?'Employee role changed':onlyName?'Employee name changed':
    `${noun} ${action==='updated'?'updated':action==='created'?'created':action==='deleted'?'deleted':
      action==='deactivated'?'deactivated':action==='reactivated'?'reactivated':nice(action).toLowerCase()}`
  const facts=[item(noun,valueText(name))]
  if(action==='created'&&employee) facts.push(item('Main role',role(event.after?.state??event.after?.department)))
  if(action==='created'&&kind==='room'&&event.after?.state) facts.push(item('Room code',valueText(event.after.state)))
  if(action==='created'&&kind==='table'){
    const table=tableDetail(event.after?.state)
    if(table)facts.push(item('Dining area',table.area),item('Shape',table.shape),item('Chairs',table.chairs))
  }
  if(action==='created'&&(kind==='service'||kind==='menu-item')&&typeof event.after?.value==='number')
    facts.push(item('Price',money(event.after.value)))
  if(event.outcome==='Failed'&&event.after?.reason)facts.push(item('Reason',valueText(event.after.reason)))
  return {title,actorHeading:actionHeading(action),facts,
    blocks: action==='created'||action==='deleted'||action==='deactivated'||action==='reactivated'?[]:changes}
}

const catalog = new Map<string,{label:string;module:string}>(PERMISSION_CATALOG.map(p=>[p.id,p]))
const permissionLabel=(id:string)=>catalog.get(id)?.label??'Permission not in current catalog'
const listed=(title:string,ids:string[]):DetailBlock[] => ids.length ?
  [{kind:'list',title,rows:ids.map(permissionLabel)}] : []
const permissionRefs=(event: AuditEvent,kind:string)=>event.references.filter(ref=>ref.kind===kind).map(ref=>ref.id)
const departments=(value:AuditValue|undefined)=>String(value??'').split(',').map(s=>s.trim()).filter(s=>s&&s!=='None')

export function accessDetails(event: AuditEvent): AdministrativeDetails {
  const type=event.type.slice('access.'.length)
  const before=event.before??{},after=event.after??{}
  const employee=event.targetLabel ?? valueText(after.employee??before.employee)
  if(type.startsWith('permission.')) {
    const action=type.slice('permission.'.length)
    const id=permissionRefs(event,'permission')[0]
    const permission=id?catalog.get(id):undefined
    const title=`Permission ${action}`
    return {title,actorHeading:action==='granted'?'Granted by':action==='revoked'?'Revoked by':
      action==='restricted'?'Restricted by':'Restored by',
      facts:[item('Employee',employee),item('Permission',permission?.label??valueText(after.permission??before.permission)),
        item('Department',permission?.module??absent)],blocks:[]}
  }
  if(type==='subrole.created'||type==='subrole.updated') {
    const created=type==='subrole.created'
    const oldPermissions=permissionRefs(event,'permission-before')
    const newPermissions=permissionRefs(event,'permission-after')
    const newSet=new Set(newPermissions),oldSet=new Set(oldPermissions)
    const added=newPermissions.filter(id=>!oldSet.has(id))
    const removed=oldPermissions.filter(id=>!newSet.has(id))
    const name=valueText(after.subroleName??event.targetLabel??before.subroleName)
    const rename=before.subroleName&&after.subroleName&&before.subroleName!==after.subroleName
    return {title:created?'Subrole created':rename?(added.length||removed.length?'Subrole updated':'Subrole renamed'):'Subrole permissions changed',
      actorHeading:created?'Created by':'Changed by',facts:[item('Subrole',name)],blocks:[
        ...(rename?[{kind:'changes' as const,title:'Name changed',rows:[{
          field:'Subrole name',before:valueText(before.subroleName),after:valueText(after.subroleName)}]}]:[]),
        ...listed(created?'Permissions included':'Permission added',created?newPermissions:added),
        ...(!created?listed('Permission removed',removed):[])
      ]}
  }
  if(type==='subrole.assigned'||type==='subrole.removed') {
    const assigned=type==='subrole.assigned'
    return {title:assigned?'Subrole assigned':'Subrole removed',actorHeading:assigned?'Assigned by':'Removed by',
      facts:[item('Employee',employee),item('Subrole',valueText(after.subroleName??before.subroleName))],blocks:[]}
  }
  if(type==='ticket-departments.changed') {
    const old=departments(before.departments),next=departments(after.departments)
    const added=next.filter(d=>!old.includes(d)),removed=old.filter(d=>!next.includes(d))
    const grant=added.length===1&&!removed.length, revoke=removed.length===1&&!added.length
    return {title:grant?'Ticket access granted':revoke?'Ticket access revoked':'Ticket access changed',
      actorHeading:grant?'Granted by':revoke?'Revoked by':'Changed by',
      facts:[item('Employee',employee),...(grant||revoke?[item('Department',grant?added[0]:removed[0])]:[])],
      blocks:grant||revoke?[]:[{kind:'changes',title:'Department access',rows:[{
        field:'Departments',before:old.join(', ')||'None',after:next.join(', ')||'None'}]}]}
  }
  return {title:event.title,actorHeading:'Performed by',facts:[item('Employee',employee),
    ...(event.outcome==='Failed'&&after.reason?[item('Reason',valueText(after.reason))]:[])],blocks:[]}
}
