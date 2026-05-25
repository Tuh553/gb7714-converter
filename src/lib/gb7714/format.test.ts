import { describe, expect, test } from 'vitest'
import { formatReference } from './format'
import type { Reference } from './types'

describe('formatReference', () => {
  test('formats Chinese journal references with et al and DOI', () => {
    const ref: Reference = {
      type: 'J',
      language: 'zh',
      authors: [
        { family: '袁', given: '训来' },
        { family: '陈', given: '哲' },
        { family: '肖', given: '书海' },
        { family: '王', given: '伟' },
      ],
      title: '蓝田生物群',
      subtitle: '一个认识多细胞生物早期辐射的新窗口',
      journal: '科学通报',
      year: '2012',
      volume: '57',
      issue: '34',
      pages: '3219-3227',
      doi: '10.1000/example',
    }

    expect(formatReference(ref)).toBe(
      '袁训来, 陈哲, 肖书海, 等. 蓝田生物群: 一个认识多细胞生物早期辐射的新窗口[J]. 科学通报, 2012, 57(34): 3219-3227. DOI: 10.1000/example.',
    )
  })
})
