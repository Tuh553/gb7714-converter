import { describe, expect, test } from 'vitest'
import { extractIdentifiers, mergeReference } from './doi'
import type { Reference } from './gb7714/types'

describe('extractIdentifiers', () => {
  test('extracts DOI from free text and strips trailing punctuation', () => {
    const identifiers = extractIdentifiers(
      'Smith J. Example article. DOI: 10.1000/xyz-123.',
    )

    expect(identifiers).toEqual({ doi: '10.1000/xyz-123' })
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
})
