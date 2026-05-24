// LLM 客户端 - 单条参考文献解析
// 浏览器直接调用 OpenAI / OpenAI 兼容接口（dangerouslyAllowBrowser）

import OpenAI from 'openai'
import type { Reference, ConfidenceMap } from '../gb7714/types'
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

  const parsed = extractJson(content)
  const { confidence = {}, notes, ...refFields } = parsed
  return {
    ref: refFields as unknown as Reference,
    confidence: confidence as ConfidenceMap,
    notes: notes as string | undefined,
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
