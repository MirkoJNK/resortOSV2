/** Rooms Manager: deliberately separate from the operational/payment demo store. */
import { recordCollection } from '../audit-log/storage'
export type Room = {
  id: string
  name: string
  code: string
  active: boolean
  createdAt: string
  updatedAt: string
}
export type RoomDirectory = { version: 1; rooms: Room[] }
export type ReadResult = { data: RoomDirectory; error: string | null; recoverable: boolean }
export type SaveResult = { ok: true } | { ok: false; error: string }
export const ROOMS_STORAGE_KEY = 'resortos:rooms-manager:v1'
export const ROOM_NAME_LIMIT = 60
export const ROOM_CODE_LIMIT = 20
export const clean = (s: string) => s.trim().replace(/\s+/g, ' ')
export const normalized = (s: string) => clean(s).normalize('NFKC').toLocaleLowerCase()
const seed: [string, string, boolean][] = [
  ['Room 101', '101', true], ['Room 102', '102', true], ['Room 110', '110', true],
  ['Room 205', '205', true], ['Room 206', '206', false], ['Villa A', 'VA', true],
  ['Villa B', 'VB', false], ['Beach Cottage 2', 'BC-02', true],
  ['Garden Suite', 'GS-01', true], ['Bungalow 4', 'BG-04', true]
]
const initialStamp = '2026-11-05T09:00:00.000Z'
export const sampleDirectory: RoomDirectory = {
  version: 1,
  rooms: seed.map(([name, code, active], i) => ({
    id: `sample-room-${String(i + 1).padStart(3, '0')}`,
    name, code, active, createdAt: initialStamp, updatedAt: initialStamp
  }))
}
export const copyRooms = (data: RoomDirectory): RoomDirectory => ({ version: 1, rooms: data.rooms.map(r => ({ ...r })) })
export function validateDirectory(input: unknown): input is RoomDirectory {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const data = input as Partial<RoomDirectory>
  if (data.version !== 1 || !Array.isArray(data.rooms) || data.rooms.length > 10000) return false
  const ids = new Set<string>(), names = new Set<string>(), codes = new Set<string>()
  for (const raw of data.rooms) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
    const r = raw as Room
    const keys = Object.keys(raw).sort()
    if (keys.join('|') !== 'active|code|createdAt|id|name|updatedAt') return false
    if (typeof r.id !== 'string' || !r.id || r.id.length > 128 || ids.has(r.id)) return false
    if (typeof r.name !== 'string' || !clean(r.name) || clean(r.name) !== r.name || r.name.length > ROOM_NAME_LIMIT) return false
    if (typeof r.code !== 'string' || clean(r.code) !== r.code || r.code.length > ROOM_CODE_LIMIT) return false
    if (typeof r.active !== 'boolean') return false
    if (typeof r.createdAt !== 'string' || typeof r.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(r.createdAt)) || !Number.isFinite(Date.parse(r.updatedAt))) return false
    const n = normalized(r.name), c = normalized(r.code)
    if (names.has(n) || (c && codes.has(c))) return false
    ids.add(r.id); names.add(n); if (c) codes.add(c)
  }
  return true
}
export function validateRoomFields(
  input: { name: string; code: string },
  rooms: Room[], currentId: string | null = null
): { name?: string; code?: string } {
  const name = clean(input.name), code = clean(input.code)
  const errors: { name?: string; code?: string } = {}
  if (!name) errors.name = 'Enter a room name'
  else if (name.length > ROOM_NAME_LIMIT) errors.name = `Use ${ROOM_NAME_LIMIT} characters or fewer`
  else if (rooms.some(r => r.id !== currentId && normalized(r.name) === normalized(name))) errors.name = 'A room with this name already exists'
  if (code.length > ROOM_CODE_LIMIT) errors.code = `Use ${ROOM_CODE_LIMIT} characters or fewer`
  else if (code && rooms.some(r => r.id !== currentId && normalized(r.code) === normalized(code))) errors.code = 'This room code is already in use'
  return errors
}
export function createRoom(input: { name: string; code: string }, rooms: Room[], now = new Date().toISOString(), id = crypto.randomUUID()): Room {
  const errors = validateRoomFields(input, rooms)
  if (Object.keys(errors).length) throw Error(Object.values(errors)[0])
  return { id, name: clean(input.name), code: clean(input.code), active: true, createdAt: now, updatedAt: now }
}
export const roomComparator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
export function selectRooms(rooms: Room[], query: string, status: 'all' | 'active' | 'inactive', sort: 'natural' | 'reverse' | 'latest'): Room[] {
  const q = normalized(query)
  return rooms.filter(r =>
    (!q || normalized(r.name).includes(q) || normalized(r.code).includes(q)) &&
    (status === 'all' || (r.active ? 'active' : 'inactive') === status)
  ).sort((a, b) => sort === 'latest'
    ? b.updatedAt.localeCompare(a.updatedAt) || roomComparator.compare(a.name, b.name)
    : sort === 'reverse' ? roomComparator.compare(b.name, a.name) : roomComparator.compare(a.name, b.name))
}
export function readRooms(): ReadResult {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY)
    if (raw === null) return { data: copyRooms(sampleDirectory), error: null, recoverable: true }
    const parsed: unknown = JSON.parse(raw)
    if (!validateDirectory(parsed)) return { data: { version: 1, rooms: [] }, error: 'Saved room data is invalid. It has not been overwritten.', recoverable: false }
    return { data: copyRooms(parsed), error: null, recoverable: true }
  } catch {
    return { data: { version: 1, rooms: [] }, error: 'Room storage is unavailable or corrupted. Existing data has not been changed.', recoverable: false }
  }
}
export function writeRooms(data: RoomDirectory): SaveResult {
  if (!validateDirectory(data)) return { ok: false, error: 'Invalid room information cannot be saved.' }
  const previous=readRooms()
  try {
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(data))
    if(!previous.error)recordCollection({category:'Settings',kind:'room',name:'Room',operationId:`rooms:${crypto.randomUUID()}`,
      before:previous.data.rooms.map(r=>({id:r.id,label:r.name,active:r.active,state:r.code})),
      after:data.rooms.map(r=>({id:r.id,label:r.name,active:r.active,state:r.code}))})
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not save rooms in this browser. Please retry; your changes remain in the form.' }
  }
}
