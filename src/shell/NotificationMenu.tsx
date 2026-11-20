import {useEffect,useMemo,useRef,useState} from 'react'
import {Bell,Check,CheckCheck} from 'lucide-react'
import type {Notification} from '../features/notifications/model'
import {manilaDate,NOTIFICATIONS_EVENT,NOTIFICATION_READ_KEY} from '../features/notifications/model'
import {loadNotifications,markNotificationRead} from '../features/notifications/notifications'
import {SUPPORT_EVENT,SUPPORT_KEY} from '../features/support/tickets'
import {AUDIT_EVENT_NAME} from '../features/audit-log/model'
import './notification-menu.css'

const formatPeso=(value:number)=>`₱${(value/100).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`
type Group={id:string;items:Notification[];date:string}
export function NotificationMenu({accountId,onOpen,busy=false,adminWorkspace=false}:{
  accountId:string;onOpen:(notification:Notification)=>void;busy?:boolean;adminWorkspace?:boolean
}){
  const [open,setOpen]=useState(false)
  const [items,setItems]=useState<Notification[]>([])
  const [error,setError]=useState('')
  const root=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    let valid=true
    const refresh=()=>{void loadNotifications(accountId).then(result=>{if(valid){setItems(result);setError('')}})
      .catch(reason=>{if(valid)setError(reason instanceof Error?reason.message:'Unable to load notifications')})}
    refresh()
    const storage=(event:StorageEvent)=>{if([NOTIFICATION_READ_KEY,SUPPORT_KEY].includes(event.key??''))refresh()}
    window.addEventListener(NOTIFICATIONS_EVENT,refresh)
    window.addEventListener(SUPPORT_EVENT,refresh)
    window.addEventListener(AUDIT_EVENT_NAME,refresh)
    window.addEventListener('focus',refresh)
    window.addEventListener('storage',storage)
    return ()=>{valid=false;window.removeEventListener(NOTIFICATIONS_EVENT,refresh);window.removeEventListener(SUPPORT_EVENT,refresh);
      window.removeEventListener(AUDIT_EVENT_NAME,refresh);window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage)}
  },[accountId])
  useEffect(()=>{setOpen(false)},[accountId])
  useEffect(()=>{
    if(!open)return
    const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!root.current?.contains(e.target))setOpen(false)}
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);root.current?.querySelector<HTMLButtonElement>('button')?.focus()}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
  },[open])
  const unread=items.filter(item=>!item.read).length
  const groups=useMemo(()=>{
    const result:Group[]=[]
    const byDate=new Map<string,Notification[]>()
    if(adminWorkspace)for(const item of items.filter(i=>i.kind==='room-posted'&&!i.read)){
      const date=manilaDate(item.at);byDate.set(date,[...(byDate.get(date)??[]),item])
    }
    const emitted=new Set<string>()
    for(const item of items){
      const date=manilaDate(item.at),group=adminWorkspace&&item.kind==='room-posted'&&!item.read?byDate.get(date):undefined
      if(group&&group.length>1){
        if(!emitted.has(date)){result.push({id:`group:${date}`,items:group,date});emitted.add(date)}
      }else result.push({id:item.id,items:[item],date})
    }
    return result
  },[items,adminWorkspace])
  const mark=async(ids:string[])=>{
    try{await markNotificationRead(accountId,ids);setError('')}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to mark notifications as read')}
  }
  const openItem=async(item:Notification)=>{
    await mark([item.id]);setOpen(false);onOpen(item)
  }
  return <div className="notification-menu" ref={root}>
    <button type="button" className="header-circle notification" title="Notifications" aria-label={`Notifications, ${unread} unread`}
      aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(v=>!v)} disabled={busy}>
      <Bell size={17}/>{unread>0&&<span className="notification-indicator" aria-hidden="true"/>}
    </button>
    {open&&<section className="notification-panel" role="dialog" aria-label="Notifications">
      <div className="notification-panel-head"><h2>Notifications</h2>
        {unread>0&&<button type="button" onClick={()=>void mark(items.filter(i=>!i.read).map(i=>i.id))}>
          <CheckCheck size={14}/>Mark all read</button>}</div>
      {error&&<p role="alert" className="notification-error">{error}</p>}
      {groups.length===0?<p className="notification-empty">No new notifications</p>:
        <div className="notification-feed">{groups.map(group=>{
          const grouped=group.items.length>1
          const total=group.items.reduce((sum,i)=>sum+(i.amountCentavos??0),0)
          return <div key={group.id} className={`notification-item ${group.items.some(i=>!i.read)?'is-unread':''}`}>
            {grouped?<>
              <strong>{group.items.length} new room charges</strong>
              <p>Restaurant posted {formatPeso(total)} across {group.items.length} orders</p>
              <small>{group.date} (Manila time)</small>
              <details><summary>View postings</summary><div className="notification-group-list">
                {group.items.map(item=><button type="button" key={item.id} onClick={()=>void openItem(item)}>
                  {item.body}<small>{item.detail}</small></button>)}
              </div></details>
              <button className="notification-mark" type="button" onClick={()=>void mark(group.items.map(i=>i.id))}><Check size={13}/> Mark group read</button>
            </>:<>
              <button className="notification-open" type="button" onClick={()=>void openItem(group.items[0])}>
                <strong>{group.items[0].title}</strong><span>{group.items[0].body}</span><small>{group.items[0].detail}</small>
              </button>
              {!group.items[0].read&&<button type="button" className="notification-mark" onClick={()=>void mark([group.items[0].id])}><Check size={13}/> Mark read</button>}
            </>}
          </div>
        })}</div>}
    </section>}
  </div>
}
