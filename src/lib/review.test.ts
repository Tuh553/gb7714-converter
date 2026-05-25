import { describe, expect, test } from 'vitest'
import { applyReviewFilter, sortReviewItems } from './review'
import type { ParsedItem } from './gb7714/types'

const items: ParsedItem[] = [
  {
    id: '1',
    raw: 'a',
    status: 'done',
    issues: [{ id: 'i1', severity: 'error', code: 'missing-journal', field: 'journal', message: '缺少刊名' }],
    editedFields: [],
  },
  {
    id: '2',
    raw: 'b',
    status: 'error',
    error: '解析失败',
    issues: [],
    editedFields: [],
  },
  {
    id: '3',
    raw: 'c',
    status: 'done',
    issues: [{ id: 'i2', severity: 'warning', code: 'invalid-doi', field: 'doi', message: 'DOI 格式异常' }],
    editedFields: ['doi'],
    lastEditedAt: 200,
  },
]

describe('applyReviewFilter', () => {
  test('returns failed items for failed filter', () => {
    expect(applyReviewFilter(items, 'failed').map((item) => item.id)).toEqual(['2'])
  })

  test('returns any problematic items for issue filter', () => {
    expect(applyReviewFilter(items, 'issue').map((item) => item.id)).toEqual(['1', '2', '3'])
  })

  test('returns edited items for edited filter', () => {
    expect(applyReviewFilter(items, 'edited').map((item) => item.id)).toEqual(['3'])
  })
})

describe('sortReviewItems', () => {
  test('sorts by issue count descending with stable fallback to original order', () => {
    expect(sortReviewItems(items, 'issue-count').map((item) => item.id)).toEqual(['1', '3', '2'])
  })
})
