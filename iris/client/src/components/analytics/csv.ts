import type { Identity } from 'spacetimedb'
import type { CategoryTag, TimeWindow } from '../../types'
import { tsToMs, avgItemValue } from '../../helpers'

export type UserInfo = { name: string; email: string }
export type UserMap = Map<string, UserInfo>

const WINDOW_DAYS: Record<TimeWindow, number | null> = { '1y': 365, '3mo': 90, '6mo': 182, all: null, now: null }

function windowCutoffMs(window: TimeWindow): number | null {
  const days = WINDOW_DAYS[window]
  return days === null ? null : Date.now() - days * 24 * 60 * 60 * 1000
}

function csvDate(ts: unknown): string {
  return new Date(tsToMs(ts)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')
}

function userInfo(userMap: UserMap, identity: Identity): UserInfo {
  return userMap.get(identity.toHexString()) ?? { name: '', email: '' }
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildGeneralCsv(ov: any): string {
  const totalItems = ov.shelfCount + ov.storageCount + ov.soldCount
  return [
    `Iris General Report — ${new Date().toLocaleDateString()}`,
    '',
    'Right Now',
    'Metric,Value',
    `Total Items,${totalItems}`,
    `Active Value,${ov.shelfValue + ov.storageValue}`,
    `All-Time Revenue,${ov.soldValue}`,
    `Pending Review,${ov.pendingReview}`,
    `Active Categories,${ov.activeCategories}`,
    `Employees,${ov.totalEmployees}`,
  ].join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPerformanceCsv(modelPerf: any, window: TimeWindow): string {
  return [
    `Iris Model Performance Report — ${new Date().toLocaleDateString()} — Period: ${window}`,
    '',
    'Metric,Value',
    `Total Processed,${modelPerf.totalProcessed}`,
    `Rejection Rate %,${modelPerf.rejectionRatePct.toFixed(2)}`,
    `Category Accuracy %,${modelPerf.categoryAccuracyPct.toFixed(2)}`,
    `Avg Count Error %,${modelPerf.avgCountDeltaPct.toFixed(2)}`,
    `Avg Value Error %,${modelPerf.avgValueDeltaPct.toFixed(2)}`,
    `Missed Count,${modelPerf.missedCount}`,
    `Missed Rate %,${modelPerf.missedRatePct.toFixed(2)}`,
  ].join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEmployeesCsv(employees: any[], window: TimeWindow, userMap: UserMap): string {
  const lines = [
    `Iris Employee Activity Report — ${new Date().toLocaleDateString()} — Period: ${window}`,
    '',
    'Name,Email,Items Approved,Scans Submitted,Moves Performed,Missed Items Reported',
  ]
  for (const e of employees) {
    const { email } = userInfo(userMap, e.identity)
    lines.push(`${e.name},${email},${e.itemsApproved},${e.scansSubmitted},${e.movesPerformed},${e.missedItemsReported}`)
  }
  return lines.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCategorySummaryCsv(cats: any[], catPeriod: any, window: TimeWindow): string {
  const isNow = window === 'now'
  const lines = [
    `Iris Category Summary — ${new Date().toLocaleDateString()} — Period: ${window}`,
    '',
    isNow
      ? 'Category,On Shelf,In Storage,Sold,Avg Value,Active Value,Revenue,Sell-through %'
      : 'Category,Items Added,Items Added Value,Items Sold,Items Sold Value',
  ]
  for (const c of cats) {
    const tag = c.category.tag
    if (isNow) {
      const total = c.shelfCount + c.storageCount + c.soldCount
      const avg = avgItemValue(c)
      const activeValue = avg * (c.shelfCount + c.storageCount)
      const soldValue = avg * c.soldCount
      const sellThrough = total > 0 ? (c.soldCount / total * 100) : 0
      lines.push(`${tag},${c.shelfCount},${c.storageCount},${c.soldCount},${Math.round(avg)},${Math.round(activeValue)},${Math.round(soldValue)},${sellThrough.toFixed(1)}`)
    } else {
      const period = catPeriod?.[tag.toLowerCase()]
      lines.push(`${tag},${period?.itemsAdded ?? 0},${period?.itemsAddedValue ?? 0},${period?.itemsSold ?? 0},${period?.itemsSoldValue ?? 0}`)
    }
  }
  return lines.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCategoryAddsCsv(entries: any[], tag: CategoryTag, window: TimeWindow, userMap: UserMap): string {
  const cutoff = windowCutoffMs(window)
  const filtered = entries.filter(e => e.category.tag === tag && (cutoff === null || tsToMs(e.scannedAt) >= cutoff))
  const lines = [
    `Iris Category Adds Log — ${tag} — ${new Date().toLocaleDateString()} — Period: ${window}`,
    '',
    'Date,Items Added,Value,Name,Email',
  ]
  for (const e of filtered) {
    const { name, email } = userInfo(userMap, e.confirmedBy)
    lines.push(`${csvDate(e.scannedAt)},${e.itemsAdded},${e.valueAtScan},${name},${email}`)
  }
  return lines.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCategoryMovesCsv(movements: any[], tag: CategoryTag, window: TimeWindow, userMap: UserMap): string {
  const cutoff = windowCutoffMs(window)
  const filtered = movements.filter(m => (m.fromCategory.tag === tag || m.toCategory.tag === tag) && (cutoff === null || tsToMs(m.movedAt) >= cutoff))
  const lines = [
    `Iris Category Moves Log — ${tag} — ${new Date().toLocaleDateString()} — Period: ${window}`,
    '',
    'Date,From Category,From Status,To Category,To Status,Count,Name,Email',
  ]
  for (const m of filtered) {
    const { name, email } = userInfo(userMap, m.movedBy)
    lines.push(`${csvDate(m.movedAt)},${m.fromCategory.tag},${m.fromStatus.tag},${m.toCategory.tag},${m.toStatus.tag},${m.count},${name},${email}`)
  }
  return lines.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEmployeeApprovalsCsv(entries: any[], identity: Identity, window: TimeWindow, userMap: UserMap): string {
  const cutoff = windowCutoffMs(window)
  const filtered = entries.filter(e => e.confirmedBy.isEqual(identity) && (cutoff === null || tsToMs(e.scannedAt) >= cutoff))
  const { name, email } = userInfo(userMap, identity)
  const lines = [
    `Iris Employee Approvals Log — ${name} — ${new Date().toLocaleDateString()} — Period: ${window}`,
    '',
    'Date,Category,Items Added,Value,Name,Email',
  ]
  for (const e of filtered) {
    lines.push(`${csvDate(e.scannedAt)},${e.category.tag},${e.itemsAdded},${e.valueAtScan},${name},${email}`)
  }
  return lines.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEmployeeMovesCsv(movements: any[], identity: Identity, window: TimeWindow, userMap: UserMap): string {
  const cutoff = windowCutoffMs(window)
  const filtered = movements.filter(m => m.movedBy.isEqual(identity) && (cutoff === null || tsToMs(m.movedAt) >= cutoff))
  const { name, email } = userInfo(userMap, identity)
  const lines = [
    `Iris Employee Moves Log — ${name} — ${new Date().toLocaleDateString()} — Period: ${window}`,
    '',
    'Date,From Category,From Status,To Category,To Status,Count,Name,Email',
  ]
  for (const m of filtered) {
    lines.push(`${csvDate(m.movedAt)},${m.fromCategory.tag},${m.fromStatus.tag},${m.toCategory.tag},${m.toStatus.tag},${m.count},${name},${email}`)
  }
  return lines.join('\n')
}

export { downloadCsv }
