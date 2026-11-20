import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, Search, Trash2, X } from 'lucide-react'
import {
  ReactFlow, Background, Controls, Handle, Position, ReactFlowProvider, useEdgesState,
  useNodesState, useNodesInitialized, useReactFlow
} from '@xyflow/react'
import type { Connection, Edge, Node, NodeProps } from '@xyflow/react'
import { PERMISSION_CATALOG, isPermissionId } from './catalog'
import type { PermissionId } from './catalog'
import type { PermissionView, TicketDepartment } from './model'
import {estimatedPermissionHeight,nextPermissionPosition,PERMISSION_COLUMN_GAP,PERMISSION_COLUMN_START} from './graphLayout'
import {DialogFrame} from '../restaurant-tables/DialogFrame'

type GraphKind = 'root' | 'source' | 'permission' | 'heading'
type GraphData = {title: string; detail: string; kind: GraphKind; restricted?: boolean; pending?: boolean; category?: string}
type GraphNode = Node<GraphData, 'access' | 'heading'>
type GraphEdge = Edge
type SourceNode = {id: string; title: string; detail: string; permissionIds: PermissionId[]}
export type GraphMode = 'employee' | 'subrole'
type Props = {
  mode: GraphMode; rootName: string; rootDetail: string; sources: SourceNode[]
  permissions: PermissionView[]; editable: boolean; onConnectPermission: (id: PermissionId) => void
  onRemovePermission: (id: PermissionId) => void; onRestorePermission: (id: PermissionId) => void
  onRemoveSource?: (id: string) => void; onToggleSource?: (id: string) => void
  onPendingChange?: (pending: boolean) => void
  primaryTicketDepartment?: TicketDepartment | null
  ticketDepartments?: TicketDepartment[]
  canEditTicketDepartments?: boolean
  onTicketDepartmentsChange?: (departments: TicketDepartment[]) => void
}

function NodeCard({data, selected}: NodeProps<GraphNode>) {
  const categoryClass = data.category ? ` rp-category-${data.category.toLowerCase().replace(/\W+/g, '-')}` : ''
  return <div className={`rp-node rp-node-${data.kind}${categoryClass}${selected ? ' selected' : ''}${data.restricted ? ' restricted' : ''}${data.pending ? ' pending' : ''}`}>
    {data.kind !== 'root' && <Handle type="target" position={Position.Left} className="rp-handle" aria-label="Connection input" />}
    <strong title={data.title}>{data.title}</strong>
    <span>{data.restricted ? 'Restricted' : data.pending ? 'Not connected' : data.detail}</span>
    {data.kind !== 'permission' && <Handle type="source" position={Position.Right} className="rp-handle" aria-label="Connection output" />}
  </div>
}
function ColumnHeading({data}:NodeProps<GraphNode>) {
  return <div className="rp-column-heading">{data.title}</div>
}
const nodeTypes = {access: NodeCard,heading: ColumnHeading}
const labelFor = (id: PermissionId) => PERMISSION_CATALOG.find(p => p.id === id)?.label ?? id
type RemovalTarget = {kind:'permission';id:PermissionId;label:string;inherited:boolean} |
  {kind:'subrole';id:string;label:string}

function graphHeading(id:string,title:string,x:number):GraphNode {
  return {id:`heading:${id}`,type:'heading',position:{x,y:-76},data:{title,detail:'',kind:'heading'},
    draggable:false,connectable:false,selectable:false,deletable:false,focusable:false}
}

