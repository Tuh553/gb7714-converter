// GB/T 7714-2015 顺序编码制 - 类型定义

// 支持的文献类型（v1 仅 8 种最常用）
export type DocumentType = 'J' | 'M' | 'C' | 'D' | 'R' | 'J/OL' | 'M/OL' | 'EB/OL'

export const DOCUMENT_TYPES: DocumentType[] = ['J', 'M', 'C', 'D', 'R', 'J/OL', 'M/OL', 'EB/OL']

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  J: '期刊',
  M: '专著',
  C: '论文集 / 会议录',
  D: '学位论文',
  R: '报告',
  'J/OL': '网络期刊',
  'M/OL': '网络专著',
  'EB/OL': '电子文献',
}

// 文献语言（决定 "等" vs "et al"）
export type Language = 'zh' | 'en'

// 作者
//   - 中文姓名: family="袁", given="训来" → "袁训来"
//   - 西文姓名: family="Smith", given="John K", isWestern=true → "SMITH J K"
//   - 机构作者或无法拆分时用 literal
export interface Author {
  family?: string
  given?: string
  literal?: string
  isWestern?: boolean
}

export interface Reference {
  type: DocumentType
  language: Language

  authors: Author[]
  // true 时强制追加 "等" / "et al"（处理原文有 "等" 但只能解析出少量作者的情况）
  etAl?: boolean

  title: string
  subtitle?: string

  // [J] / [J/OL] 期刊
  journal?: string
  year?: string
  volume?: string
  issue?: string
  pages?: string
  doi?: string

  // [M] / [M/OL] 专著
  edition?: string // 已含 "版" 字样, 例如 "4版" 或 "2nd ed"
  publisher?: string
  publisherPlace?: string
  otherResponsibles?: string // 其他责任者: "陈生铮, 译" 等

  // [C] 论文集
  bookTitle?: string
  bookEditors?: string

  // [D] 学位论文
  institutionPlace?: string
  institution?: string

  // [R] 报告
  reportNumber?: string

  // [J/OL] [M/OL] [EB/OL] 网络资源
  publishDate?: string // YYYY-MM-DD 或 YYYY-MM
  accessDate?: string
  url?: string
}

export type FieldName = keyof Reference
export type ConfidenceMap = Partial<Record<FieldName, number>>

// 单条解析结果在 UI 中的运行时状态
export type ItemStatus = 'pending' | 'parsing' | 'done' | 'error'

export interface ParsedItem {
  id: string
  raw: string
  status: ItemStatus
  ref?: Reference
  confidence?: ConfidenceMap
  notes?: string
  error?: string
}
