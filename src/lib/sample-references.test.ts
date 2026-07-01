import { describe, expect, test } from 'vitest'
import { extractIdentifiers } from './doi'
import { splitReferences } from './split'
import {
  vatPhotopolymerizationExpectedDois,
  vatPhotopolymerizationFrontiersUrl,
  vatPhotopolymerizationSample,
} from '@/test/fixtures/referenceSamples'

describe('vat photopolymerization sample references', () => {
  test('splits the pasted newline-separated list into 16 references', () => {
    const result = splitReferences(vatPhotopolymerizationSample)

    expect(result.strategy).toBe('newline')
    expect(result.segments).toHaveLength(16)
    expect(result.segments[0]).toContain('Shaukat U')
    expect(result.segments[15]).toContain('Cao W')
  })

  test('extracts normalized DOI and URL identifiers from publisher links', () => {
    const { segments } = splitReferences(vatPhotopolymerizationSample)
    const identifiers = segments.map(extractIdentifiers)

    expect(identifiers).toHaveLength(16)
    expect(identifiers.every((identifier) => identifier.url)).toBe(true)
    expect(identifiers.map((identifier) => identifier.doi).filter(Boolean)).toEqual(
      vatPhotopolymerizationExpectedDois,
    )
    expect(identifiers[6].url).toBe(vatPhotopolymerizationFrontiersUrl)
  })
})
