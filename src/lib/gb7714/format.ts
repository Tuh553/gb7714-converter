// GB/T 7714-2015 顺序编码制格式化器
// 输入: 结构化 Reference → 输出: GB 引文字符串
// 标点统一使用半角英文符号

import type { Author, Reference, Language } from './types'

function formatAuthor(a: Author): string {
  if (a.literal) return a.literal
  const fam = (a.family ?? '').trim()
  const giv = (a.given ?? '').trim()

  if (a.isWestern) {
    // SMITH J K  (姓全大写，名取首字母无点，空格分隔)
    const surname = fam.toUpperCase()
    const initials = giv
      .split(/[\s\-.]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase())
      .join(' ')
    return [surname, initials].filter(Boolean).join(' ')
  }
  // 中文姓名连写 (袁训来); 中译外国人姓名加空格 (昂温 G, 库恩 T S)
  if (giv && /^[A-Za-z\s.]+$/.test(giv)) {
    return [fam, giv].filter(Boolean).join(' ')
  }
  return (fam + giv).trim()
}

function joinAuthors(authors: Author[], language: Language, etAl?: boolean): string {
  if (authors.length === 0) return ''
  const head = authors.slice(0, 3).map(formatAuthor).filter(Boolean).join(', ')
  const showEtAl = etAl === true || authors.length > 3
  if (showEtAl) {
    return head + (language === 'en' ? ', et al' : ', 等')
  }
  return head
}

function joinTitle(title: string, subtitle?: string): string {
  return subtitle ? `${title}: ${subtitle}` : title
}

function formatVolIssue(vol?: string, issue?: string): string {
  if (vol && issue) return `${vol}(${issue})`
  if (vol) return vol
  if (issue) return `(${issue})`
  return ''
}

function appendDOI(s: string, doi?: string): string {
  if (!doi) return s
  return (s.endsWith('.') ? s : s + '.') + ' DOI: ' + doi + '.'
}

// 出版地: 出版者, 年份[: 页码]
function publisherClause(r: Reference, includePages = true): string {
  let s = ''
  if (r.publisherPlace) s = r.publisherPlace + ': '
  if (r.publisher) s += r.publisher
  if (r.year) s += (s.endsWith(': ') || s === '' ? '' : ', ') + r.year
  if (includePages && r.pages) s += ': ' + r.pages
  return s
}

export function formatReference(r: Reference): string {
  const authors = joinAuthors(r.authors, r.language, r.etAl)
  const title = joinTitle(r.title, r.subtitle)
  switch (r.type) {
    case 'J':
      return formatJournal(authors, title, r)
    case 'M':
      return formatMonograph(authors, title, r)
    case 'C':
      return formatConference(authors, title, r)
    case 'D':
      return formatDissertation(authors, title, r)
    case 'R':
      return formatReport(authors, title, r)
    case 'J/OL':
      return formatJournalOnline(authors, title, r)
    case 'M/OL':
      return formatMonographOnline(authors, title, r)
    case 'EB/OL':
      return formatElectronic(authors, title, r)
    default: {
      // 兜底：LLM 返回了未知类型时尽可能仍输出可读形式
      const t = (r.type as string) ?? '?'
      let s = ''
      if (authors) s += authors + '. '
      s += title + '[' + t + '].'
      return s.trim()
    }
  }
}

// 作者. 题名[J]. 刊名, 年, 卷(期): 页码. DOI: xxx.
function formatJournal(authors: string, title: string, r: Reference): string {
  let s = ''
  if (authors) s += authors + '. '
  s += title + '[J].'
  const meta: string[] = []
  if (r.journal) meta.push(r.journal)
  if (r.year) meta.push(r.year)
  const vi = formatVolIssue(r.volume, r.issue)
  if (vi) meta.push(vi)
  let seg = meta.join(', ')
  if (r.pages) seg += ': ' + r.pages
  if (seg) s += ' ' + seg + '.'
  return appendDOI(s.trim(), r.doi)
}

