import { Play, Square, Trash2, Scissors } from 'lucide-react'
import { useWorkStore, useSettingsStore } from '@/store'
import { Textarea, Button, Badge } from './ui/primitives'

const STRATEGY_LABELS: Record<string, string> = {
  numbered: '按编号前缀',
  'inline-numbered': '按行内 [N] 编号',
  blankline: '按空行',
  newline: '按单行',
  single: '整体单条',
  empty: '空',
}

export function InputPanel() {
  const input = useWorkStore((s) => s.input)
  const items = useWorkStore((s) => s.items)
  const splitStrategy = useWorkStore((s) => s.splitStrategy)
  const isRunning = useWorkStore((s) => s.isRunning)
  const setInput = useWorkStore((s) => s.setInput)
  const computeSplits = useWorkStore((s) => s.computeSplits)
  const startParseAll = useWorkStore((s) => s.startParseAll)
  const abortAll = useWorkStore((s) => s.abortAll)
  const clearAll = useWorkStore((s) => s.clearAll)
  const apiKey = useSettingsStore((s) => s.config.apiKey)

  const handleParse = () => {
    startParseAll().catch((err: Error) => alert(err.message))
  }

  const pendingCount = items.filter((x) => x.status === 'pending' || x.status === 'error').length

  return (
    <div className="space-y-3">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={
          '在此粘贴参考文献文本，支持 [1] / 1. / 空行 等分隔形式。\n\n例如:\n[1] 袁训来, 陈哲, 肖书海, 等. 蓝田生物群——一个认识多细胞生物早期辐射的新窗口. 科学通报, 2012, 57(34): 3219.\n[2] Frank D B, Ray B B. Quantum-clock and quantum-spin transitions. Phys Rev Lett, 2018, 121(4): 044403.'
        }
        rows={10}
        className="font-mono text-xs leading-relaxed"
        disabled={isRunning}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Button
          onClick={computeSplits}
          disabled={!input.trim() || isRunning}
          variant="outline"
        >
          <Scissors className="h-3.5 w-3.5" />
          切分预览
        </Button>

        {isRunning ? (
          <Button onClick={abortAll} variant="destructive">
            <Square className="h-3.5 w-3.5" />
            中止
          </Button>
        ) : (
          <Button
            onClick={handleParse}
            disabled={pendingCount === 0 || !apiKey}
          >
            <Play className="h-3.5 w-3.5" />
            开始解析{pendingCount > 0 && ` (${pendingCount})`}
          </Button>
        )}

        <Button
          onClick={clearAll}
          variant="ghost"
          size="sm"
          disabled={isRunning || items.length === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
          清空
        </Button>

        {items.length > 0 && splitStrategy !== 'empty' && (
          <Badge variant="info">
            共 {items.length} 条（{STRATEGY_LABELS[splitStrategy] ?? splitStrategy}）
          </Badge>
        )}

        {!apiKey && (
          <Badge variant="warning">需要先在右上角设置 API key</Badge>
        )}
      </div>
    </div>
  )
}
