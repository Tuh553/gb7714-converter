import * as React from 'react'
import { Copy, RefreshCw, Trash2, Check, Loader2, AlertCircle, ChevronRight, ChevronDown, ArrowUpToLine } from 'lucide-react'
import { useWorkStore } from '@/store'
import { Card, Button, Badge } from './ui/primitives'
import { formatReference } from '@/lib/gb7714/format'
import type { ParsedItem } from '@/lib/gb7714/types'
import { FieldEditor } from './FieldEditor'

export function ItemCard({ item, index }: { item: ParsedItem; index: number }) {
  const [expanded, setExpanded] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const retryItem = useWorkStore((s) => s.retryItem)
  const deleteSegment = useWorkStore((s) => s.deleteSegment)
  const updateSegmentText = useWorkStore((s) => s.updateSegmentText)
  const mergeWithPrev = useWorkStore((s) => s.mergeWithPrev)

  const formatted = item.ref ? safeFormat(item.ref) : ''

  const copy = async () => {
    if (!formatted) return
    await navigator.clipboard.writeText(formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <span className="text-xs text-muted-foreground font-mono">[{index + 1}]</span>
          {item.status === 'pending' && <Badge>待解析</Badge>}
          {item.status === 'parsing' && (
            <Badge variant="info">
              <Loader2 className="h-3 w-3 animate-spin" /> 解析中
            </Badge>
          )}
          {item.status === 'done' && <Badge variant="success">已完成</Badge>}
          {item.status === 'error' && (
            <Badge variant="error">
              <AlertCircle className="h-3 w-3" /> 失败
            </Badge>
          )}
          {item.notes && (
            <span className="text-[11px] text-muted-foreground italic">{item.notes}</span>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          {item.status === 'pending' && index > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => mergeWithPrev(item.id)}
              title="与上一条合并"
            >
              <ArrowUpToLine className="h-3 w-3" />
            </Button>
          )}
          {item.status === 'done' && (
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? '已复制' : '复制'}
            </Button>
          )}
          {(item.status === 'done' || item.status === 'error') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => retryItem(item.id).catch((e: Error) => alert(e.message))}
              title="重新解析"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deleteSegment(item.id)}
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* GB 输出 */}
      {item.status === 'done' && formatted && (
        <div className="rounded-md bg-muted/60 px-3 py-2.5 text-sm leading-relaxed border border-border/50">
          {formatted}
        </div>
      )}

      {/* 错误信息 */}
      {item.status === 'error' && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {item.error ?? '解析失败'}
        </div>
      )}

      {/* 原文 + 编辑 */}
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          原文 & 字段
        </button>

        {expanded && (
          <div className="mt-1.5 space-y-2">
            {item.status === 'pending' ? (
              <textarea
                value={item.raw}
                onChange={(e) => updateSegmentText(item.id, e.target.value)}
                rows={2}
                className="w-full text-xs font-mono rounded border border-border bg-background p-2 italic"
              />
            ) : (
              <div className="text-[11px] text-muted-foreground italic break-words leading-relaxed bg-muted/30 rounded px-2 py-1.5">
                {item.raw}
              </div>
            )}
            {item.ref && <FieldEditor item={item} />}
          </div>
        )}
      </div>
    </Card>
  )
}

function safeFormat(ref: Parameters<typeof formatReference>[0]): string {
  try {
    return formatReference(ref)
  } catch {
    return ''
  }
}
