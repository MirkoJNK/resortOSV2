import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'
import { Ban, Check, CheckCircle2, ChevronDown, DoorOpen, Pencil, Plus, Search, X } from 'lucide-react'
import {
  clean, copyRooms, createRoom, readRooms, selectRooms,
  validateRoomFields, writeRooms
} from './model'
import type { Room, RoomDirectory } from './model'

type Status = 'all' | 'active' | 'inactive'
type Sort = 'natural' | 'reverse' | 'latest'
type Editor = { id: string | null; name: string; code: string }
type Errors = { name?: string; code?: string }

function RoomForm({ editor, errors, setEditor, onCancel, onSave, room, onToggle }: {
  editor: Editor
  errors: Errors
  setEditor: (next: Editor) => void
  onCancel: () => void
  onSave: () => void
  room?: Room
  onToggle?: (room: Room) => void
}) {
  return <form className="rm-edit-form" noValidate onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onSave() }}>
    <div className="rm-form-fields">
      <div className="rm-field">
        <label htmlFor="rm-name">Room name <span aria-hidden="true">*</span></label>
        <input id="rm-name" autoComplete="off" value={editor.name} maxLength={60} aria-required="true"
          aria-invalid={!!errors.name} aria-describedby={errors.name ? 'rm-name-error' : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEditor({ ...editor, name: e.target.value })} />
        <span className="rm-field-error" id="rm-name-error" role={errors.name ? 'alert' : undefined}>{errors.name || ''}</span>
      </div>
      <div className="rm-field">
        <label htmlFor="rm-code">Room code <span className="rm-muted">(optional)</span></label>
        <input id="rm-code" autoComplete="off" value={editor.code} maxLength={20}
          aria-invalid={!!errors.code} aria-describedby={errors.code ? 'rm-code-error' : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEditor({ ...editor, code: e.target.value })} />
        <span className="rm-field-error" id="rm-code-error" role={errors.code ? 'alert' : undefined}>{errors.code || ''}</span>
      </div>
    </div>
    <div className="rm-form-actions">
      <button type="button" className="rm-btn" onClick={onCancel}>Cancel</button>
      <button type="submit" className="rm-btn rm-btn-primary"><Check size={15} aria-hidden="true" />{room ? 'Save changes' : 'Add Room'}</button>
    </div>
    {room && onToggle && <div className="rm-form-divide">
      <span className="rm-muted">{room.active ? 'Active room' : 'Inactive room'}</span>
      <button className={`rm-btn rm-btn-small ${room.active ? 'rm-btn-danger' : ''}`} type="button" onClick={() => onToggle(room)}>
        {room.active ? 'Deactivate' : 'Reactivate'}
      </button>
    </div>}
  </form>
}

function StatusDialog({ room, onCancel, onConfirm }: {
  room: Room; onCancel: () => void; onConfirm: () => void
}) {
  const initialRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const lastFocus = document.activeElement as HTMLElement | null
    initialRef.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      if (e.key === 'Tab') {
        const targets = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])]
        if (!targets.length) return
        const first = targets[0], last = targets[targets.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); lastFocus?.focus() }
  }, [onCancel])
  return <div className="rm-modal-shade">
    <div ref={dialogRef} className="rm-modal rm-confirm" role="alertdialog" aria-modal="true"
      aria-labelledby="rm-dialog-title" aria-describedby="rm-dialog-desc">
      <div className="rm-modal-head">
        <h2 id="rm-dialog-title">{room.active ? 'Deactivate' : 'Reactivate'} “{room.name}”?</h2>
        <button type="button" className="rm-btn rm-btn-small rm-btn-icon" onClick={onCancel} aria-label="Close dialog"><X size={17}/></button>
      </div>
      <p className="rm-confirm-body" id="rm-dialog-desc">
        {room.active
          ? 'This room will remain in your directory but will not be eligible for new room postings.'
          : 'This room will become available for future operational selection.'}
      </p>
      <div className="rm-form-actions">
        <button type="button" ref={initialRef} className="rm-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className={`rm-btn ${room.active ? 'rm-btn-danger' : 'rm-btn-primary'}`} onClick={onConfirm}>
          {room.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </div>
  </div>
}

