import * as React from 'react'
import { Settings as SettingsIcon, X, RefreshCw, Plug, Check, AlertCircle, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@/store'
import { listModels, testConnection } from '@/lib/llm/parse'
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

export function SettingsPanel() {
  const [open, setOpen] = React.useState(false)
  const { config, concurrency, setConfig, setConcurrency } = useSettingsStore()
  const [testState, setTestState] = React.useState<AsyncState>({ kind: 'idle' })
  const [modelState, setModelState] = React.useState<AsyncState>({ kind: 'idle' })
  const [fetchedModels, setFetchedModels] = React.useState<string[]>([])
  const missing = !config.apiKey

  // 关闭/打开弹窗时清空瞬时状态
  React.useEffect(() => {
    if (!open) {
      setTestState({ kind: 'idle' })
      setModelState({ kind: 'idle' })
    }
  }, [open])

  const handleTest = async () => {
    setTestState({ kind: 'loading' })
    try {
      const { modelCount } = await testConnection(config)
      setTestState({ kind: 'ok', msg: `连通正常，可用模型 ${modelCount} 个` })
    } catch (err) {
      setTestState({ kind: 'err', msg: describeError(err) })
    }
  }

  const handleFetchModels = async () => {
    setModelState({ kind: 'loading' })
    try {
      const ids = await listModels(config)
      setFetchedModels(ids)
      setModelState({ kind: 'ok', msg: `已拉取 ${ids.length} 个模型` })
    } catch (err) {
      setModelState({ kind: 'err', msg: describeError(err) })
    }
  }

  // 下拉建议：拉取的优先，再补充常见模型
  const suggestions = React.useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const m of [...fetchedModels, ...POPULAR_MODELS]) {
      if (!seen.has(m)) {
        seen.add(m)
        out.push(m)
      }
    }
    return out
  }, [fetchedModels])

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
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute right-4 top-16 w-[28rem] rounded-lg border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">LLM 设置</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ apiKey: e.target.value })}
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
                  value={config.baseURL ?? ''}
                  onChange={(e) => setConfig({ baseURL: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                />
                <p className="text-[11px] text-muted-foreground">
                  兼容 OpenAI 接口的任意服务（DeepSeek / 智谱 / 通义 / Moonshot / OpenRouter 等）
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>模型</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFetchModels}
                    disabled={!config.apiKey || modelState.kind === 'loading'}
                    title="向 Base URL 拉取 /v1/models"
                  >
                    {modelState.kind === 'loading' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    拉取模型列表
                  </Button>
                </div>
                <Input
                  type="text"
                  value={config.model}
                  onChange={(e) => setConfig({ model: e.target.value })}
                  list="model-suggestions"
                  placeholder="如 gpt-4o-mini"
                />
                <datalist id="model-suggestions">
                  {suggestions.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <StateLine state={modelState} />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={!config.apiKey || testState.kind === 'loading'}
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
                <Label>并发数：{concurrency}</Label>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-[11px] text-muted-foreground">
                  同时并发的 LLM 请求数。受供应商 RPM 限制，建议 4–8
                </p>
              </div>

              <div className="pt-2 text-[11px] text-muted-foreground border-t border-border">
                <p>
                  数据流向：粘贴的文本会发送到上方 base URL 指定的 LLM 服务。
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
