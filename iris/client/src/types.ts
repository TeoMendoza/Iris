export type Page = 'inventory' | 'review' | 'analytics' | 'settings'
export type AnalyticsTab = 'overview' | 'performance' | 'categories' | 'employees'
export type TimeWindow = '1y' | '3mo' | '6mo' | 'all' | 'now'
export type CategoryTag = 'Clothing' | 'Footwear' | 'Electronics' | 'Furniture' | 'Food' | 'Books' | 'Tools' | 'Toys' | 'Misc'
export type StatusTag = 'Shelf' | 'Storage' | 'Sold'

export const CATEGORIES: CategoryTag[] = ['Clothing', 'Footwear', 'Electronics', 'Furniture', 'Food', 'Books', 'Tools', 'Toys', 'Misc']
export const STATUSES: StatusTag[] = ['Shelf', 'Storage', 'Sold']
export const TIME_WINDOWS: { key: TimeWindow; label: string }[] = [
  { key: '1y', label: '1 Year' },
  { key: '3mo', label: '3 Months' },
  { key: '6mo', label: '6 Months' },
  { key: 'all', label: 'All Time' },
]
export const CATEGORY_TIME_WINDOWS: { key: TimeWindow; label: string }[] = [
  { key: 'now', label: 'Now' },
  ...TIME_WINDOWS,
]

export const CATEGORY_COLORS: Record<string, string> = {
  Clothing: '#7c5ce7', Footwear: '#2d7d46', Electronics: '#0ea5e9',
  Furniture: '#d97706', Food: '#ef4444', Books: '#a855f7',
  Tools: '#10b981', Toys: '#f59e0b', Misc: '#94a3b8',
}

export const STATUS_COLORS: Record<StatusTag, string> = { Shelf: '#2d7d46', Storage: '#d97706', Sold: '#7c5ce7' }
