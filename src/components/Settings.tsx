import * as React from 'react'
import {
  Settings as SettingsIcon,
  X,
  RefreshCw,
  Plug,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react'
import { useSettingsStore } from '@/store'
import { listModels, testConnection, type LLMConfig } from '@/lib/llm/parse'
import { Button, Input, Label } from './ui/primitives'

const POPULAR_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4.1-mini',
  'deepseek-chat',
  'qwen-plus',
  'glm-4-flash',
  'moonshot-v1-8k',
]

type AsyncState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; msg: string }
  | { kind: 'err'; msg: string }

function describeError(err: unknown): string {
  const e = err as { status?: number; message?: string }
  if (e?.status) return `HTTP ${e.status}: ${e.message ?? '请求失败'}`
  return e?.message ?? String(err)
}

function isDirty(a: LLMConfig, b: LLMConfig, ac: number, bc: number): boolean {
  return (
    a.apiKey !== b.apiKey ||
    (a.baseURL ?? '') !== (b.baseURL ?? '') ||
    a.model !== b.model ||
    ac !== bc
  )
}

export function SettingsPanel() {
  const [open, setOpen] = React.useState(false)
  const { config, concurrency, setConfig, setConcurrency } = useSettingsStore()

  // 本地草稿：编辑只改 draft，点"保存"才写回 store / localStorage
  const [draft, setDraft] = React.useState<LLMConfig>(config)
  const [draftConcurrency, setDraftConcurrency] = React.useState(concurrency)

  const [testState, setTestState] = React.useState<AsyncState>({ kind: 'idle' })
  const [modelState, setModelState] = React.useState<AsyncState>({ kind: 'idle' })
  const [fetchedModels, setFetchedModels] = React.useState<string[]>([])
  const [modelListOpen, setModelListOpen] = React.useState(false)
  const [modelFilter, setModelFilter] = React.useState('')
  const [justSaved, setJustSaved] = React.useState(false)

  const missing = !config.apiKey
  const dirty = isDirty(draft, config, draftConcurrency, concurrency)

  // 打开弹窗时把当前已保存配置同步到 draft；关闭时清空瞬态
  React.useEffect(() => {
    if (open) {
      setDraft(config)
      setDraftConcurrency(concurrency)
      setTestState({ kind: 'idle' })
      setModelState({ kind: 'idle' })
      setJustSaved(false)
    } else {
      setModelListOpen(false)
      setModelFilter('')
    }
    // 只在 open 变化时重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const patchDraft = (p: Partial<LLMConfig>) => setDraft((d) => ({ ...d, ...p }))

  const handleSave = () => {
    setConfig(draft)
    setConcurrency(draftConcurrency)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1200)
  }

  const handleCancel = () => {
    setDraft(config)
    setDraftConcurrency(concurrency)
  }

  const handleClose = () => {
    if (dirty) {
      const ok = window.confirm('有未保存的改动，确认丢弃？')
      if (!ok) return
    }
    setOpen(false)
  }

  // 测试连通 / 拉取模型都用 draft 当前内容（未保存也能试）
  const handleTest = async () => {
    setTestState({ kind: 'loading' })
    try {
      const { modelCount } = await testConnection(draft)
      setTestState({ kind: 'ok', msg: `连通正常，可用模型 ${modelCount} 个` })
    } catch (err) {
      setTestState({ kind: 'err', msg: describeError(err) })
    }
  }

  const handleFetchModels = async () => {
    setModelState({ kind: 'loading' })
    try {
      const ids = await listModels(draft)
      setFetchedModels(ids)
      setModelListOpen(true)
      setModelState({ kind: 'ok', msg: `已拉取 ${ids.length} 个模型，点击列表项选择` })
    } catch (err) {
      setModelState({ kind: 'err', msg: describeError(err) })
    }
  }

  const visibleModels = React.useMemo(() => {
    const all = fetchedModels.length > 0 ? fetchedModels : POPULAR_MODELS
    const q = modelFilter.trim().toLowerCase()
    if (!q) return all
    return all.filter((m) => m.toLowerCase().includes(q))
  }, [fetchedModels, modelFilter])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={missing ? 'border-amber-400 text-amber-700' : ''}
      >
        <SettingsIcon className="h-3.5 w-3.5" />
        {missing ? '配置 API' : '设置'}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={handleClose}>
          <div
            className="absolute right-4 top-16 w-[30rem] max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">
                LLM 设置
                {dirty && (
                  <span className="ml-2 text-[11px] font-normal text-amber-600">
                    · 未保存
                  </span>
                )}
              </h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={draft.apiKey}
                  onChange={(e) => patchDraft({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  仅保存在本地浏览器 (localStorage), 不会发送到任何服务器
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Base URL（留空 = OpenAI 官方）</Label>
                <Input
                  type="text"
                  value={draft.baseURL ?? ''}
                  onChange={(e) => patchDraft({ baseURL: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                />
                <p className="text-[11px] text-muted-foreground">
                  兼容 OpenAI 接口的任意服务（DeepSeek / 智谱 / 通义 / Moonshot / OpenRouter 等）
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>模型</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFetchModels}
                      disabled={!draft.apiKey || modelState.kind === 'loading'}
                      title="向 Base URL 拉取 /v1/models"
                    >
                      {modelState.kind === 'loading' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      拉取列表
                    </Button>
                    {(fetchedModels.length > 0 || POPULAR_MODELS.length > 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModelListOpen((v) => !v)}
                      >
                        {modelListOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        {modelListOpen ? '收起' : '展开'}
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  type="text"
                  value={draft.model}
                  onChange={(e) => patchDraft({ model: e.target.value })}
                  placeholder="如 gpt-4o-mini"
                />

                {modelListOpen && (
                  <div className="rounded-md border border-border bg-muted/30">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
                      <Search className="h-3 w-3 text-muted-foreground flex-none" />
                      <input
                        type="text"
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        placeholder="搜索模型 id…"
                        className="flex-1 bg-transparent text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {visibleModels.length}/
                        {fetchedModels.length || POPULAR_MODELS.length}
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto py-1">
                      {visibleModels.length === 0 ? (
                        <p className="px-2 py-2 text-[11px] text-muted-foreground">
                          无匹配项
                        </p>
                      ) : (
                        visibleModels.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              patchDraft({ model: m })
                              setModelListOpen(false)
                            }}
                            className={`block w-full text-left px-2 py-1 text-xs font-mono hover:bg-muted transition ${
                              draft.model === m ? 'bg-primary/10 text-primary' : ''
                            }`}
                          >
                            {m}
                          </button>
                        ))
                      )}
                    </div>
                    {fetchedModels.length === 0 && (
                      <p className="px-2 py-1 text-[10px] text-muted-foreground border-t border-border">
                        以上为常用模型样例，点"拉取列表"获取你账号实际可用的模型
                      </p>
                    )}
                  </div>
                )}

                <StateLine state={modelState} />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={!draft.apiKey || testState.kind === 'loading'}
                >
                  {testState.kind === 'loading' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plug className="h-3.5 w-3.5" />
                  )}
                  测试连通
                </Button>
                <StateLine state={testState} />
              </div>

              <div className="space-y-1.5">
                <Label>并发数：{draftConcurrency}</Label>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={draftConcurrency}
                  onChange={(e) => setDraftConcurrency(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-[11px] text-muted-foreground">
                  同时并发的 LLM 请求数。受供应商 RPM 限制，建议 4–8
                </p>
              </div>

              <div className="pt-3 flex items-center gap-2 border-t border-border">
                <Button onClick={handleSave} disabled={!dirty && !justSaved}>
                  {justSaved ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      已保存
                    </>
                  ) : (
                    <>保存</>
                  )}
                </Button>
                <Button onClick={handleCancel} variant="outline" disabled={!dirty}>
                  撤销改动
                </Button>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {dirty ? '改动尚未生效' : '已保存到本地'}
                </span>
              </div>

              <div className="pt-1 text-[11px] text-muted-foreground">
                <p>
                  数据流向：粘贴的文本会发送到 base URL 指定的 LLM 服务。
                  请避免粘贴含敏感信息的文本。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function StateLine({ state }: { state: AsyncState }) {
  if (state.kind === 'idle') return null
  if (state.kind === 'loading') {
    return <p className="text-[11px] text-muted-foreground">请求中…</p>
  }
  if (state.kind === 'ok') {
    return (
      <p className="text-[11px] text-emerald-700 flex items-center gap-1">
        <Check className="h-3 w-3" />
        {state.msg}
      </p>
    )
  }
  return (
    <p className="text-[11px] text-red-600 flex items-start gap-1 break-all">
      <AlertCircle className="h-3 w-3 mt-0.5 flex-none" />
      <span>{state.msg}</span>
    </p>
  )
}