// 作者. 题名[M]. 其他责任者. 版本项. 出版地: 出版者, 年份[: 页码]. DOI: xxx.
function formatMonograph(authors: string, title: string, r: Reference): string {
  let s = ''
  if (authors) s += authors + '. '
  s += title + '[M].'
  if (r.otherResponsibles) s += ' ' + r.otherResponsibles + '.'
  if (r.edition) s += ' ' + r.edition + '.'
  const pub = publisherClause(r, true)
  if (pub) s += ' ' + pub + '.'
  return appendDOI(s.trim(), r.doi)
}

// 作者. 题名[C]//主编. 论文集名. 出版地: 出版者, 年份: 页码.
function formatConference(authors: string, title: string, r: Reference): string {
  let s = ''
  if (authors) s += authors + '. '
  s += title + '[C]//'
  if (r.bookEditors) s += r.bookEditors + '. '
  if (r.bookTitle) s += r.bookTitle + '.'
  const pub = publisherClause(r, true)
  if (pub) s += ' ' + pub + '.'
  return appendDOI(s.trim(), r.doi)
}

// 作者. 题名[D]. 保存地: 保存者, 年份.
function formatDissertation(authors: string, title: string, r: Reference): string {
  let s = ''
  if (authors) s += authors + '. '
  s += title + '[D].'
  let pub = ''
  if (r.institutionPlace) pub = r.institutionPlace + ': '
  if (r.institution) pub += r.institution
  if (r.year) pub += (pub.endsWith(': ') || pub === '' ? '' : ', ') + r.year
  if (pub) s += ' ' + pub + '.'
  return appendDOI(s.trim(), r.doi)
}

// 作者. 题名: 报告编号[R]. 出版地: 出版者, 年份.
function formatReport(authors: string, title: string, r: Reference): string {
  let s = ''
  if (authors) s += authors + '. '
  s += title
  if (r.reportNumber) s += ': ' + r.reportNumber
  s += '[R].'
  const pub = publisherClause(r, false)
  if (pub) s += ' ' + pub + '.'
  return appendDOI(s.trim(), r.doi)
}

// 作者. 题名[J/OL]. 刊名, 年, 卷(期): 页码[访问日期]. URL.
function formatJournalOnline(authors: string, title: string, r: Reference): string {
  let s = ''
  if (authors) s += authors + '. '
  s += title + '[J/OL].'
  const meta: string[] = []
  if (r.journal) meta.push(r.journal)
  if (r.year) meta.push(r.year)
  const vi = formatVolIssue(r.volume, r.issue)
  if (vi) meta.push(vi)
  let seg = meta.join(', ')
  if (r.pages) seg += ': ' + r.pages
  let segWithDate = seg
  if (r.accessDate) segWithDate += '[' + r.accessDate + ']'
  if (segWithDate) s += ' ' + segWithDate + '.'
  if (r.url) s += ' ' + r.url + '.'
  return appendDOI(s.trim(), r.doi)
}

// 作者. 题名[M/OL]. 出版地: 出版者, 年份[访问日期]. URL.
function formatMonographOnline(authors: string, title: string, r: Reference): string {
  let s = ''
  if (authors) s += authors + '. '
  s += title + '[M/OL].'
  let pub = publisherClause(r, true)
  if (r.accessDate) pub += '[' + r.accessDate + ']'
  if (pub) s += ' ' + pub + '.'
  if (r.url) s += ' ' + r.url + '.'
  return appendDOI(s.trim(), r.doi)
}

// 作者. 题名[EB/OL]. (发表日期)[访问日期]. URL.
function formatElectronic(authors: string, title: string, r: Reference): string {
  let s = ''
  if (authors) s += authors + '. '
  s += title + '[EB/OL].'
  const dates: string[] = []
  if (r.publishDate) dates.push('(' + r.publishDate + ')')
  if (r.accessDate) dates.push('[' + r.accessDate + ']')
  if (dates.length) s += ' ' + dates.join('') + '.'
  if (r.url) s += ' ' + r.url + '.'
  return s.trim()
}
