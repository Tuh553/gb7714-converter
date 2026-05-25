import { describe, expect, test } from 'vitest'
import { parseLLMResponseContent } from './parse'

describe('parseLLMResponseContent', () => {
  test('normalizes markdown-wrapped JSON into a safe reference shape', () => {
    const result = parseLLMResponseContent([
      '```json',
      '{',
      '  "type": "J",',
      '  "language": "en",',
      '  "authors": ["Smith, John", { "family": "Doe", "given": "Jane", "isWestern": true }],',
      '  "title": "Example Article",',
      '  "journal": "Example Journal",',
      '  "year": 2024,',
      '  "confidence": { "title": 1.5, "year": "0.4", "unknown": 0.9 },',
      '  "notes": 123',
      '}',
      '```',
    ].join('\n'))

    expect(result.ref).toEqual(
      expect.objectContaining({
        type: 'J',
        language: 'en',
        title: 'Example Article',
        journal: 'Example Journal',
        year: '2024',
      }),
    )
    expect(result.ref.authors).toEqual([
      { literal: 'Smith, John' },
      { family: 'Doe', given: 'Jane', isWestern: true },
    ])
    expect(result.confidence).toEqual({ title: 1, year: 0.4 })
    expect(result.notes).toBeUndefined()
  })

  test('rejects missing required LLM fields before UI formatting', () => {
    expect(() => parseLLMResponseContent('{"type":"bad","authors":[]}')).toThrow(
      'LLM 返回字段异常',
    )
  })
})
