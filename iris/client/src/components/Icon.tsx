import type { Page, CategoryTag } from '../types'

export function Icon({ d, size = 18 }: { d: string | string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

export const ICONS: Record<Page, string[]> = {
  inventory: ['M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'],
  review:    ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 'm9 12 2 2 4-4'],
  analytics: ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
  settings:  ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'],
}

export const PAGE_LABELS: Record<Page, string> = {
  inventory: 'Inventory', review: 'Review Queue', analytics: 'Analytics', settings: 'Settings',
}

export const CAMERA_ICON = ['M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z', 'M12 17a4 4 0 100-8 4 4 0 000 8z']

const CATEGORY_ICON_PATHS: Record<CategoryTag, string[]> = {
  Clothing:    ['M9 4L4 7L4 10L7 9L7 20L17 20L17 9L20 10L20 7L15 4Q12 7 9 4Z'],
  Footwear:    ['M3 18L3 15Q3 12 6 11L11 10Q16 10 18 12Q21 13 21 15L21 18Z', 'M3 19L21 19', 'M9 10.5L11 13', 'M13 10L15 12.5'],
  Electronics: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  Furniture:   ['M4 16v-6a2 2 0 012-2h12a2 2 0 012 2v6', 'M4 16v3', 'M20 16v3', 'M4 16h16'],
  Food:        ['M12 8c-3 0-5 2.5-5 6a6 6 0 0012 0c0-3.5-2-6-5-6z', 'M12 8V5', 'M12 5c0-1 1-2 2-2'],
  Books:       ['M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2z', 'M12 3h6a2 2 0 012 2v12a2 2 0 01-2 2h-6'],
  Tools:       ['M14.7 6.3a4 4 0 10-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4z'],
  Toys:        ['M5 5h14v14H5z', 'M12 8.2L13 11.1L16.1 11.2L13.6 13L14.5 16L12 14.2L9.5 16L10.4 13L7.9 11.2L11 11.1Z'],
  Misc:        ['M3 7l9-4 9 4-9 4-9-4z', 'M3 7v10l9 4 9-4V7', 'M12 11v10'],
}

export function CategoryIcon({ tag, size = 32 }: { tag: CategoryTag; size?: number }) {
  return <Icon d={CATEGORY_ICON_PATHS[tag]} size={size} />
}
