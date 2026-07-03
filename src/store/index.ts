// Zustand 状态管理
//   - useSettingsStore: API 配置, 持久化到 localStorage
//   - useWorkStore: 当前工作会话 (闭页即失)

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ConfidenceMap,
  FieldName,
  ParsedItem,
  Reference,
  ReviewFilter,
  ReviewSortMode,
} from '../lib/gb7714/types'
import { splitReferences, type SplitStrategy } from '../lib/split'
import { parseReference, type LLMConfig } from '../lib/llm/parse'
import { extractIdentifiers, mergeReference } from '../lib/doi'
import {
  boostEnrichedConfidence,
  emptyEnrichment,
  enrichByIdentifiers,
  enrichmentNote,
  failedEnrichment,
} from '../lib/enrich'
import { validateReference } from '../lib/validation'

interface SettingsState {
  config: LLMConfig
  concurrency: number
  setConfig: (patch: Partial<LLMConfig>) => void
  setConcurrency: (n: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      config: { apiKey: '', baseURL: '', model: 'gpt-4o-mini' },
      concurrency: 4,
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      setConcurrency: (n) => set({ concurrency: Math.max(1, Math.min(16, n)) }),
    }),
    {
      name: 'gb7714-settings',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

interface WorkState {
  input: string
  splitStrategy: SplitStrategy
  items: ParsedItem[]
  isRunning: boolean
  abortController: AbortController | null
  reviewFilter: ReviewFilter
  sortMode: ReviewSortMode
  activeReviewId: string | null

  setInput: (s: string) => void
  computeSplits: () => void
  updateSegmentText: (id: string, text: string) => void
  mergeWithPrev: (id: string) => void
  deleteSegment: (id: string) => void
  startParseAll: () => Promise<void>
  abortAll: () => void
  retryItem: (id: string) => Promise<void>
  updateField: (id: string, field: FieldName, value: unknown) => void
  bumpConfidence: (id: string, field: FieldName) => void
  setReviewFilter: (filter: ReviewFilter) => void
  setSortMode: (mode: ReviewSortMode) => void
  setActiveReviewId: (id: string | null) => void
  setReviewed: (id: string, reviewed: boolean) => void
  clearAll: () => void
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function patchItems(
  items: ParsedItem[],
  id: string,
  patch: Partial<ParsedItem>,
): ParsedItem[] {
  return items.map((x) => (x.id === id ? { ...x, ...patch } : x))
}

function llmSources(ref: Reference): ParsedItem['sources'] {
  const sources: ParsedItem['sources'] = {}
  for (const [key, value] of Object.entries(ref) as Array<[FieldName, Reference[FieldName]]>) {
    if (value === undefined) continue
    if (Array.isArray(value) && value.length === 0) continue
    sources[key] = 'llm'
  }
  return sources
}

async function processParsedItem(
  cfg: LLMConfig,
  raw: string,
  signal?: AbortSignal,
): Promise<Pick<ParsedItem, 'ref' | 'confidence' | 'notes' | 'issues' | 'sources' | 'identifier' | 'reviewed'>> {
  const identifier = extractIdentifiers(raw)

  // 元数据补全与 LLM 解析相互独立，并行执行降低单条延迟
  const [enrichSettled, parseSettled] = await Promise.allSettled([
    identifier.doi ? enrichByIdentifiers(identifier, signal) : Promise.resolve(emptyEnrichment()),
    parseReference(cfg, raw, signal),
  ])

  if (signal?.aborted) {
    const error = new Error('已中止')
    error.name = 'AbortError'
    throw error
  }
  if (parseSettled.status === 'rejected') throw parseSettled.reason
  const result = parseSettled.value
  // enrichByIdentifiers 仅在中止时 reject；防御性兜底为「拉取失败」
  const enrichment = enrichSettled.status === 'fulfilled' ? enrichSettled.value : failedEnrichment()

  const merged = mergeReference(result.ref, enrichment.ref)
  const confidence = boostEnrichedConfidence(result.confidence, merged.sources, enrichment.verifiedFields)
  const issues = [...merged.warnings, ...enrichment.issues, ...validateReference(merged.ref)]
  const notes = [result.notes, enrichmentNote(enrichment)].filter(Boolean).join('；') || undefined

  return {
    ref: merged.ref,
    confidence,
    notes,
    issues,
    sources: Object.keys(merged.sources).length > 0 ? merged.sources : llmSources(result.ref),
    identifier,
    reviewed: false,
  }
}

export const useWorkStore = create<WorkState>((set, get) => ({
  input: '',
  splitStrategy: 'empty',
  items: [],
  isRunning: false,
  abortController: null,
  reviewFilter: 'all',
  sortMode: 'original',
  activeReviewId: null,

  setInput: (s) => set({ input: s }),

  computeSplits: () => {
    const { input } = get()
    const r = splitReferences(input)
    const items: ParsedItem[] = r.segments.map((seg) => ({
      id: newId(),
      raw: seg,
      status: 'pending',
    }))
    set({ splitStrategy: r.strategy, items })
  },

  updateSegmentText: (id, text) => {
    set((s) => ({
      items: patchItems(s.items, id, {
        raw: text,
        status: 'pending',
        ref: undefined,
        confidence: undefined,
        error: undefined,
        issues: undefined,
        sources: undefined,
        identifier: undefined,
        editedFields: undefined,
        lastEditedAt: undefined,
        reviewed: false,
      }),
    }))
  },

  mergeWithPrev: (id) => {
    const items = get().items
    const i = items.findIndex((x) => x.id === id)
    if (i <= 0) return
    const prev = items[i - 1]
    const curr = items[i]
    const merged: ParsedItem = {
      id: prev.id,
      raw: (prev.raw + ' ' + curr.raw).replace(/\s+/g, ' ').trim(),
      status: 'pending',
    }
    const next = [...items.slice(0, i - 1), merged, ...items.slice(i + 1)]
    set({ items: next })
  },

  deleteSegment: (id) => {
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
  },

  startParseAll: async () => {
    const cfg = useSettingsStore.getState().config
    const concurrency = useSettingsStore.getState().concurrency

    if (!cfg.apiKey) {
      throw new Error('请先在设置中填入 API key')
    }

    const controller = new AbortController()
    set({ isRunning: true, abortController: controller })

    const queue = get()
      .items.filter((it) => it.status === 'pending' || it.status === 'error')
      .map((it) => it.id)

    const runOne = async (id: string) => {
      const item = get().items.find((x) => x.id === id)
      if (!item) return
      set((s) => ({
        items: patchItems(s.items, id, { status: 'parsing', error: undefined }),
      }))
      try {
        const result = await processParsedItem(cfg, item.raw, controller.signal)
        set((s) => ({
          items: patchItems(s.items, id, {
            status: 'done',
            ref: result.ref,
            confidence: result.confidence,
            notes: result.notes,
            issues: result.issues,
            sources: result.sources,
            identifier: result.identifier,
            reviewed: result.reviewed,
          }),
        }))
      } catch (err) {
        const e = err as Error
        if (e.name === 'AbortError' || controller.signal.aborted) {
          set((s) => ({
            items: patchItems(s.items, id, { status: 'pending' }),
          }))
          return
        }
        set((s) => ({
          items: patchItems(s.items, id, {
            status: 'error',
            error: e.message ?? '解析失败',
          }),
        }))
      }
    }

    const worker = async () => {
      while (queue.length > 0 && !controller.signal.aborted) {
        const id = queue.shift()
        if (!id) return
        await runOne(id)
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()),
      )
    } finally {
      set({ isRunning: false, abortController: null })
    }
  },

  abortAll: () => {
    const ctrl = get().abortController
    if (ctrl) ctrl.abort()
    set({ isRunning: false, abortController: null })
  },

  retryItem: async (id) => {
    const item = get().items.find((x) => x.id === id)
    if (!item) return
    const cfg = useSettingsStore.getState().config
    if (!cfg.apiKey) throw new Error('请先在设置中填入 API key')

    set((s) => ({
      items: patchItems(s.items, id, { status: 'parsing', error: undefined }),
    }))
    try {
      const result = await processParsedItem(cfg, item.raw)
      set((s) => ({
        items: patchItems(s.items, id, {
          status: 'done',
          ref: result.ref,
          confidence: result.confidence,
          notes: result.notes,
          issues: result.issues,
          sources: result.sources,
          identifier: result.identifier,
          reviewed: result.reviewed,
        }),
      }))
    } catch (err) {
      set((s) => ({
        items: patchItems(s.items, id, {
          status: 'error',
          error: (err as Error).message ?? '解析失败',
        }),
      }))
    }
  },

  updateField: (id, field, value) => {
    set((s) => ({
      items: s.items.map((x) => {
        if (x.id !== id || !x.ref) return x
        const nextRef = { ...x.ref, [field]: value } as Reference
        const nextConf: ConfidenceMap = { ...(x.confidence ?? {}), [field]: 1 }
        const editedFields = Array.from(new Set([...(x.editedFields ?? []), field]))
        const nextSources = { ...(x.sources ?? llmSources(x.ref)), [field]: 'user' as const }
        return {
          ...x,
          ref: nextRef,
          confidence: nextConf,
          issues: validateReference(nextRef),
          sources: nextSources,
          editedFields,
          lastEditedAt: Date.now(),
          reviewed: false,
        }
      }),
    }))
  },

  bumpConfidence: (id, field) => {
    set((s) => ({
      items: s.items.map((x) => {
        if (x.id !== id) return x
        const nextConf: ConfidenceMap = { ...(x.confidence ?? {}), [field]: 1 }
        return { ...x, confidence: nextConf }
      }),
    }))
  },

  setReviewFilter: (reviewFilter) => set({ reviewFilter }),
  setSortMode: (sortMode) => set({ sortMode }),
  setActiveReviewId: (activeReviewId) => set({ activeReviewId }),
  setReviewed: (id, reviewed) =>
    set((s) => ({
      items: patchItems(s.items, id, { reviewed }),
    })),

  clearAll: () =>
    set({
      input: '',
      splitStrategy: 'empty',
      items: [],
      reviewFilter: 'all',
      sortMode: 'original',
      activeReviewId: null,
    }),
}))
