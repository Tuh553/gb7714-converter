import { afterEach, describe, expect, test, vi } from 'vitest'
import { clearDoiCache } from './doi'
import { clearOpenAlexCache } from './openalex'
import {
  boostEnrichedConfidence,
  emptyEnrichment,
  enrichByIdentifiers,
  enrichmentNote,
} from './enrich'

interface StubResponse {
  status: number
  body?: unknown
}

function crossrefBody() {
  return {
    message: {
      DOI: '10.1000/xyz-123',
      type: 'journal-article',
      title: ['Deep Learning'],
      'container-title': ['Nature'],
      issued: { 'date-parts': [[2015]] },
      volume: '521',
      page: '436-444',
      author: [{ family: 'LeCun', given: 'Yann' }],
    },
  }
}

function openAlexBody(overrides: Record<string, unknown> = {}) {
  return {
    doi: 'https://doi.org/10.1000/xyz-123',
    title: 'Deep learning',
    publication_year: 2015,
    type: 'article',
    biblio: { volume: '521', first_page: '436', last_page: '444' },
    primary_location: { source: { display_name: 'Nature', type: 'journal' } },
    ...overrides,
  }
}

function stubFetch(crossref: StubResponse, openAlex: StubResponse) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input)
    const stub = url.includes('api.crossref.org')
      ? crossref
      : url.includes('api.openalex.org')
        ? openAlex
        : undefined
    if (!stub) throw new Error(`unexpected url: ${url}`)
    return {
      ok: stub.status === 200,
      status: stub.status,
      json: async () => stub.body,
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  clearDoiCache()
  clearOpenAlexCache()
  vi.restoreAllMocks()
})

describe('enrichByIdentifiers', () => {
  test('marks fields agreed by both sources as verified', async () => {
    stubFetch({ status: 200, body: crossrefBody() }, { status: 200, body: openAlexBody() })

    const result = await enrichByIdentifiers({ doi: '10.1000/xyz-123' })

    expect(result.sources).toEqual(['Crossref', 'OpenAlex'])
    // Crossref 优先
    expect(result.ref.title).toBe('Deep Learning')
    // 题名大小写差异经归一化后视为一致
    expect(result.verifiedFields).toEqual(
      expect.arrayContaining(['title', 'journal', 'year', 'volume', 'pages']),
    )
    expect(result.issues).toEqual([])
  })

  test('keeps Crossref value and reports hint on source conflict', async () => {
    stubFetch(
      { status: 200, body: crossrefBody() },
      { status: 200, body: openAlexBody({ publication_year: 2016 }) },
    )

    const result = await enrichByIdentifiers({ doi: '10.1000/xyz-123' })

    expect(result.ref.year).toBe('2015')
    expect(result.verifiedFields).not.toContain('year')
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'source-conflict', field: 'year', severity: 'hint' }),
    ])
  })

  test('falls back to OpenAlex when Crossref fails', async () => {
    stubFetch({ status: 500 }, { status: 200, body: openAlexBody() })

    const result = await enrichByIdentifiers({ doi: '10.1000/xyz-123' })

    expect(result.sources).toEqual(['OpenAlex'])
    expect(result.ref.title).toBe('Deep learning')
    expect(result.ref.journal).toBe('Nature')
    expect(result.verifiedFields).toEqual([])
    expect(result.issues).toEqual([])
  })

  test('reports lookup failure when all sources fail', async () => {
    stubFetch({ status: 500 }, { status: 404 })

    const result = await enrichByIdentifiers({ doi: '10.1000/xyz-123' })

    expect(result.sources).toEqual([])
    expect(result.ref).toEqual({})
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'doi-lookup-failed', severity: 'hint' }),
    ])
  })

  test('skips lookups when no DOI identified', async () => {
    const fetchMock = stubFetch({ status: 200, body: {} }, { status: 200, body: {} })

    const result = await enrichByIdentifiers({ url: 'https://example.com' })

    expect(result).toEqual(emptyEnrichment())
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('boostEnrichedConfidence', () => {
  test('raises confidence only for doi-sourced fields', () => {
    const boosted = boostEnrichedConfidence(
      { title: 0.6, year: 0.7, journal: 0.5 },
      { title: 'doi', year: 'doi', journal: 'llm', pages: 'user' },
      ['title'],
    )

    // 交叉核验一致 → 0.99
    expect(boosted.title).toBe(0.99)
    // 单源 DOI → 0.95
    expect(boosted.year).toBe(0.95)
    // 非 DOI 来源不动
    expect(boosted.journal).toBe(0.5)
    expect(boosted.pages).toBeUndefined()
  })
})

describe('enrichmentNote', () => {
  test('summarizes cross-verified fields', () => {
    const note = enrichmentNote({
      ref: {},
      verifiedFields: ['title', 'year'],
      issues: [],
      sources: ['Crossref', 'OpenAlex'],
    })

    expect(note).toBe('Crossref+OpenAlex 交叉核验一致: 题名、年份')
  })

  test('returns undefined for single-source enrichment', () => {
    const note = enrichmentNote({
      ref: { title: 'x' },
      verifiedFields: [],
      issues: [],
      sources: ['Crossref'],
    })

    expect(note).toBeUndefined()
  })
})