export function initialNodes(mode:GraphMode,rootName: string, rootDetail: string, sources: SourceNode[],
  permissions: PermissionView[], pending: PermissionId[]): GraphNode[] {
  const nodes: GraphNode[] = mode==='employee' ? [graphHeading('employee','Employee',22),
    graphHeading('roles','Roles & Subroles',288),graphHeading('permissions','Permissions',565)] :
    [graphHeading('subrole','Subrole',22),graphHeading('permissions','Permissions',320)]
  nodes.push({id: 'root', type: 'access', position: {x: 22, y: Math.max(90, 70 + sources.length * 20)},
    data: {title: rootName, detail: rootDetail, kind: 'root'}, deletable: false})
  sources.forEach((source, index) => nodes.push({id: `source:${source.id}`, type: 'access',
    position: {x: 288, y: 34 + index * 116},
    data: {title: source.title, detail: source.detail, kind: 'source'}, deletable: false}))
  const allIds = [...new Set([...permissions.map(p => p.id), ...pending])]
  let nextY=PERMISSION_COLUMN_START
  allIds.forEach(id => {
    const entry = permissions.find(p => p.id === id)
    const title=labelFor(id)
    const detail=PERMISSION_CATALOG.find(p => p.id === id)?.module ?? ''
    nodes.push({id: `permission:${id}`, type: 'access',
      position: {x: mode==='employee' ? 565 : 320, y: nextY},
      data: {title, detail,
        category: PERMISSION_CATALOG.find(p => p.id === id)?.module ?? 'Shared',
        kind: 'permission', restricted: !!entry?.restricted, pending: !entry},
      deletable: true})
    nextY+=estimatedPermissionHeight(title,detail)+PERMISSION_COLUMN_GAP
  })
  return nodes
}
function initialEdges(mode: GraphMode, sources: SourceNode[], permissions: PermissionView[]): GraphEdge[] {
  const edges: GraphEdge[] = []
  for (const source of sources) edges.push({id: `root-to-${source.id}`, source: 'root', target: `source:${source.id}`,
    deletable: false, type: 'smoothstep', style: {stroke: '#9bb28e', strokeWidth: 1.9}})
  for (const p of permissions) {
    const edgeStyle = {stroke: p.restricted ? '#bc8983' : '#91b364', strokeWidth: 1.9,
      strokeDasharray: p.restricted ? '5 5' : undefined}
    if (mode === 'subrole' || p.sources.includes('Individual'))
      edges.push({id: `direct:${p.id}`, source: 'root', target: `permission:${p.id}`, type: 'smoothstep',
        style: edgeStyle, deletable: true})
    for (const source of sources) if (p.sources.includes(source.title) ||
      (source.id === 'main' && p.sources.includes('Main Role')))
      edges.push({id: `inherited:${source.id}:${p.id}`, source: `source:${source.id}`,
        target: `permission:${p.id}`, type: 'smoothstep', style: edgeStyle, deletable: true})
  }
  return edges
}

