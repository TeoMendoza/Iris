import { Timestamp } from 'spacetimedb'

export function bytesToUrl(bytes: Uint8Array): string | null {
  if (!bytes?.length) return null
  let mime = 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = 'image/png'
  else if (bytes[0] === 0x47 && bytes[1] === 0x49) mime = 'image/gif'
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime })
  return URL.createObjectURL(blob)
}

export function tsToMs(ts: unknown): number {
  if (ts instanceof Timestamp) return Number(ts.toMillis())
  if (typeof ts === 'bigint') return Number(ts / 1000n)
  return Number(ts)
}

export function formatDate(ts: unknown): string {
  return new Date(tsToMs(ts)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatCurrency(value: number): string {
  return `$${Math.round(value)}`
}

export function avgItemValue(cat: { totalValue: number; shelfCount: number; storageCount: number; soldCount: number }): number {
  const total = cat.shelfCount + cat.storageCount + cat.soldCount
  return total > 0 ? cat.totalValue / total : 0
}
