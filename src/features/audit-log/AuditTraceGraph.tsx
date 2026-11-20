import { useEffect, useMemo, useState } from 'react'
import { Background, BaseEdge, Controls, Position, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { Edge, EdgeProps, Node } from '@xyflow/react'
import { Pause, Play } from 'lucide-react'
import type { RoomTrace, RoomGraphNode } from './room-trace'
import { buildRoomGraph, focusedEdges } from './room-trace'
import { CATEGORY_TONES } from './presentation'
import {ContextualDetailsView} from './ContextualDetailsView'
import {contextualTraceDetails} from './contextual-details'
import {dateText} from './presentation'

type Props={trace:RoomTrace;selectedId:string|null;onSelect:(value:RoomGraphNode|null)=>void}
type PulseData={playing:boolean;active:boolean}
const lanes=['Check-in','Restaurant','Services','Payments','Checkout'] as const
const laneX=(lane:number)=>24+lane*248

/** Orthogonal square-corner connections. Channels sit in the gaps between nodes. */
export function orthogonalPath(sx:number,sy:number,tx:number,ty:number):string {
  const gap=tx-sx
  if(gap>290)return `M ${sx} ${sy} H ${sx+14} V -30 H ${tx-14} V ${ty} H ${tx}`
  const channel=sx+Math.max(2,gap/2)
  return `M ${sx} ${sy} H ${channel} V ${ty} H ${tx}`
}
function TraceEdge(props:EdgeProps<Edge<PulseData>>) {
  const path=orthogonalPath(props.sourceX,props.sourceY,props.targetX,props.targetY)
  const active=props.data?.playing&&props.data?.active
  return <>
    <BaseEdge path={path} style={{stroke:active?'#d49556':'#a6b7a7',strokeWidth:active?2.5:1.6,
      opacity:props.data?.playing&&!props.data?.active?0.4:1}}/>
    {active&&<path d={path} className="al-energy-pulse" fill="none" pointerEvents="none"/>}
  </>
}
const edgeTypes={orthogonal:TraceEdge}

function Graph({trace,selectedId,onSelect}:Props) {
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set())
  const [playing,setPlaying]=useState(false)
  const {fitView}=useReactFlow()
  useEffect(()=>{setExpanded(new Set());setPlaying(false)},[trace.id])
  useEffect(()=>{
    const visibility=()=>{if(document.hidden)setPlaying(false)}
    document.addEventListener('visibilitychange',visibility)
    return ()=>document.removeEventListener('visibilitychange',visibility)
  },[])
  const model=useMemo(()=>buildRoomGraph(trace,expanded),[trace,expanded])
  const focus=useMemo(()=>focusedEdges(model,selectedId),[model,selectedId])
  const {nodes,edges}=useMemo(()=>{
    const nodes:Node[]=[]
    const columns=lanes.map(()=>0)
    for(let lane=0;lane<lanes.length;lane++)nodes.push({
      id:`heading:${lane}`,type:'default',position:{x:laneX(lane),y:-82},
      data:{label:lanes[lane]},className:'al-lane-heading',
      sourcePosition:Position.Right,targetPosition:Position.Left,draggable:false,selectable:false,connectable:false
    })
    for(const item of model.nodes){
      const row=columns[item.lane]++
      nodes.push({id:item.id,position:{x:laneX(item.lane),y:32+row*156},
        data:{label:<div className="al-node-content" role="button" tabIndex={0} aria-label={`Inspect ${item.title}`}
          onKeyDown={key=>{if(key.target===key.currentTarget&&(key.key==='Enter'||key.key===' ')){
            key.preventDefault();onSelect(item)
          }}}>
          <div className="al-node-heading"><span className={`al-mini-icon tone-${CATEGORY_TONES[item.category]}`} aria-hidden="true"/>
            <strong>{item.title}</strong></div>
          <span>{item.subtitle}</span>
          <small>{new Date(item.at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small>
          {item.kind==='group'&&<button type="button" className="al-expand" onClick={event=>{
            event.stopPropagation();if(expanded.has(item.id)&&item.members?.some(member=>member.id===selectedId))onSelect(null)
            setExpanded(old=>{
              const next=new Set(old);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next
            })
          }}>{expanded.has(item.id)?'Collapse':'Expand'} {item.members?.length} charges</button>}
        </div>},className:`al-graph-node tone-${CATEGORY_TONES[item.category]}${selectedId===item.id?' al-graph-selected':''}`,
        sourcePosition:Position.Right,targetPosition:Position.Left,draggable:false,deletable:false,connectable:false})
    }
    const edges:Edge<PulseData>[]=model.edges.map(edge=>({id:edge.id,source:edge.source,target:edge.target,
      type:'orthogonal',animated:false,selectable:false,deletable:false,
      data:{playing,active:focus.has(edge.id)}}))
    return {nodes,edges}
  },[model,selectedId,expanded,focus,playing])
  useEffect(()=>{const handle=window.requestAnimationFrame(()=>{void fitView({padding:.24,duration:180,maxZoom:1})});return ()=>window.cancelAnimationFrame(handle)},[expanded,trace.id,fitView])
  return <div className="al-graph" role="region" aria-label="Read-only room stay transaction trace">
    <div className="al-graph-controls"><button type="button" className={`al-play ${playing?'is-playing':''}`} aria-pressed={playing}
      onClick={()=>setPlaying(current=>!current)}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?'Stop Trace':'Play Trace'}</button></div>
    <ReactFlow nodes={nodes} edges={edges} edgeTypes={edgeTypes} fitView fitViewOptions={{padding:.2,maxZoom:1}}
      minZoom={.2} maxZoom={1.5} nodesDraggable={false} nodesConnectable={false}
      elementsSelectable nodesFocusable edgesFocusable={false} edgesReconnectable={false}
      onNodeClick={(_,node)=>{onSelect(model.nodes.find(item=>item.id===node.id)??null)}} onPaneClick={()=>onSelect(null)}
      panOnDrag zoomOnScroll zoomOnPinch zoomOnDoubleClick={false}
      attributionPosition="bottom-left" proOptions={{hideAttribution:true}}>
      <Background color="#e9ede5" gap={22}/><Controls showInteractive={false}/>
    </ReactFlow>
  </div>
}
export function AuditTraceGraph(props:Props){return <ReactFlowProvider><Graph {...props}/></ReactFlowProvider>}
export function TraceRecordDetails({record,trace}:{record:RoomGraphNode|null;trace:RoomTrace}){
  if(!record)return <p className="al-details-empty">Select a transaction to see its recorded details</p>
  const detail=contextualTraceDetails(record,trace)
  return <div className="al-detail-body"><div className="al-detail-top"><strong>{detail.title}</strong>
    <span className={`al-badge tone-${CATEGORY_TONES[record.category]}`}>{record.category}</span></div>
    <ContextualDetailsView detail={{...detail,at:dateText(detail.at)}}/>
  </div>
}
