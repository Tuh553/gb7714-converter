import { describe, expect, test } from 'vitest'
import { splitReferences } from './split'

describe('splitReferences', () => {
  test('splits numbered multiline references and removes numbering prefixes', () => {
    const result = splitReferences(`
      [1] 袁训来, 陈哲. 蓝田生物群.
      科学通报, 2012.
      [2] Smith J. Example article.
      Journal, 2024.
    `)

    expect(result.strategy).toBe('numbered')
    expect(result.segments).toEqual([
      '袁训来, 陈哲. 蓝田生物群. 科学通报, 2012.',
      'Smith J. Example article. Journal, 2024.',
    ])
  })
})