function Canvas({mode, rootName, rootDetail, sources, permissions, editable,
  onConnectPermission, onRemovePermission, onRestorePermission, onRemoveSource, onToggleSource, onPendingChange,
  primaryTicketDepartment, ticketDepartments = [], canEditTicketDepartments, onTicketDepartmentsChange}: Props) {
  const [pending, setPending] = useState<PermissionId[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [removal, setRemoval] = useState<RemovalTarget | null>(null)
  const removalRef = useRef<RemovalTarget | null>(null)
  const removalTrigger = useRef<HTMLElement | null>(null)
  const cancelButton = useRef<HTMLButtonElement | null>(null)
  const [positions, setPositions] = useState<Record<string, {x: number; y: number}>>({})
  const [graphReady,setGraphReady] = useState(false)
  const nodesInitialized = useNodesInitialized()
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(initialNodes(mode,rootName, rootDetail, sources, permissions, []))
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>(initialEdges(mode, sources, permissions))
  const {fitView} = useReactFlow()
  useEffect(() => {
    if(!nodesInitialized || graphReady) return
    let canceled=false
    const frame=window.requestAnimationFrame(()=>{
      void fitView({padding:.18,duration:0}).then(()=>{if(!canceled)setGraphReady(true)})
    })
    return ()=>{canceled=true;window.cancelAnimationFrame(frame)}
  },[nodesInitialized,graphReady,fitView])
  const allIds = useMemo(() => new Set([...permissions.map(p => p.id), ...pending]), [permissions, pending])
  const filtered = PERMISSION_CATALOG.filter(p =>
    (category === 'All' || p.module === category) && `${p.label} ${p.module}`.toLowerCase().includes(search.trim().toLowerCase()))

  useEffect(() => {onPendingChange?.(pending.length > 0)}, [pending.length, onPendingChange])
  useEffect(() => () => {onPendingChange?.(false)}, [onPendingChange])

  useEffect(() => {
    setNodes(previous => {
      const existing = new Map(previous.map(node => [node.id,node]))
      const template=initialNodes(mode,rootName,rootDetail,sources,permissions,pending)
      const oldNodes:GraphNode[]=[],appended:GraphNode[]=[]
      // Resolve every existing card first, even if the catalog reorders it.
      // Appending then uses the lowest bottom across the complete existing column.
      for(const node of template.filter(item=>item.data.kind!=='permission'||existing.has(item.id))) {
        const prior=existing.get(node.id)
        oldNodes.push({...node,position:prior ? positions[node.id] ?? prior.position : node.position,measured:prior?.measured})
      }
      for(const node of template.filter(item=>item.data.kind==='permission'&&!existing.has(item.id))) {
        appended.push({...node,position:nextPermissionPosition([...oldNodes,...appended],node.position.x)})
      }
      const resolved=new Map([...oldNodes,...appended].map(node=>[node.id,node]))
      return template.map(node=>resolved.get(node.id)??node)
    })
    setEdges(initialEdges(mode, sources, permissions))
  }, [rootName, rootDetail, sources, permissions, pending, mode, positions, setNodes, setEdges])

  const addPending = useCallback((id: PermissionId) => {
    if (!editable) return
    // The + button and library drop both append below all existing cards.
    // A conflicting drop coordinate never overrides collision-free placement.
    if (!allIds.has(id)) onConnectPermission(id)
    else return
    setSelectedNode(`permission:${id}`)
    setSelectedEdge(null)
  }, [allIds, editable, onConnectPermission])
  const connectPermission = useCallback((id: PermissionId) => {
    if (!editable) return
    onConnectPermission(id)
    setPending(list => list.filter(v => v !== id))
  }, [editable, onConnectPermission])
  const disconnectPermission = (id: PermissionId) => {
    if (mode==='employee' && id==='support.tickets.department-view') return
    if (pending.includes(id)) setPending(list => list.filter(v => v !== id))
    else onRemovePermission(id)
  }
  const handleConnect = useCallback((connection: Connection) => {
    if (connection.source === 'root' && connection.target?.startsWith('permission:')) {
      const id = connection.target.slice('permission:'.length)
      if (isPermissionId(id)) connectPermission(id)
    }
  }, [connectPermission])
  const isValidConnection = useCallback((connection: Connection | Edge) =>
    editable && connection.source === 'root' && connection.target.startsWith('permission:') &&
    isPermissionId(connection.target.slice('permission:'.length)) &&
    !edges.some(edge => edge.source === connection.source && edge.target === connection.target), [editable, edges])
  const removableTarget=(nodeId:string|null,edgeId:string|null):RemovalTarget|null=>{
    const permissionNode=nodeId?.startsWith('permission:')?nodeId:
      edgeId?edges.find(edge=>edge.id===edgeId&&edge.deletable!==false)?.target:null
    if(permissionNode?.startsWith('permission:')){
      const id=permissionNode.slice('permission:'.length)
      if(!isPermissionId(id)||(mode==='employee'&&id==='support.tickets.department-view'))return null
      const view=permissions.find(item=>item.id===id)
      if(!view&&!pending.includes(id))return null
      return {kind:'permission',id,label:labelFor(id),inherited:!!view?.sources.some(source=>source!=='Individual')}
    }
    if(nodeId?.startsWith('source:')&&onRemoveSource){
      const id=nodeId.slice('source:'.length)
      const source=sources.find(item=>item.id===id)
      if(source&&id!=='main')return {kind:'subrole',id,label:source.title}
    }
    return null
  }
  const requestRemoval=(target:RemovalTarget|null)=>{
    if(!editable||!target||removalRef.current)return
    removalTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null
    removalRef.current=target
    setRemoval(target)
  }
  const closeRemoval=()=>{removalRef.current=null;setRemoval(null)}
  const confirmRemoval=()=>{
    const target=removalRef.current
    if(!target)return
    removalRef.current=null
    setRemoval(null)
    if(target.kind==='permission')disconnectPermission(target.id)
    else onRemoveSource?.(target.id)
    setSelectedNode(null);setSelectedEdge(null)
  }
  useEffect(()=>{
    if(!removal)return
    const frame=window.requestAnimationFrame(()=>cancelButton.current?.focus())
    return ()=>window.cancelAnimationFrame(frame)
  },[removal])
  const removeSelected=()=>requestRemoval(removableTarget(selectedNode,selectedEdge))
  const selectedPermissionId = selectedNode?.startsWith('permission:') ? selectedNode.slice('permission:'.length) : null
  const selectedPermission = selectedPermissionId && isPermissionId(selectedPermissionId) ? permissions.find(p => p.id === selectedPermissionId) : undefined
  const selectedSource = selectedNode?.startsWith('source:') ? sources.find(s => `source:${s.id}` === selectedNode) : undefined
  const canRemove = !!((selectedNode?.startsWith('permission:') && !(mode==='employee' && selectedPermissionId==='support.tickets.department-view')) ||
    (selectedNode?.startsWith('source:') && selectedNode !== 'source:main' && onRemoveSource) ||
    (selectedEdge && edges.find(e => e.id === selectedEdge)?.deletable !== false &&
      !(mode==='employee' && edges.find(e => e.id === selectedEdge)?.target==='permission:support.tickets.department-view')))
  const departmentSelected = mode==='employee' && selectedPermissionId==='support.tickets.department-view' && !!primaryTicketDepartment

  return <div className="rp-editor-layout">
    <div className="rp-graph-area">
      <div className="rp-graph-toolbar">
        <span>{permissions.filter(p => p.effective).length} permissions</span>
        <div className="rp-graph-actions">
          {selectedSource && selectedSource.id !== 'main' && onToggleSource && editable && <button type="button" className="rt-btn" onClick={() => onToggleSource(selectedSource.id)}>
            {selectedSource.detail === 'Standards on' ? 'Disable Standards' : 'Enable Standards'}
          </button>}
          {selectedPermission?.restricted && editable && <button type="button" className="rt-btn" onClick={() => onRestorePermission(selectedPermission.id)}><RotateCcw size={15}/> Restore</button>}
          {editable && canRemove && <button type="button" className="rt-btn" onClick={removeSelected}><Trash2 size={15}/> Remove</button>}
          <button type="button" className="rt-btn rp-fit" onClick={() => void fitView({padding: 0.15, duration: 240})}>Fit</button>
        </div>
      </div>
      {departmentSelected && <section className="rp-ticket-department-detail" aria-label="View Department Tickets settings">
        <div><strong>View Department Tickets</strong><p>Select the departments whose support tickets this employee may access</p></div>
        <div className="rp-ticket-department-choices">
          {(['Restaurant','Front Desk'] as TicketDepartment[]).map(department => <label key={department}>
            <input type="checkbox" checked={department === primaryTicketDepartment || ticketDepartments.includes(department)}
              disabled={!canEditTicketDepartments || department === primaryTicketDepartment}
              onChange={event => onTicketDepartmentsChange?.([primaryTicketDepartment,
                ...(['Restaurant','Front Desk'] as TicketDepartment[]).filter(other => other !== primaryTicketDepartment &&
                  (other===department ? event.target.checked : ticketDepartments.includes(other)))])}/>
            <span>{department} Department</span>{department===primaryTicketDepartment&&<small>Primary</small>}
          </label>)}
        </div>
      </section>}
      <div className={`rp-flow ${graphReady?'is-ready':'is-initializing'}`} role="region" aria-label="Permission connection graph"
        aria-busy={!graphReady}
        onDragOver={event => {if (editable) event.preventDefault()}}
        onDrop={event => {
          event.preventDefault()
          const id = event.dataTransfer.getData('application/resortos-permission')
          if (isPermissionId(id)) addPending(id)
        }}>
        <ReactFlow<GraphNode, GraphEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeDragStop={(_, node) => setPositions(value => ({...value, [node.id]: node.position}))}
          onConnect={handleConnect} isValidConnection={isValidConnection}
          onNodeClick={(_, node) => {setSelectedNode(node.id); setSelectedEdge(null)}}
          onEdgeClick={(_, edge) => {setSelectedEdge(edge.id); setSelectedNode(null)}}
          onPaneClick={() => {setSelectedNode(null); setSelectedEdge(null)}}
          onBeforeDelete={async ({nodes:deletedNodes,edges:deletedEdges})=>{
            // React Flow must not mutate its controlled graph before confirmation.
            const node=deletedNodes.find(item=>item.id.startsWith('permission:'))
            const edge=deletedEdges.find(item=>item.target.startsWith('permission:'))
            requestRemoval(removableTarget(node?.id??null,edge?.id??null))
            return false
          }}
          nodesDraggable={editable} nodesConnectable={editable} edgesReconnectable={false}
          nodesFocusable elementsSelectable
          minZoom={.2} maxZoom={1.4} zoomOnDoubleClick={false} proOptions={{hideAttribution: true}}>
          <Background gap={24} size={1} color="#e8eee4" />
          <Controls showInteractive={false} />
        </ReactFlow>
        {!graphReady&&<span className="rp-graph-initializing" role="status">Preparing permission graph</span>}
      </div>
    </div>
    <aside className="rp-library" aria-label="Permission library">
      <div className="rp-library-heading"><h2>Permission Library</h2><span>{PERMISSION_CATALOG.length}</span></div>
      <label className="rp-library-search"><Search size={16}/><span className="rt-sr-only">Search permissions</span>
        <input type="search" placeholder="Search permissions" value={search} onChange={event => setSearch(event.target.value)}/>
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear permission search"><X size={14}/></button>}
      </label>
      <label className="rt-sr-only" htmlFor="rp-module">Permission module</label>
      <select id="rp-module" className="rt-select rp-module-select" value={category} onChange={event => setCategory(event.target.value)}>
        {['All', ...new Set(PERMISSION_CATALOG.map(p => p.module))].map(module => <option key={module}>{module}</option>)}
      </select>
      <div className="rp-library-items">
        {filtered.map(p => <div className="rp-library-item" key={p.id} draggable={editable && !allIds.has(p.id)}
          onDragStart={event => {event.dataTransfer.setData('application/resortos-permission', p.id); event.dataTransfer.effectAllowed = 'copy'}}>
          <div><strong>{p.label}</strong><span>{p.module}</span></div>
          <button type="button" className="rp-add-icon" disabled={!editable || allIds.has(p.id)}
            onClick={() => addPending(p.id)} aria-label={`Add ${p.label}`} title={allIds.has(p.id) ? 'Already on graph' : 'Add to graph'}>
            {allIds.has(p.id) ? <Check size={15}/> : <span aria-hidden="true">+</span>}
          </button>
        </div>)}
        {!filtered.length && <p className="rp-no-results">No permissions found</p>}
      </div>
    </aside>
    {removal&&<DialogFrame title={removal.kind==='permission'?'Remove permission?':'Remove subrole assignment?'}
      onClose={closeRemoval} returnFocusTo={removalTrigger.current} className="fd-charge-modal">
      <div className="fd-charge-form">
        <p className="rp-removal-explanation">{removal.kind==='subrole'?
          <>{rootName} will no longer have the assigned subrole <strong>{removal.label}</strong>. The subrole definition will not be deleted.</>:
          mode==='subrole'?
            <>The subrole <strong>{rootName}</strong> will no longer include <strong>{removal.label}</strong>.</>:
            <>{rootName} will lose access to <strong>{removal.label}</strong>{removal.inherited?', even if it is included in an assigned role or subrole':''}.</>}
        </p>
        <p className="rp-removal-hint">This change will take effect when you save.</p>
        <div className="rt-dialog-actions"><button ref={cancelButton} type="button" className="rt-btn" onClick={closeRemoval}>Cancel</button>
          <button type="button" className="rt-btn rt-btn-primary" onClick={confirmRemoval}>
            {removal.kind==='subrole'?'Remove assignment':'Remove permission'}</button></div>
      </div>
    </DialogFrame>}
  </div>
}

/** Shared graph engine for both employee grants and reusable subrole templates. */
export function AccessGraph(props: Props) {
  return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider>
}
