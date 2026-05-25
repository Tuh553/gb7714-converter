import type {
  Author,
  FieldName,
  FieldSource,
  IdentifierInfo,
  Reference,
  ValidationIssue,
} from './gb7714/types'

const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i
const DOI_PRIORITY_FIELDS: FieldName[] = [
  'title',
  'authors',
  'journal',
  'year',
  'volume',
  'issue',
  'pages',
  'doi',
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
  const match = raw.match(DOI_RE)
  return match ? { doi: match[0].replace(/[.,;)\]]+$/, '') } : {}
}

export async function enrichByDoi(doi: string, signal?: AbortSignal): Promise<Partial<Reference>> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`
  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`Crossref 请求失败: HTTP ${res.status}`)
  }
  const data = (await res.json()) as { message?: CrossrefWork }
  if (!data.message) {
    throw new Error('Crossref 返回为空')
  }
  return crossrefToReference(data.message)
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
  author?: CrossrefAuthor[]
}

interface CrossrefAuthor {
  family?: string
  given?: string
  name?: string
}

function crossrefToReference(work: CrossrefWork): Partial<Reference> {
  return {
    type: inferTypeFromCrossref(work.type),
    language: 'en',
    title: work.title?.[0],
    journal: work['container-title']?.[0],
    year: work.issued?.['date-parts']?.[0]?.[0]?.toString(),
    volume: work.volume,
    issue: work.issue,
    pages: work.page?.replace(/–/g, '-'),
    doi: work.DOI,
    authors: mapCrossrefAuthors(work.author),
  }
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
