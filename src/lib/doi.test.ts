import { afterEach, describe, expect, test, vi } from 'vitest'
import { clearDoiCache, enrichByDoi, extractIdentifiers, mergeReference } from './doi'
import type { Reference } from './gb7714/types'

describe('extractIdentifiers', () => {
  test('extracts DOI from free text and strips trailing punctuation', () => {
    const identifiers = extractIdentifiers(
      'Smith J. Example article. DOI: 10.1000/xyz-123.',
    )

    expect(identifiers).toEqual({ doi: '10.1000/xyz-123' })
  })
})

describe('enrichByDoi', () => {
  afterEach(() => {
    clearDoiCache()
    vi.restoreAllMocks()
  })

  test('reuses cached Crossref metadata for duplicate DOI lookups', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          DOI: '10.1000/xyz-123',
          type: 'journal-article',
          title: ['Correct title'],
          'container-title': ['Correct Journal'],
          issued: { 'date-parts': [[2024]] },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await enrichByDoi('10.1000/xyz-123')
    await enrichByDoi(' 10.1000/XYZ-123 ')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('maps proceedings metadata to book and publisher fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          DOI: '10.1000/proc-1',
          type: 'proceedings-article',
          title: ['Example paper'],
          'container-title': ['Proceedings of CVPR 2020'],
          publisher: 'IEEE',
          'publisher-location': 'Piscataway',
          editor: [{ family: 'Smith', given: 'John K' }],
          issued: { 'date-parts': [[2020]] },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const ref = await enrichByDoi('10.1000/proc-1')

    expect(ref.type).toBe('C')
    expect(ref.journal).toBeUndefined()
    expect(ref.bookTitle).toBe('Proceedings of CVPR 2020')
    expect(ref.publisher).toBe('IEEE')
    expect(ref.publisherPlace).toBe('Piscataway')
    expect(ref.bookEditors).toBe('SMITH J K')
  })
})

describe('mergeReference', () => {
  test('prefers DOI metadata for bibliographic core fields and records source', () => {
    const llmRef: Reference = {
      type: 'J',
      language: 'en',
      authors: [{ family: 'Wrong', given: 'Author', isWestern: true }],
      title: 'Wrong title',
      journal: 'Wrong Journal',
      year: '2023',
      doi: '10.1000/xyz-123',
    }

    const doiRef: Partial<Reference> = {
      title: 'Correct title',
      journal: 'Correct Journal',
      year: '2024',
      doi: '10.1000/xyz-123',
    }

    const merged = mergeReference(llmRef, doiRef)

    expect(merged.ref.title).toBe('Correct title')
    expect(merged.ref.journal).toBe('Correct Journal')
    expect(merged.sources.title).toBe('doi')
    expect(merged.sources.journal).toBe('doi')
    expect(merged.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'title', code: 'doi-llm-conflict' }),
      ]),
    )
  })

  test('preserves user-overridden fields during DOI merge', () => {
    const llmRef: Reference = {
      type: 'J',
      language: 'en',
      authors: [{ family: 'Smith', given: 'John', isWestern: true }],
      title: 'Manual title',
      journal: 'Journal A',
      year: '2024',
    }

    const doiRef: Partial<Reference> = {
      title: 'DOI title',
      journal: 'Journal B',
    }

    const merged = mergeReference(llmRef, doiRef, {
      title: 'user',
    })

    expect(merged.ref.title).toBe('Manual title')
    expect(merged.sources.title).toBe('user')
    expect(merged.ref.journal).toBe('Journal B')
    expect(merged.sources.journal).toBe('doi')
  })

  test('fills publisher fields from DOI metadata and records source', () => {
    const llmRef: Reference = {
      type: 'C',
      language: 'en',
      authors: [{ family: 'Smith', given: 'John', isWestern: true }],
      title: 'Example paper',
    }

    const merged = mergeReference(llmRef, {
      bookTitle: 'Proceedings of CVPR 2020',
      publisher: 'IEEE',
      publisherPlace: 'Piscataway',
    })

    expect(merged.ref.bookTitle).toBe('Proceedings of CVPR 2020')
    expect(merged.ref.publisher).toBe('IEEE')
    expect(merged.ref.publisherPlace).toBe('Piscataway')
    expect(merged.sources.publisher).toBe('doi')
    expect(merged.warnings).toEqual([])
  })
})
