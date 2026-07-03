import type { Author, Reference } from './types'

type BibTeXEntryType = 'article' | 'book' | 'inproceedings' | 'phdthesis' | 'techreport' | 'misc'

interface BibTeXField {
  name: string
  value?: string
}

function entryTypeFor(ref: Reference): BibTeXEntryType {
  switch (ref.type) {
    case 'J':
    case 'J/OL':
      return 'article'
    case 'M':
    case 'M/OL':
      return 'book'
    case 'C':
      return 'inproceedings'
    case 'D':
      return 'phdthesis'
    case 'R':
      return 'techreport'
    case 'EB/OL':
      return 'misc'
  }
}

function titleFor(ref: Reference): string {
  return ref.subtitle ? `${ref.title}: ${ref.subtitle}` : ref.title
}

function escapeBibTeXValue(value: string): string {
  return value
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[{}]/g, (match) => `\\${match}`)
}

function formatAuthor(author: Author): string {
  if (author.literal) return `{{${escapeBibTeXValue(author.literal)}}}`

  const family = (author.family ?? '').trim()
  const given = (author.given ?? '').trim()
  if (!family) return escapeBibTeXValue(given)
  if (!given) return escapeBibTeXValue(family)
  if (author.isWestern) return `${escapeBibTeXValue(family)}, ${escapeBibTeXValue(given)}`
  return escapeBibTeXValue(`${family}${given}`)
}

function formatAuthors(authors: Author[]): string | undefined {
  const value = authors.map(formatAuthor).filter(Boolean).join(' and ')
  return value || undefined
}

function normalizePages(pages?: string): string | undefined {
  return pages?.trim().replace(/(\d)\s*-\s*(\d)/g, '$1--$2') || undefined
}

function addField(fields: BibTeXField[], name: string, value?: string): void {
  const trimmed = value?.trim()
  if (trimmed) fields.push({ name, value: trimmed })
}

function baseFields(ref: Reference): BibTeXField[] {
  const fields: BibTeXField[] = []
  addField(fields, 'author', formatAuthors(ref.authors))
  addField(fields, 'title', titleFor(ref))
  addField(fields, 'year', ref.year)
  addField(fields, 'doi', ref.doi)
  addField(fields, 'url', ref.url)
  addField(fields, 'urldate', ref.accessDate)
  return fields
}

function fieldsFor(ref: Reference): BibTeXField[] {
  const fields = baseFields(ref)

  switch (ref.type) {
    case 'J':
    case 'J/OL':
      addField(fields, 'journal', ref.journal)
      addField(fields, 'volume', ref.volume)
      addField(fields, 'number', ref.issue)
      addField(fields, 'pages', normalizePages(ref.pages))
      break
    case 'M':
    case 'M/OL':
      addField(fields, 'publisher', ref.publisher)
      addField(fields, 'address', ref.publisherPlace)
      addField(fields, 'edition', ref.edition)
      addField(fields, 'pages', normalizePages(ref.pages))
      break
    case 'C':
      addField(fields, 'booktitle', ref.bookTitle)
      addField(fields, 'editor', ref.bookEditors)
      addField(fields, 'publisher', ref.publisher)
      addField(fields, 'address', ref.publisherPlace)
      addField(fields, 'pages', normalizePages(ref.pages))
      break
    case 'D':
      addField(fields, 'school', ref.institution)
      addField(fields, 'address', ref.institutionPlace)
      break
    case 'R':
      addField(fields, 'institution', ref.publisher)
      addField(fields, 'address', ref.publisherPlace)
      addField(fields, 'number', ref.reportNumber)
      break
    case 'EB/OL':
      addField(fields, 'howpublished', ref.url)
      addField(fields, 'note', ref.publishDate ? `Published ${ref.publishDate}` : undefined)
      break
  }

  return fields
}

function asciiWords(value: string): string[] {
  return value.match(/[A-Za-z0-9]+/g) ?? []
}

function firstAuthorKeyPart(ref: Reference): string | undefined {
  const first = ref.authors[0]
  if (!first) return undefined
  const source = first.family || first.literal || first.given || ''
  return asciiWords(source)[0]
}

function makeCitationKey(ref: Reference, index: number): string {
  const parts = [
    firstAuthorKeyPart(ref),
    ref.year?.match(/\d{4}/)?.[0],
    asciiWords(ref.title)[0],
  ].filter(Boolean)

  return parts.join('') || `ref${index + 1}`
}

function uniqueCitationKeys(refs: Reference[]): string[] {
  const counts = new Map<string, number>()

  return refs.map((ref, index) => {
    const base = makeCitationKey(ref, index)
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    return count === 0 ? base : `${base}${count + 1}`
  })
}

export function formatBibTeXReference(ref: Reference, citationKey: string): string {
  const fieldLines = fieldsFor(ref).map(
    ({ name, value }) => `  ${name} = {${name === 'author' ? value : escapeBibTeXValue(value ?? '')}},`,
  )

  return `@${entryTypeFor(ref)}{${citationKey},\n${fieldLines.join('\n')}\n}`
}

export function formatBibTeXLibrary(refs: Reference[]): string {
  const keys = uniqueCitationKeys(refs)
  return refs.map((ref, index) => formatBibTeXReference(ref, keys[index])).join('\n\n')
}
