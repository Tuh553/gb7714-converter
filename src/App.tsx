import * as React from 'react'
import { Copy, FileText, BookOpen, Check, ArrowDown, ArrowUp } from 'lucide-react'
import { useWorkStore } from '@/store'
import { SettingsPanel } from './components/Settings'
import { InputPanel } from './components/InputPanel'
import { ItemCard } from './components/ItemCard'
import { Button, Badge } from './components/ui/primitives'
import { formatReference } from './lib/gb7714/format'
import { applyReviewFilter, sortReviewItems } from './lib/review'
import type { ReviewFilter, ReviewSortMode } from './lib/gb7714/types'

const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  all: '全部',
  issue: '有问题',
  error: '错误',
  warning: '警告',
  missing: '缺字段',
  failed: '失败',
  edited: '已修改',
}

const REVIEW_SORT_LABELS: Record<ReviewSortMode, string> = {
  original: '原始顺序',
  'issue-count': '问题最多优先',
  'recently-edited': '最近修改优先',
}

export default function App() {
  const items = useWorkStore((s) => s.items)
  const reviewFilter = useWorkStore((s) => s.reviewFilter)
  const sortMode = useWorkStore((s) => s.sortMode)
  const activeReviewId = useWorkStore((s) => s.activeReviewId)
  const setReviewFilter = useWorkStore((s) => s.setReviewFilter)
  const setSortMode = useWorkStore((s) => s.setSortMode)
  const setActiveReviewId = useWorkStore((s) => s.setActiveReviewId)
  const [allCopied, setAllCopied] = React.useState(false)

  const doneItems = items.filter((x) => x.status === 'done' && x.ref)
  const problemItems = applyReviewFilter(items, 'issue')
  const visibleItems = sortReviewItems(applyReviewFilter(items, reviewFilter), sortMode)
  const stats = {
    total: items.length,
    done: doneItems.length,
    parsing: items.filter((x) => x.status === 'parsing').length,
    error: items.filter((x) => x.status === 'error').length,
    needReview: problemItems.length,
    missing: applyReviewFilter(items, 'missing').length,
    edited: applyReviewFilter(items, 'edited').length,
  }

  const copyAll = async () => {
    if (doneItems.length === 0) return
    const lines = doneItems.map((it, i) => `[${i + 1}] ${formatReference(it.ref!)}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 1500)
  }

  const jumpReviewItem = (direction: -1 | 1) => {
    const candidates = sortReviewItems(
      applyReviewFilter(items, reviewFilter === 'all' ? 'issue' : reviewFilter),
      sortMode,
    )
    if (candidates.length === 0) return
    const currentIndex = candidates.findIndex((item) => item.id === activeReviewId)
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + candidates.length) % candidates.length
    const next = candidates[nextIndex]
    setActiveReviewId(next.id)
    document.getElementById(`item-${next.id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
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
                  <Badge variant="warning">{stats.needReview} 条待复核</Badge>
                )}
              </div>
              <Button onClick={copyAll} disabled={doneItems.length === 0} size="sm">
                {allCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {allCopied ? '已复制全部' : `复制全部 (${doneItems.length})`}
              </Button>
            </div>

            <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'issue', 'failed', 'missing', 'edited'] as ReviewFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setReviewFilter(filter)}
                    className={`rounded-md px-2.5 py-1 text-xs border transition ${
                      reviewFilter === filter
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {REVIEW_FILTER_LABELS[filter]}
                    {filter === 'issue' && stats.needReview > 0 ? ` ${stats.needReview}` : ''}
                    {filter === 'missing' && stats.missing > 0 ? ` ${stats.missing}` : ''}
                    {filter === 'edited' && stats.edited > 0 ? ` ${stats.edited}` : ''}
                    {filter === 'failed' && stats.error > 0 ? ` ${stats.error}` : ''}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as ReviewSortMode)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  {Object.entries(REVIEW_SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => jumpReviewItem(-1)}
                  disabled={problemItems.length === 0}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  上一条问题
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => jumpReviewItem(1)}
                  disabled={problemItems.length === 0}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  下一条问题
                </Button>
                {activeReviewId && (
                  <span className="text-xs text-muted-foreground">
                    当前定位：[{items.findIndex((item) => item.id === activeReviewId) + 1}]
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {visibleItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  index={items.findIndex((source) => source.id === item.id)}
                  active={item.id === activeReviewId}
                />
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
