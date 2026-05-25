import { describe, expect, test } from 'vitest'
import { validateReference } from './validation'
import type { Reference } from './gb7714/types'

describe('validateReference', () => {
  test('reports missing required journal fields for journal references', () => {
    const ref: Reference = {
      type: 'J',
      language: 'zh',
      authors: [{ family: '袁', given: '训来' }],
      title: '蓝田生物群',
    }

    const issues = validateReference(ref)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'journal', severity: 'error', code: 'missing-journal' }),
        expect.objectContaining({ field: 'year', severity: 'error', code: 'missing-year' }),
      ]),
    )
  })

  test('flags malformed year, pages, and doi', () => {
    const ref: Reference = {
      type: 'J',
      language: 'en',
      authors: [{ family: 'Smith', given: 'John', isWestern: true }],
      title: 'Example title',
      journal: 'Nature',
      year: '20A4',
      pages: '1—9',
      doi: 'doi:bad',
    }

    const issues = validateReference(ref)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'year', code: 'invalid-year' }),
        expect.objectContaining({ field: 'pages', code: 'invalid-pages' }),
        expect.objectContaining({ field: 'doi', code: 'invalid-doi' }),
      ]),
    )
  })

  test('requires online metadata for online references', () => {
    const ref: Reference = {
      type: 'J/OL',
      language: 'zh',
      authors: [{ family: '中国科学院' }],
      title: '在线论文',
      journal: '科学通报',
      year: '2024',
    }

    const issues = validateReference(ref)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'url', code: 'missing-url' }),
        expect.objectContaining({ field: 'accessDate', code: 'missing-access-date' }),
      ]),
    )
  })
})