export function RoomsManager({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [initial] = useState(readRooms)
  const [directory, setDirectory] = useState<RoomDirectory>(initial.data)
  const [storageError, setStorageError] = useState<string | null>(initial.error)
  const [canWrite] = useState(initial.recoverable)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [sort, setSort] = useState<Sort>('natural')
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [editor, setEditor] = useState<Editor | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [confirmRoomId, setConfirmRoomId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const lastEditedRef = useRef<HTMLButtonElement | null>(null)
  const rooms = directory.rooms
  const activeEditorRoom = editor?.id ? rooms.find(r => r.id === editor.id) : undefined
  const dirty = !!editor && (editor.id === null ? !!(editor.name || editor.code) : !activeEditorRoom || clean(editor.name) !== activeEditorRoom.name || clean(editor.code) !== activeEditorRoom.code)
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  useEffect(() => { if (editor) document.getElementById('rm-name')?.focus() }, [editor?.id, editor === null])
  const visible = useMemo(() => selectRooms(rooms, query, status, sort), [rooms, query, status, sort])
  const byGroup = (active: boolean) => visible.filter(r => r.active === active)
  const dismissEditor = () => { setEditor(null); setErrors({}); lastEditedRef.current?.focus() }
  const openEditor = (room?: Room, trigger?: HTMLButtonElement) => {
    if (dirty && !window.confirm('Discard unsaved room changes?')) return
    lastEditedRef.current = trigger || null
    setErrors({}); setNotice('')
    setEditor(room ? { id: room.id, name: room.name, code: room.code } : { id: null, name: '', code: '' })
    if (room) setCollapsed(values => values.filter(v => v !== (room.active ? 'active' : 'inactive')))
  }
  const persist = (next: RoomDirectory, success: string) => {
    if (!canWrite) { setStorageError('Saved data must be repaired before making changes. Existing storage has not been overwritten.'); return false }
    const result = writeRooms(next)
    if (!result.ok) { setStorageError(result.error); return false }
    setDirectory(copyRooms(next)); setStorageError(null); setNotice(success); window.dispatchEvent(new Event('resortos-feedback-saved')); return true
  }
  const saveEditor = () => {
    if (!editor) return
    const errs = validateRoomFields(editor, rooms, editor.id)
    setErrors(errs)
    if (Object.keys(errs).length) { document.getElementById(errs.name ? 'rm-name' : 'rm-code')?.focus(); return }
    const next = copyRooms(directory)
    if (editor.id) {
      const index = next.rooms.findIndex(r => r.id === editor.id)
      if (index === -1) return
      const room = next.rooms[index]
      const name = clean(editor.name), code = clean(editor.code)
      if (room.name === name && room.code === code) { dismissEditor(); return }
      next.rooms[index] = { ...room, name, code, updatedAt: new Date().toISOString() }
    } else {
      next.rooms.push(createRoom(editor, rooms))
    }
    if (persist(next, editor.id ? 'Room updated' : 'Room added')) dismissEditor()
  }
  const confirmRoom = rooms.find(r => r.id === confirmRoomId)
  const commitStatus = () => {
    if (!confirmRoom) return
    const next = copyRooms(directory)
    const room = next.rooms.find(r => r.id === confirmRoom.id)
    if (!room) return
    room.active = !room.active
    room.updatedAt = new Date().toISOString()
    if (persist(next, room.active ? 'Room reactivated' : 'Room deactivated')) {
      setConfirmRoomId(null); setEditor(null); setErrors({})
    }
  }
  const changeEditor = (next: Editor) => { setEditor(next); setErrors({}) }
  const roomCard = (room: Room) => <article className={`rm-b-card ${room.active ? '' : 'inactive'}`} key={room.id} data-room-id={room.id}>
    <div className="rm-b-card-top">
      <span className={`rm-decor ${room.active ? '' : 'inactive'}`} aria-hidden="true"><DoorOpen size={18}/></span>
      <div className="rm-b-card-copy">
        <h3 className="rm-card-name">{room.name}</h3>
        <span className="rm-card-code">{room.code ? `Code ${room.code}` : 'No room code'}</span>
      </div>
      <button type="button" className="rm-btn rm-btn-small" onClick={(e: MouseEvent<HTMLButtonElement>) => openEditor(room, e.currentTarget)}><Pencil size={13} aria-hidden="true"/> Edit</button>
    </div>
    {editor?.id === room.id && <div className="rm-b-inline">
      <RoomForm editor={editor} setEditor={changeEditor} errors={errors} onCancel={dismissEditor}
        onSave={saveEditor} room={room} onToggle={r => {
          if (dirty && !window.confirm('Changing status will discard unsaved room field edits. Continue?')) return
          setConfirmRoomId(r.id)
        }} />
    </div>}
  </article>
  const showEmpty = !visible.length && !editor
  return <section className="rm-page" aria-labelledby="rm-page-heading">
    <div className="section-header rm-heading">
      <div><h1 id="rm-page-heading">Rooms Manager</h1></div>
    </div>
    <div className="rm-toolbar">
      <div className="rm-toolbar-main">
        <label className="rm-search"><Search size={18} aria-hidden="true"/>
          <input type="search" aria-label="Search rooms by name or code" placeholder="Search rooms or codes"
            value={query} onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} autoComplete="off" />
          {query && <button type="button" className="rm-search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16}/></button>}
        </label>
      </div>
      <div className="rm-toolbar-right">
        <div className="rm-b-tabs" role="group" aria-label="Room status groups">
          {([['all','All rooms'],['active','Active'],['inactive','Inactive']] as const).map(([value,label]) =>
            <button type="button" className={`rm-b-tab ${status === value ? 'active' : ''}`} aria-pressed={status === value}
              key={value} onClick={() => setStatus(value)}>{label}</button>)}
        </div>
        <select className="rm-select" aria-label="Sort rooms" value={sort} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSort(e.target.value as Sort)}>
          <option value="natural">Name A–Z</option><option value="reverse">Name Z–A</option><option value="latest">Recently updated</option>
        </select>
        <button type="button" className="rm-btn rm-btn-primary" onClick={(e: MouseEvent<HTMLButtonElement>) => openEditor(undefined, e.currentTarget)}><Plus size={17} aria-hidden="true"/> Add Room</button>
      </div>
    </div>
    <div className="rm-results-stage">
      {storageError && <div className="rm-storage-error" role="alert">{storageError}</div>}
      {editor?.id === null && <div className="rm-b-create">
        <div className="rm-inline-head"><h2>Add Room</h2>
          <button type="button" className="rm-btn rm-btn-small rm-btn-icon" aria-label="Close add room" onClick={dismissEditor}><X size={16}/></button>
        </div>
        <RoomForm editor={editor} errors={errors} setEditor={changeEditor} onCancel={dismissEditor} onSave={saveEditor}/>
      </div>}
      {showEmpty && <div className="rm-empty" data-empty={query || status !== 'all' ? 'search' : 'directory'}>
        <span className="rm-empty-icon"><DoorOpen size={25}/></span>
        <h2>{query || status !== 'all' ? 'No matching rooms' : 'No rooms configured'}</h2>
        <p>{query || status !== 'all' ? 'Try another name or room code' : 'Create your first room to start the directory'}</p>
        {query || status !== 'all'
          ? <button type="button" className="rm-btn" onClick={() => { setQuery(''); setStatus('all') }}>Clear filters</button>
          : <button type="button" className="rm-btn rm-btn-primary" onClick={(e: MouseEvent<HTMLButtonElement>) => openEditor(undefined, e.currentTarget)}><Plus size={17}/> Add Room</button>}
      </div>}
      {([['active','Active Rooms','Available for operational use',true],['inactive','Inactive Rooms','Retained in the room directory',false]] as const).map(([key,title,subtitle,active]) => {
        const groupRooms = byGroup(active)
        if (!groupRooms.length) return null
        const isCollapsed = collapsed.includes(key)
        return <section key={key} data-room-group={key} className={`rm-b-section ${active ? '' : 'inactive-group'}`}>
          <div className="rm-b-section-head">
            <span className={`rm-b-icon ${active ? '' : 'inactive'}`} aria-hidden="true">{active ? <CheckCircle2 size={18}/> : <Ban size={18}/>}</span>
            <div className="rm-group-heading"><h2>{title}</h2><p>{subtitle}</p></div>
            <button type="button" className="rm-btn rm-btn-small rm-btn-icon" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
              aria-expanded={!isCollapsed} onClick={() => setCollapsed(old => isCollapsed ? old.filter(x => x !== key) : [...old,key])}>
              <ChevronDown size={16} className={isCollapsed ? 'rm-chevron-closed' : ''}/>
            </button>
          </div>
          {!isCollapsed && <div className="rm-b-grid">{groupRooms.map(roomCard)}</div>}
        </section>
      })}
    </div>
    <span className="rm-sr-only" role="status" aria-live="polite">{visible.length} {visible.length === 1 ? 'room' : 'rooms'} displayed. {notice}</span>
    {notice && <div className="rm-feedback" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={13}/></button></div>}
    {confirmRoom && <StatusDialog room={confirmRoom} onCancel={() => setConfirmRoomId(null)} onConfirm={commitStatus} />}
  </section>
}
