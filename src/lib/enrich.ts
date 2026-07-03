// 多源元数据补全编排
// 并行查询 Crossref 与 OpenAlex：Crossref 结果优先，OpenAlex 补缺，
// 两源一致的字段记入 verifiedFields（供置信度提升），不一致时产出 source-conflict 提示

import type {
  ConfidenceMap,
  FieldName,
  FieldSource,
  IdentifierInfo,
  Reference,
  ValidationIssue,
} from './gb7714/types'
import { enrichByDoi } from './doi'
import { enrichByOpenAlex } from './openalex'

export interface EnrichmentResult {
  // 多源合并后的元数据，供 mergeReference 与 LLM 结果合并
  ref: Partial<Reference>
  // 两个源独立返回且值一致的字段
  verifiedFields: FieldName[]
  // 源间冲突与全部失败的提示
  issues: ValidationIssue[]
  // 成功返回数据的源名，如 ['Crossref', 'OpenAlex']
  sources: string[]
}

// 参与交叉核验的字段；作者（姓名表示差异大）与 DOI（恒等）不参与
const VERIFY_FIELDS: FieldName[] = ['title', 'journal', 'year', 'volume', 'issue', 'pages', 'publisher', 'bookTitle']

const FIELD_NOTE_LABELS: Partial<Record<FieldName, string>> = {
  title: '题名',
  journal: '刊名',
  year: '年份',
  volume: '卷',
  issue: '期',
  pages: '页码',
  publisher: '出版者',
  bookTitle: '论文集名',
}

export function emptyEnrichment(): EnrichmentResult {
  return { ref: {}, verifiedFields: [], issues: [], sources: [] }
}

export function failedEnrichment(): EnrichmentResult {
  return {
    ...emptyEnrichment(),
    issues: [
      {
        id: 'hint:doi-lookup-failed:doi',
        severity: 'hint',
        code: 'doi-lookup-failed',
        field: 'doi',
        message: 'DOI 元数据拉取失败，已回退到纯 LLM 解析',
      },
    ],
  }
}

export async function enrichByIdentifiers(
  identifier: IdentifierInfo,
  signal?: AbortSignal,
): Promise<EnrichmentResult> {
  if (!identifier.doi) return emptyEnrichment()

  const [crossref, openAlex] = await Promise.allSettled([
    enrichByDoi(identifier.doi, signal),
    enrichByOpenAlex(identifier.doi, signal),
  ])
  if (signal?.aborted) throw abortError()

  const primary = crossref.status === 'fulfilled' ? crossref.value : undefined
  const secondary = openAlex.status === 'fulfilled' ? openAlex.value : undefined
  if (!primary && !secondary) return failedEnrichment()

  const result = emptyEnrichment()
  if (primary) result.sources.push('Crossref')
  if (secondary) result.sources.push('OpenAlex')

  const ref: Partial<Reference> = { ...(primary ?? {}) }
  if (secondary) {
    for (const [field, value] of Object.entries(secondary) as Array<[FieldName, Reference[FieldName]]>) {
      if (!hasFieldValue(value)) continue
      if (!hasFieldValue(ref[field])) {
        ref[field] = value as never
        continue
      }
      if (!VERIFY_FIELDS.includes(field)) continue
      if (sameFieldValue(ref[field], value)) result.verifiedFields.push(field)
      else result.issues.push(createConflictIssue(field))
    }
  }
  result.ref = ref
  return result
}

// DOI/多源核验过的字段直接提升置信度，避免 LLM 自评低分残留
export function boostEnrichedConfidence(
  confidence: ConfidenceMap,
  sources: Partial<Record<FieldName, FieldSource>>,
  verifiedFields: FieldName[],
): ConfidenceMap {
  const next: ConfidenceMap = { ...confidence }
  for (const [field, source] of Object.entries(sources) as Array<[FieldName, FieldSource]>) {
    if (source !== 'doi') continue
    next[field] = Math.max(next[field] ?? 0, verifiedFields.includes(field) ? 0.99 : 0.95)
  }
  return next
}

// 两源核验一致时生成 notes 摘要；单源或无一致字段时不加注
export function enrichmentNote(enrichment: EnrichmentResult): string | undefined {
  if (enrichment.sources.length < 2 || enrichment.verifiedFields.length === 0) return undefined
  const labels = enrichment.verifiedFields.map((f) => FIELD_NOTE_LABELS[f] ?? String(f))
  return `${enrichment.sources.join('+')} 交叉核验一致: ${labels.join('、')}`
}

function abortError(): Error {
  const error = new Error('已中止')
  error.name = 'AbortError'
  return error
}

function createConflictIssue(field: FieldName): ValidationIssue {
  return {
    id: `hint:source-conflict:${field}`,
    severity: 'hint',
    code: 'source-conflict',
    field,
    message: `${FIELD_NOTE_LABELS[field] ?? String(field)} 在 Crossref 与 OpenAlex 之间不一致，已采用 Crossref 值，建议复核`,
  }
}

function hasFieldValue(value: Reference[FieldName] | undefined): boolean {
  if (value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function normalizeForCompare(value: string): string {
  return value
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/, '')
    .trim()
}

function sameFieldValue(a: Reference[FieldName] | undefined, b: Reference[FieldName]): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return normalizeForCompare(a) === normalizeForCompare(b)
  }
  return JSON.stringify(a) === JSON.stringify(b)
}
