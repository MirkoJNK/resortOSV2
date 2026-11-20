/** Permission cards can wrap; a fixed row index is not a safe vertical coordinate. */
export const PERMISSION_COLUMN_GAP = 26
export const PERMISSION_COLUMN_START = 22

export type PermissionGeometry = {
  id: string
  position: {x:number;y:number}
  data: {title:string;detail:string}
  measured?: {height?:number}
}

/** Conservative pre-measurement height for the established 175px card and 145px text area. */
export function estimatedPermissionHeight(title:string,detail:string):number {
  const titleLines=Math.max(1,Math.ceil(title.trim().length/17))
  const detailLines=Math.max(1,Math.ceil(detail.trim().length/22))
  return Math.max(96,30+titleLines*17+detailLines*14+7)
}

export function permissionBottom(node:PermissionGeometry):number {
  const measured=node.measured?.height
  const height=typeof measured==='number'&&Number.isFinite(measured)&&measured>0 ?
    Math.max(measured,estimatedPermissionHeight(node.data.title,node.data.detail)) :
    estimatedPermissionHeight(node.data.title,node.data.detail)
  return node.position.y+height
}

/** New assignments always append after the lowest actual or conservatively estimated card. */
export function nextPermissionPosition(nodes:readonly PermissionGeometry[],x:number):{x:number;y:number} {
  const lastBottom=nodes.filter(node=>node.id.startsWith('permission:'))
    .reduce((bottom,node)=>Math.max(bottom,permissionBottom(node)),PERMISSION_COLUMN_START-PERMISSION_COLUMN_GAP)
  return {x,y:Math.max(PERMISSION_COLUMN_START,lastBottom+PERMISSION_COLUMN_GAP)}
}
