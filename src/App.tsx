import * as React from 'react'
import { Copy, FileText, BookOpen, Check } from 'lucide-react'
import { useWorkStore } from '@/store'
import { SettingsPanel } from './components/Settings'
import { InputPanel } from './components/InputPanel'
import { ItemCard } from './components/ItemCard'
import { Button, Badge } from './components/ui/primitives'
import { formatReference } from './lib/gb7714/format'

export default function App() {
  const items = useWorkStore((s) => s.items)
  const [allCopied, setAllCopied] = React.useState(false)

  const doneItems = items.filter((x) => x.status === 'done' && x.ref)
  const stats = {
    total: items.length,
    done: doneItems.length,
    parsing: items.filter((x) => x.status === 'parsing').length,
    error: items.filter((x) => x.status === 'error').length,
    needReview: doneItems.filter((x) => hasLowConfidence(x.confidence)).length,
  }

  const copyAll = async () => {
    if (doneItems.length === 0) return
    const lines = doneItems.map((it, i) => `[${i + 1}] ${formatReference(it.ref!)}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 1500)
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">
              GB/T 7714-2015 参考文献批量转换
            </h1>
            <Badge variant="default" className="text-[10px]">顺序编码制</Badge>
          </div>
          <SettingsPanel />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">1. 输入原始文本</h2>
          </div>
          <InputPanel />
        </section>

        {items.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">2. 解析结果</h2>
                <Badge>共 {stats.total}</Badge>
                {stats.parsing > 0 && <Badge variant="info">解析中 {stats.parsing}</Badge>}
                {stats.done > 0 && <Badge variant="success">已完成 {stats.done}</Badge>}
                {stats.error > 0 && <Badge variant="error">失败 {stats.error}</Badge>}
                {stats.needReview > 0 && (
                  <Badge variant="warning">{stats.needReview} 条需复核</Badge>
                )}
              </div>
              <Button onClick={copyAll} disabled={doneItems.length === 0} size="sm">
                {allCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {allCopied ? '已复制全部' : `复制全部 (${doneItems.length})`}
              </Button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, i) => (
                <ItemCard key={item.id} item={item} index={i} />
              ))}
            </div>
          </section>
        )}

        <footer className="pt-8 pb-4 text-center text-[11px] text-muted-foreground">
          <p>
            纯前端 BYOK · 数据流: 浏览器 → 你配置的 LLM 服务（不经过本站）·
            <a
              href="https://www.cssn.cn/zx/wzyzlxz/202302/W020230213328881317454.pdf"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground ml-1"
            >
              GB/T 7714-2015 标准全文
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}

function hasLowConfidence(conf: Record<string, number> | undefined): boolean {
  if (!conf) return false
  return Object.values(conf).some((v) => v < 0.85)
}
