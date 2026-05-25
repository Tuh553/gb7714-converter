// LLM 客户端 - 单条参考文献解析
// 浏览器直接调用 OpenAI / OpenAI 兼容接口（dangerouslyAllowBrowser）

import OpenAI from 'openai'
import type { Author, Reference, ConfidenceMap, DocumentType, Language, FieldName } from '../gb7714/types'
import { buildSystemPrompt, USER_PROMPT_PREFIX } from '../gb7714/prompt'

export interface LLMConfig {
  apiKey: string
  baseURL?: string
  model: string
}

export interface ParseResult {
  ref: Reference
  confidence: ConfidenceMap
  notes?: string
}

// 缓存的系统提示词。固定不变 → 命中 OpenAI 自动 prompt cache
const SYSTEM_PROMPT_CACHED = buildSystemPrompt()

// 单例 OpenAI client，配置变化时重建
let cachedClient: OpenAI | null = null
let cachedKey = ''

function getClient(cfg: LLMConfig): OpenAI {
  const key = `${cfg.apiKey}|${cfg.baseURL ?? ''}`
  if (cachedClient && cachedKey === key) return cachedClient
  cachedClient = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL || undefined,
    dangerouslyAllowBrowser: true,
  })
  cachedKey = key
  return cachedClient
}

// 拉取可用模型 id 列表（兼容 OpenAI /v1/models 接口）
export async function listModels(cfg: LLMConfig, signal?: AbortSignal): Promise<string[]> {
  if (!cfg.apiKey) throw new Error('请先填入 API key')
  const client = getClient(cfg)
  const res = await client.models.list({ signal })
  const ids = res.data.map((m) => m.id).filter(Boolean)
  return Array.from(new Set(ids)).sort()
}

// 仅测试连通性：成功时返回模型数量，失败抛错（带 HTTP 状态码）
export async function testConnection(
  cfg: LLMConfig,
  signal?: AbortSignal,
): Promise<{ modelCount: number }> {
  const ids = await listModels(cfg, signal)
  return { modelCount: ids.length }
}

// 解析单条参考文献
export async function parseReference(
  cfg: LLMConfig,
  raw: string,
  signal?: AbortSignal,
): Promise<ParseResult> {
  if (!cfg.apiKey) throw new Error('请先在设置中填入 API key')
  if (!cfg.model) throw new Error('请先在设置中选择模型')

  const client = getClient(cfg)
  const response = await client.chat.completions.create(
    {
      model: cfg.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_CACHED },
        { role: 'user', content: USER_PROMPT_PREFIX + raw },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    },
    { signal },
  )

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('LLM 返回为空')

  return parseLLMResponseContent(content)
}

const DOCUMENT_TYPES: DocumentType[] = ['J', 'M', 'C', 'D', 'R', 'J/OL', 'M/OL', 'EB/OL']
const LANGUAGES: Language[] = ['zh', 'en']
const FIELD_NAMES: FieldName[] = [
  'type',
  'language',
  'authors',
  'etAl',
  'title',
  'subtitle',
  'journal',
  'year',
  'volume',
  'issue',
  'pages',
  'doi',
  'edition',
  'publisher',
  'publisherPlace',
  'otherResponsibles',
  'bookTitle',
  'bookEditors',
  'institutionPlace',
  'institution',
  'reportNumber',
  'publishDate',
  'accessDate',
  'url',
]

export function parseLLMResponseContent(content: string): ParseResult {
  const parsed = extractJson(content)
  const ref = normalizeReference(parsed)
  return {
    ref,
    confidence: normalizeConfidence(parsed.confidence),
    notes: typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes.trim() : undefined,
  }
}

function normalizeReference(parsed: Record<string, unknown>): Reference {
  const type = normalizeEnum(parsed.type, DOCUMENT_TYPES)
  const language = normalizeEnum(parsed.language, LANGUAGES)
  const title = normalizeString(parsed.title)
  const authors = normalizeAuthors(parsed.authors)

  if (!type || !language || !title || authors === undefined) {
    throw new Error('LLM 返回字段异常: 缺少 type/language/authors/title 或字段类型不正确')
  }

  const ref: Reference = {
    type,
    language,
    authors,
    title,
  }

  setOptionalString(ref, 'subtitle', parsed.subtitle)
  setOptionalString(ref, 'journal', parsed.journal)
  setOptionalString(ref, 'year', parsed.year)
  setOptionalString(ref, 'volume', parsed.volume)
  setOptionalString(ref, 'issue', parsed.issue)
  setOptionalString(ref, 'pages', parsed.pages)
  setOptionalString(ref, 'doi', parsed.doi)
  setOptionalString(ref, 'edition', parsed.edition)
  setOptionalString(ref, 'publisher', parsed.publisher)
  setOptionalString(ref, 'publisherPlace', parsed.publisherPlace)
  setOptionalString(ref, 'otherResponsibles', parsed.otherResponsibles)
  setOptionalString(ref, 'bookTitle', parsed.bookTitle)
  setOptionalString(ref, 'bookEditors', parsed.bookEditors)
  setOptionalString(ref, 'institutionPlace', parsed.institutionPlace)
  setOptionalString(ref, 'institution', parsed.institution)
  setOptionalString(ref, 'reportNumber', parsed.reportNumber)
  setOptionalString(ref, 'publishDate', parsed.publishDate)
  setOptionalString(ref, 'accessDate', parsed.accessDate)
  setOptionalString(ref, 'url', parsed.url)

  if (typeof parsed.etAl === 'boolean') ref.etAl = parsed.etAl
  return ref
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function normalizeAuthors(value: unknown): Author[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item) => {
    if (typeof item === 'string') {
      const literal = item.trim()
      return literal ? [{ literal }] : []
    }
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    const author: Author = {}
    setOptionalString(author, 'family', raw.family)
    setOptionalString(author, 'given', raw.given)
    setOptionalString(author, 'literal', raw.literal)
    if (typeof raw.isWestern === 'boolean') author.isWestern = raw.isWestern
    return author.family || author.given || author.literal ? [author] : []
  })
}

function normalizeConfidence(value: unknown): ConfidenceMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const confidence: ConfidenceMap = {}
  const raw = value as Record<string, unknown>
  for (const field of FIELD_NAMES) {
    const numberValue = typeof raw[field] === 'number'
      ? raw[field]
      : typeof raw[field] === 'string'
        ? Number(raw[field])
        : NaN
    if (Number.isFinite(numberValue)) confidence[field] = Math.max(0, Math.min(1, numberValue))
  }
  return confidence
}

function setOptionalString<T extends object, K extends keyof T>(target: T, key: K, value: unknown): void {
  const normalized = normalizeString(value)
  if (normalized !== undefined) {
    target[key] = normalized as T[K]
  }
}

// 兼容 markdown 代码块包裹的 JSON 返回
function extractJson(content: string): Record<string, unknown> {
  let s = content.trim()
  if (s.startsWith('```')) {
    s = s
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()
  }
  try {
    return JSON.parse(s)
  } catch {
    // 容错：模型偶尔会在前后加一句解释。提取首个 { 到末尾 } 之间的子串
    const first = s.indexOf('{')
    const last = s.lastIndexOf('}')
    if (first >= 0 && last > first) {
      return JSON.parse(s.slice(first, last + 1))
    }
    throw new Error('LLM 返回不是合法 JSON: ' + s.slice(0, 120))
  }
}
