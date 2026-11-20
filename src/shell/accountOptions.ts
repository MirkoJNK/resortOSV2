import type { Employee } from '../features/employees/model'
import { SUPER_ADMIN_ID, displayEmployeeName } from '../features/employees/model'

/** Account choices mirror the validated employee directory, never a seed list. */
export function activeAccountOptions(employees: readonly Employee[]): Employee[] {
  return employees.filter(employee => employee.active).sort((a, b) => {
    if (a.id === b.id) return 0
    if (a.id === SUPER_ADMIN_ID) return -1
    if (b.id === SUPER_ADMIN_ID) return 1
    return displayEmployeeName(a).localeCompare(displayEmployeeName(b), 'en', { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id, 'en')
  })
}
