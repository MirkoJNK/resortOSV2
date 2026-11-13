import { readRooms, ROOMS_STORAGE_KEY } from '../rooms-manager/model'

/** Configuration only: never infer occupancy or checkout from enabled room records.
 * The Rooms Manager ships sample fallback data. Only valid explicitly saved records
 * may contribute to Front Desk's "Active rooms" metric.
 */
export function readActiveConfiguredRooms(): number | null {
  try {
    if (localStorage.getItem(ROOMS_STORAGE_KEY) === null) return null
    const result = readRooms()
    if (result.error || !result.recoverable) return null
    return result.data.rooms.filter(room => room.active).length
  } catch {
    return null
  }
}
