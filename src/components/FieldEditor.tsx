import { useWorkStore } from '@/store'
import { Button } from './ui/primitives'
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type Author,
  type FieldName,
  type ParsedItem,
} from '@/lib/gb7714/types'
const FIELD_LABELS: Partial<Record<FieldName, string>> = {
  title: '题名',
  subtitle: '副题名',
  journal: '刊名',
  year: '年份',
  volume: '卷',
  issue: '期',
  pages: '页码',
  doi: 'DOI',
  edition: '版次',
  publisher: '出版者',
  publisherPlace: '出版地',
  otherResponsibles: '其他责任者',
  bookTitle: '论文集名',
  bookEditors: '论文集主编',
  institutionPlace: '保存地',
  institution: '保存者',
  reportNumber: '报告编号',
  publishDate: '发表日期',
  accessDate: '访问日期',
  url: 'URL',
}
// 不同文献类型显示哪些字段
const FIELDS_BY_TYPE: Record<string, FieldName[]> = {
  J: ['title', 'subtitle', 'journal', 'year', 'volume', 'issue', 'pages', 'doi'],
  'J/OL': ['title', 'subtitle', 'journal', 'year', 'volume', 'issue', 'pages', 'doi', 'accessDate', 'url'],
  M: ['title', 'subtitle', 'edition', 'publisherPlace', 'publisher', 'year', 'pages', 'otherResponsibles', 'doi'],
  'M/OL': ['title', 'subtitle', 'edition', 'publisherPlace', 'publisher', 'year', 'pages', 'otherResponsibles', 'accessDate', 'url'],
  C: ['title', 'subtitle', 'bookEditors', 'bookTitle', 'publisherPlace', 'publisher', 'year', 'pages', 'doi'],
  D: ['title', 'subtitle', 'institutionPlace', 'institution', 'year'],
  R: ['title', 'subtitle', 'reportNumber', 'publisherPlace', 'publisher', 'year'],
  'EB/OL': ['title', 'subtitle', 'publishDate', 'accessDate', 'url'],
}
function cellClass(value: string, confidence: number | undefined): string {
  if (!value) return 'border-red-300 bg-red-50'
  if (confidence !== undefined && confidence < 0.6) return 'border-red-300 bg-red-50'
  if (confidence !== undefined && confidence < 0.85) return 'border-amber-300 bg-amber-50'
  return 'border-border bg-background'
}
export function FieldEditor({ item }: { item: ParsedItem }) {
  const updateField = useWorkStore((s) => s.updateField)
  if (!item.ref) return null
  const ref = item.ref
  const conf = item.confidence ?? {}
  const fields = FIELDS_BY_TYPE[ref.type] ?? []
  const renderField = (field: FieldName) => {
    const label = FIELD_LABELS[field]
    if (!label) return null
    const value = (ref[field] as string | undefined) ?? ''
    const c = conf[field]
    return (
      <div key={field}>
        <label className="text-[11px] text-muted-foreground">
          {label}
          {!value && <span className="text-red-500"> · 空</span>}
          {value && c !== undefined && c < 0.85 && (
            <span className="text-amber-600"> · 置信度 {c.toFixed(2)}</span>
          )}
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => updateField(item.id, field, e.target.value || undefined)}
          className={`w-full h-8 rounded border px-2 text-xs ${cellClass(value, c)}`}
        />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">类型</label>
          <select
            value={ref.type}
            onChange={(e) => updateField(item.id, 'type', e.target.value)}
            className="w-full h-8 rounded border border-border bg-background text-xs px-2"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                [{t}] {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">语言</label>
          <select
            value={ref.language}
            onChange={(e) => updateField(item.id, 'language', e.target.value)}
            className="w-full h-8 rounded border border-border bg-background text-xs px-2"
          >
            <option value="zh">中文（用"等"）</option>
            <option value="en">英文（用 et al）</option>
          </select>
        </div>
      </div>
      <AuthorEditor item={item} />
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => renderField(f))}
      </div>
    </div>
  )
}
function AuthorEditor({ item }: { item: ParsedItem }) {
  const updateField = useWorkStore((s) => s.updateField)
  const ref = item.ref!
  const authors = ref.authors ?? []
  const conf = item.confidence?.authors
  const setAuthor = (i: number, patch: Partial<Author>) => {
    const next = authors.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
    updateField(item.id, 'authors', next)
  }
  const addAuthor = () => updateField(item.id, 'authors', [...authors, { family: '', given: '' }])
  const removeAuthor = (i: number) =>
    updateField(
      item.id,
      'authors',
      authors.filter((_, idx) => idx !== i),
    )
  const lowConf = conf !== undefined && conf < 0.85
  return (
    <div>
      <label className="text-[11px] text-muted-foreground">
        作者
        {lowConf && <span className="text-amber-600"> · 置信度 {conf!.toFixed(2)}</span>}
        {authors.length === 0 && <span className="text-red-500"> · 空</span>}
      </label>
      <div className="space-y-1">
        {authors.map((a, i) => (
          <div key={i} className="flex gap-1 items-center">
            <input
              type="text"
              value={a.family ?? ''}
              onChange={(e) => setAuthor(i, { family: e.target.value })}
              placeholder="姓"
              className="h-7 w-20 rounded border border-border bg-background text-xs px-1.5"
            />
            <input
              type="text"
              value={a.given ?? ''}
              onChange={(e) => setAuthor(i, { given: e.target.value })}
              placeholder="名"
              className="h-7 flex-1 rounded border border-border bg-background text-xs px-1.5"
            />
            <label className="text-[11px] flex items-center gap-1 select-none">
              <input
                type="checkbox"
                checked={a.isWestern ?? false}
                onChange={(e) => setAuthor(i, { isWestern: e.target.checked })}
              />
              西文
            </label>
            <button
              onClick={() => removeAuthor(i)}
              className="h-7 w-7 rounded text-muted-foreground hover:bg-muted"
              title="删除"
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex gap-3 items-center pt-1">
          <Button size="sm" variant="outline" onClick={addAuthor}>
            + 作者
          </Button>
          <label className="text-[11px] flex items-center gap-1 select-none">
            <input
              type="checkbox"
              checked={ref.etAl ?? false}
              onChange={(e) => updateField(item.id, 'etAl', e.target.checked)}
            />
            追加 "等 / et al"
          </label>
        </div>
      </div>
    </div>
  )
}
