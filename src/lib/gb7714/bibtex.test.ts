import { describe, expect, test } from 'vitest'
import { formatBibTeXLibrary, formatBibTeXReference } from './bibtex'
import type { Reference } from './types'

describe('BibTeX export', () => {
  test('formats journal references as article entries', () => {
    const ref: Reference = {
      type: 'J',
      language: 'en',
      authors: [
        { family: 'Shaukat', given: 'U', isWestern: true },
        { family: 'Rossegger', given: 'E', isWestern: true },
      ],
      title: 'A Review of Multi-Material 3D Printing',
      subtitle: 'Functional Materials via Vat Photopolymerization',
      journal: 'Polymers',
      year: '2022',
      volume: '14',
      issue: '12',
      pages: '2449-2458',
      doi: '10.3390/polym14122449',
    }

    expect(formatBibTeXReference(ref, 'Shaukat2022Review')).toBe(`@article{Shaukat2022Review,
  author = {Shaukat, U and Rossegger, E},
  title = {A Review of Multi-Material 3D Printing: Functional Materials via Vat Photopolymerization},
  year = {2022},
  doi = {10.3390/polym14122449},
  journal = {Polymers},
  volume = {14},
  number = {12},
  pages = {2449--2458},
}`)
  })

  test('keeps citation keys unique and protects literal authors', () => {
    const ref: Reference = {
      type: 'EB/OL',
      language: 'en',
      authors: [{ literal: 'World Health Organization' }],
      title: 'Public health report',
      year: '2024',
      publishDate: '2024-02-01',
      accessDate: '2024-03-01',
      url: 'https://example.org/report',
    }

    expect(formatBibTeXLibrary([ref, ref])).toBe(`@misc{World2024Public,
  author = {{{World Health Organization}}},
  title = {Public health report},
  year = {2024},
  url = {https://example.org/report},
  urldate = {2024-03-01},
  howpublished = {https://example.org/report},
  note = {Published 2024-02-01},
}

@misc{World2024Public2,
  author = {{{World Health Organization}}},
  title = {Public health report},
  year = {2024},
  url = {https://example.org/report},
  urldate = {2024-03-01},
  howpublished = {https://example.org/report},
  note = {Published 2024-02-01},
}`)
  })
})
