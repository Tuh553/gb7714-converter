import type {
  Author,
  FieldName,
  FieldSource,
  IdentifierInfo,
  Reference,
  ValidationIssue,
} from './gb7714/types'

const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/ig
const URL_RE = /https?:\/\/[^\s<>"'，。；、]+/gi
const DOI_LANDING_PAGE_SUFFIX_RE = /\/(?:full|abstract|pdf|epdf|html?|xml|meta)$/i
const TRAILING_DOI_PUNCTUATION_RE = /[.,;:)\]\u3002\uff0c\uff1b\uff1a\uff09\uff3d]+$/
const TRAILING_URL_PUNCTUATION_RE = /[.,;)\]\u3002\uff0c\uff1b\uff09\uff3d]+$/
const doiCache = new Map<string, Partial<Reference>>()
const DOI_PRIORITY_FIELDS: FieldName[] = [
  'title',
  'authors',
  'journal',
  'year',
  'volume',
  'issue',
  'pages',
  'doi',
  'publisher',
  'publisherPlace',
  'bookTitle',
  'bookEditors',
]

function initialSources(ref: Reference): Partial<Record<FieldName, FieldSource>> {
  const sources: Partial<Record<FieldName, FieldSource>> = {}
  for (const [key, value] of Object.entries(ref) as Array<[FieldName, Reference[FieldName]]>) {
    if (value === undefined) continue
    if (Array.isArray(value) && value.length === 0) continue
    sources[key] = 'llm'
  }
  return sources
}

function createConflictIssue(field: FieldName): ValidationIssue {
  return {
    id: `warning:doi-llm-conflict:${field}`,
    severity: 'warning',
    code: 'doi-llm-conflict',
    field,
    message: `${field} 与 DOI 元数据冲突，已优先采用 DOI 结果`,
  }
}

function hasFieldValue(value: Reference[FieldName] | undefined): boolean {
  if (value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'boolean') return true
  return true
}

export function extractIdentifiers(raw: string): IdentifierInfo {
  const doi = extractDoi(raw)
  const url = extractUrl(raw)
  return {
    ...(doi ? { doi } : {}),
    ...(url ? { url } : {}),
  }
}

function extractDoi(raw: string): string | undefined {
  DOI_RE.lastIndex = 0
  const match = DOI_RE.exec(raw)
  return match ? normalizeDoi(match[0]) : undefined
}

function extractUrl(raw: string): string | undefined {
  URL_RE.lastIndex = 0
  const match = URL_RE.exec(raw)
  return match ? normalizeUrl(match[0]) : undefined
}

export async function enrichByDoi(doi: string, signal?: AbortSignal): Promise<Partial<Reference>> {
  const normalizedDoi = normalizeDoi(doi)
  const cached = doiCache.get(normalizedDoi)
  if (cached) return cached

  const url = `https://api.crossref.org/works/${encodeURIComponent(normalizedDoi)}`
  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`Crossref 请求失败: HTTP ${res.status}`)
  }
  const data = (await res.json()) as { message?: CrossrefWork }
  if (!data.message) {
    throw new Error('Crossref 返回为空')
  }
  const ref = crossrefToReference(data.message)
  doiCache.set(normalizedDoi, ref)
  return ref
}

export function clearDoiCache(): void {
  doiCache.clear()
}

export function normalizeDoi(doi: string): string {
  let normalized = doi.trim().replace(TRAILING_DOI_PUNCTUATION_RE, '')
  normalized = normalized.replace(DOI_LANDING_PAGE_SUFFIX_RE, '')
  return normalized.toLowerCase()
}

function normalizeUrl(url: string): string {
  return url.trim().replace(TRAILING_URL_PUNCTUATION_RE, '')
}

interface MergeResult {
  ref: Reference
  sources: Partial<Record<FieldName, FieldSource>>
  warnings: ValidationIssue[]
}

export function mergeReference(
  llmRef: Reference,
  doiRef: Partial<Reference>,
  existingSources: Partial<Record<FieldName, FieldSource>> = {},
): MergeResult {
  const ref: Reference = { ...llmRef }
  const sources = { ...initialSources(llmRef), ...existingSources }
  const warnings: ValidationIssue[] = []

  if (!ref.type && doiRef.type) {
    ref.type = doiRef.type
    sources.type = existingSources.type ?? 'doi'
  }

  for (const field of DOI_PRIORITY_FIELDS) {
    const doiValue = doiRef[field]
    if (!hasFieldValue(doiValue)) continue
    if (sources[field] === 'user') continue

    const currentValue = ref[field]
    if (hasFieldValue(currentValue) && JSON.stringify(currentValue) !== JSON.stringify(doiValue)) {
      warnings.push(createConflictIssue(field))
    }

    ref[field] = doiValue as never
    sources[field] = 'doi'
  }

  return { ref, sources, warnings }
}

interface CrossrefWork {
  DOI?: string
  type?: string
  title?: string[]
  'container-title'?: string[]
  issued?: { 'date-parts'?: number[][] }
  volume?: string
  issue?: string
  page?: string
  publisher?: string
  'publisher-location'?: string
  author?: CrossrefAuthor[]
  editor?: CrossrefAuthor[]
}

interface CrossrefAuthor {
  family?: string
  given?: string
  name?: string
}

// proceedings / book-chapter 的 container-title 是论文集名而非刊名
function containerIsVolume(type: string | undefined): boolean {
  return type === 'proceedings-article' || type === 'book-chapter'
}

function crossrefToReference(work: CrossrefWork): Partial<Reference> {
  const container = work['container-title']?.[0]
  const isVolume = containerIsVolume(work.type)
  return {
    type: inferTypeFromCrossref(work.type),
    language: 'en',
    title: work.title?.[0],
    journal: isVolume ? undefined : container,
    bookTitle: isVolume ? container : undefined,
    bookEditors: formatCrossrefEditors(work.editor),
    publisher: work.publisher,
    publisherPlace: work['publisher-location'],
    year: work.issued?.['date-parts']?.[0]?.[0]?.toString(),
    volume: work.volume,
    issue: work.issue,
    pages: work.page?.replace(/–/g, '-'),
    doi: work.DOI,
    authors: mapCrossrefAuthors(work.author),
  }
}

// 编辑者格式化为 GB 西文著者形式: "SMITH J K, LEE M"
function formatCrossrefEditors(editors: CrossrefAuthor[] | undefined): string | undefined {
  if (!editors?.length) return undefined
  const names = editors
    .map((e) => {
      if (e.name) return e.name
      const family = (e.family ?? '').toUpperCase()
      const initials = (e.given ?? '')
        .split(/[\s\-.]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase())
        .join(' ')
      return [family, initials].filter(Boolean).join(' ')
    })
    .filter(Boolean)
  return names.length ? names.join(', ') : undefined
}

function inferTypeFromCrossref(type: string | undefined): Reference['type'] | undefined {
  if (!type) return undefined
  if (type.includes('journal')) return 'J'
  if (type.includes('book')) return 'M'
  if (type.includes('proceedings')) return 'C'
  if (type.includes('dissertation')) return 'D'
  if (type.includes('report')) return 'R'
  return undefined
}

function mapCrossrefAuthors(authors: CrossrefAuthor[] | undefined): Author[] | undefined {
  if (!authors?.length) return undefined
  return authors.map((author) => {
    if (author.name && !author.family && !author.given) {
      return { literal: author.name }
    }
    return {
      family: author.family,
      given: author.given,
      isWestern: true,
    }
  })
}
