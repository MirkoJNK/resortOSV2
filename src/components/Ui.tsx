import type {LucideIcon} from 'lucide-react'
import {ArrowRight} from 'lucide-react'

/** resortOS shared dashboard controls — one geometry and icon language */
export type IconTone = 'lime' | 'blue' | 'mint' | 'rose'

export function CircleAction({onClick,label='Open details'}:{onClick:()=>void;label?:string}){
 return <button type="button" className="circle-action" aria-label={label} title={label} onClick={onClick}><ArrowRight size={16} strokeWidth={1.9} aria-hidden="true"/></button>
}

export function StatIcon({icon:Icon,tone='lime'}:{icon:LucideIcon;tone?:IconTone}){
 return <span className={`stat-icon ${tone}`} aria-hidden="true"><Icon size={18} strokeWidth={1.9}/></span>
}

/** Keep alignment, header spacing, icon sizing and affordances consistent across dashboard cards */
export function PanelHeader({icon,title,tone='lime',onOpen,actionLabel}:{icon:LucideIcon;title:string;tone?:IconTone;onOpen:()=>void;actionLabel:string}){
 return <div className="panel-head"><StatIcon icon={icon} tone={tone}/><h2>{title}</h2><CircleAction label={actionLabel} onClick={onOpen}/></div>
}
