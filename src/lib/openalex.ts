// OpenAlex 元数据源
// 免 key、CORS 开放、覆盖面广，作为 Crossref 的兜底与交叉核验源

import type { Author, Reference } from './gb7714/types'
import { normalizeDoi } from './doi'

interface OpenAlexSource {
  display_name?: string | null
  type?: string | null
}

interface OpenAlexWork {
  doi?: string | null
  title?: string | null
  display_name?: string | null
  publication_year?: number | null
  type?: string | null
  biblio?: {
    volume?: string | null
    issue?: string | null
    first_page?: string | null
    last_page?: string | null
  } | null
  primary_location?: { source?: OpenAlexSource | null } | null
  authorships?: Array<{
    author?: { display_name?: string | null } | null
    raw_author_name?: string | null
  }> | null
}

const openAlexCache = new Map<string, Partial<Reference>>()

export async function enrichByOpenAlex(doi: string, signal?: AbortSignal): Promise<Partial<Reference>> {
  const normalized = normalizeDoi(doi)
  const cached = openAlexCache.get(normalized)
  if (cached) return cached

  // DOI 中的斜杠保持原样（OpenAlex 路由要求），其余保留字符转义
  const encoded = encodeURIComponent(normalized).replace(/%2F/gi, '/')
  const res = await fetch(`https://api.openalex.org/works/doi:${encoded}`, { signal })
  if (!res.ok) {
    throw new Error(`OpenAlex 请求失败: HTTP ${res.status}`)
  }
  const work = (await res.json()) as OpenAlexWork
  const ref = openAlexToReference(work)
  openAlexCache.set(normalized, ref)
  return ref
}

export function clearOpenAlexCache(): void {
  openAlexCache.clear()
}

function openAlexToReference(work: OpenAlexWork): Partial<Reference> {
  const source = work.primary_location?.source ?? undefined
  const isProceedings = work.type === 'proceedings-article' || work.type === 'proceedings'
  return {
    type: inferTypeFromOpenAlex(work.type),
    language: 'en',
    title: work.title ?? work.display_name ?? undefined,
    // 预印本等 repository 来源名不是刊名，仅 journal 类来源才映射
    journal: !isProceedings && source?.type === 'journal' ? source.display_name ?? undefined : undefined,
    bookTitle: isProceedings ? source?.display_name ?? undefined : undefined,
    year: work.publication_year ? String(work.publication_year) : undefined,
    volume: work.biblio?.volume ?? undefined,
    issue: work.biblio?.issue ?? undefined,
    pages: formatPages(work.biblio?.first_page, work.biblio?.last_page),
    doi: work.doi ? normalizeDoi(work.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')) : undefined,
    authors: mapOpenAlexAuthors(work.authorships),
  }
}

function inferTypeFromOpenAlex(type: string | null | undefined): Reference['type'] | undefined {
  switch (type) {
    case 'article':
      return 'J'
    case 'book':
    case 'book-chapter':
      return 'M'
    case 'dissertation':
      return 'D'
    case 'report':
      return 'R'
    case 'proceedings':
    case 'proceedings-article':
      return 'C'
    default:
      return undefined
  }
}

function formatPages(first?: string | null, last?: string | null): string | undefined {
  const start = first?.trim()
  const end = last?.trim()
  if (start && end) return start === end ? start : `${start}-${end}`
  return start || undefined
}

function mapOpenAlexAuthors(authorships: OpenAlexWork['authorships']): Author[] | undefined {
  if (!authorships?.length) return undefined
  const authors = authorships
    .map((a) => toAuthor(a.author?.display_name ?? a.raw_author_name ?? ''))
    .filter((a): a is Author => a !== undefined)
  return authors.length ? authors : undefined
}

// OpenAlex 只给 display_name 全名，按「末词为姓」拆分；CJK 或单词名回退 literal
function toAuthor(name: string): Author | undefined {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  if (/[㐀-鿿]/.test(trimmed)) return { literal: trimmed }
  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) return { literal: trimmed }
  return {
    family: parts[parts.length - 1],
    given: parts.slice(0, -1).join(' '),
    isWestern: true,
  }
}
