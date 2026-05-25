import type { ParsedItem, ReviewFilter, ReviewSortMode } from './gb7714/types'

function hasIssues(item: ParsedItem): boolean {
  return (item.issues?.length ?? 0) > 0
}

function hasMissingIssues(item: ParsedItem): boolean {
  return item.issues?.some((issue) => issue.code.startsWith('missing-')) ?? false
}

function hasWarnings(item: ParsedItem): boolean {
  return item.issues?.some((issue) => issue.severity === 'warning' || issue.severity === 'hint') ?? false
}

function issueCount(item: ParsedItem): number {
  return item.issues?.length ?? 0
}

export function applyReviewFilter(items: ParsedItem[], filter: ReviewFilter): ParsedItem[] {
  switch (filter) {
    case 'failed':
      return items.filter((item) => item.status === 'error')
    case 'issue':
      return items.filter((item) => item.status === 'error' || hasIssues(item))
    case 'error':
      return items.filter(
        (item) => item.status === 'error' || item.issues?.some((issue) => issue.severity === 'error'),
      )
    case 'warning':
      return items.filter((item) => hasWarnings(item))
    case 'missing':
      return items.filter((item) => hasMissingIssues(item))
    case 'edited':
      return items.filter((item) => (item.editedFields?.length ?? 0) > 0)
    case 'all':
    default:
      return items
  }
}

export function sortReviewItems(items: ParsedItem[], mode: ReviewSortMode): ParsedItem[] {
  const indexed = items.map((item, index) => ({ item, index }))
  indexed.sort((a, b) => {
    if (mode === 'issue-count') {
      const diff = issueCount(b.item) - issueCount(a.item)
      return diff !== 0 ? diff : a.index - b.index
    }
    if (mode === 'recently-edited') {
      const diff = (b.item.lastEditedAt ?? 0) - (a.item.lastEditedAt ?? 0)
      return diff !== 0 ? diff : a.index - b.index
    }
    return a.index - b.index
  })
  return indexed.map(({ item }) => item)
}
