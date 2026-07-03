import { afterEach, describe, expect, test, vi } from 'vitest'
import { clearOpenAlexCache, enrichByOpenAlex } from './openalex'

function stubWork(overrides: Record<string, unknown> = {}) {
  return {
    doi: 'https://doi.org/10.1000/xyz-123',
    title: 'Correct title',
    publication_year: 2024,
    type: 'article',
    biblio: { volume: '12', issue: '3', first_page: '100', last_page: '110' },
    primary_location: { source: { display_name: 'Correct Journal', type: 'journal' } },
    authorships: [
      { author: { display_name: 'John K. Smith' } },
      { author: { display_name: '张三' } },
    ],
    ...overrides,
  }
}

function stubFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  clearOpenAlexCache()
  vi.restoreAllMocks()
})

describe('enrichByOpenAlex', () => {
  test('maps OpenAlex work to reference fields', async () => {
    stubFetch(stubWork())

    const ref = await enrichByOpenAlex('10.1000/xyz-123')

    expect(ref.type).toBe('J')
    expect(ref.title).toBe('Correct title')
    expect(ref.journal).toBe('Correct Journal')
    expect(ref.year).toBe('2024')
    expect(ref.volume).toBe('12')
    expect(ref.issue).toBe('3')
    expect(ref.pages).toBe('100-110')
    expect(ref.doi).toBe('10.1000/xyz-123')
    expect(ref.authors).toEqual([
      { family: 'Smith', given: 'John K.', isWestern: true },
      { literal: '张三' },
    ])
  })

  test('maps proceedings source to bookTitle instead of journal', async () => {
    stubFetch(
      stubWork({
        type: 'proceedings-article',
        primary_location: { source: { display_name: 'Proceedings of CVPR', type: 'conference' } },
      }),
    )

    const ref = await enrichByOpenAlex('10.1000/xyz-123')

    expect(ref.type).toBe('C')
    expect(ref.bookTitle).toBe('Proceedings of CVPR')
    expect(ref.journal).toBeUndefined()
  })

  test('does not map repository source as journal', async () => {
    stubFetch(
      stubWork({
        primary_location: { source: { display_name: 'arXiv (Cornell University)', type: 'repository' } },
      }),
    )

    const ref = await enrichByOpenAlex('10.1000/xyz-123')

    expect(ref.journal).toBeUndefined()
  })

  test('reuses cache for duplicate DOI lookups', async () => {
    const fetchMock = stubFetch(stubWork())

    await enrichByOpenAlex('10.1000/xyz-123')
    await enrichByOpenAlex(' 10.1000/XYZ-123 ')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('throws on http error', async () => {
    stubFetch({}, false, 404)

    await expect(enrichByOpenAlex('10.1000/missing')).rejects.toThrow('HTTP 404')
  })
})
