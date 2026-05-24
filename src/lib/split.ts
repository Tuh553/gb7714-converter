// 启发式切分：尝试按编号前缀 → 行内 token → 空行 → 单行 的优先级切分原始文本

const NUMBERED_PREFIX = /^\s*(\[\d+\]|\(\d+\)|（\d+）|【\d+】|\d+[.、\)）])\s+/

// 行内编号 token（仅识别明确带括号/方括号的形式，避免误伤"vol. 1"等）
// 用 lookbehind/lookahead 不消耗边界空白，防止连续 token 被跳过
const INLINE_NUMBERED = /(?<=^|\s)(\[\d+\]|\(\d+\)|（\d+）|【\d+】)(?=\s)/g

export type SplitStrategy = 'numbered' | 'inline-numbered' | 'blankline' | 'newline' | 'single' | 'empty'

export interface SplitResult {
  segments: string[]
  strategy: SplitStrategy
}

export function splitReferences(input: string): SplitResult {
  const text = input.replace(/\r\n/g, '\n').trim()
  if (!text) return { segments: [], strategy: 'empty' }

  const lines = text.split('\n')
  const numberedIndices: number[] = []
  lines.forEach((line, i) => {
    if (NUMBERED_PREFIX.test(line)) numberedIndices.push(i)
  })

  // 优先：行首编号前缀（至少 2 处）
  if (numberedIndices.length >= 2) {
    const segments: string[] = []
    for (let i = 0; i < numberedIndices.length; i++) {
      const start = numberedIndices[i]
      const end = i + 1 < numberedIndices.length ? numberedIndices[i + 1] : lines.length
      const chunk = lines.slice(start, end).join('\n')
      const seg = chunk.replace(NUMBERED_PREFIX, '').replace(/\s+/g, ' ').trim()
      if (seg) segments.push(seg)
    }
    return { segments, strategy: 'numbered' }
  }

  // 次优：行内编号 token（同一行混排多条 [1]...[2]...）
  const inline = splitByInlineNumbered(text)
  if (inline && inline.length >= 2) {
    return { segments: inline, strategy: 'inline-numbered' }
  }

  // 再次：空行分隔
  const blankSeparated = text
    .split(/\n\s*\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (blankSeparated.length >= 2) {
    return { segments: blankSeparated, strategy: 'blankline' }
  }

  // 兜底：按单行切，但只在确有多行时
  if (lines.length >= 2) {
    const single = lines.map((s) => s.trim()).filter(Boolean)
    if (single.length >= 2) return { segments: single, strategy: 'newline' }
  }

  return { segments: [text.replace(/\s+/g, ' ')], strategy: 'single' }
}

// 找出文本中所有形如 [N] (N) （N） 【N】 的编号 token，并按 token 起始位置切分。
// 只有当 token 序列形成严格递增（如 1,2,3 或 2,3,4）时才采用，避免把正文里偶尔出现的 [1] 引用当作切分点。
function splitByInlineNumbered(text: string): string[] | null {
  const matches: { start: number; tokenEnd: number; num: number }[] = []
  INLINE_NUMBERED.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = INLINE_NUMBERED.exec(text)) !== null) {
    const token = m[1]
    const numMatch = token.match(/\d+/)
    if (!numMatch) continue
    matches.push({
      start: m.index,
      tokenEnd: m.index + token.length,
      num: Number(numMatch[0]),
    })
  }
  if (matches.length < 2) return null

  // 校验编号是否严格递增（避免把正文偶发的 [1] 引用当切分点）
  for (let i = 1; i < matches.length; i++) {
    if (matches[i].num <= matches[i - 1].num) return null
  }

  const segments: string[] = []
  for (let i = 0; i < matches.length; i++) {
    const segStart = matches[i].tokenEnd
    const segEnd = i + 1 < matches.length ? matches[i + 1].start : text.length
    const seg = text.slice(segStart, segEnd).replace(/\s+/g, ' ').trim()
    if (seg) segments.push(seg)
  }
  // 首个 token 之前的内容（标题、引言等）丢弃
  return segments
}

// 把两段合并为一段（UI 中相邻条目合并）
export function mergeSegments(segments: string[], indexA: number, indexB: number): string[] {
  if (indexA < 0 || indexB < 0 || indexA >= segments.length || indexB >= segments.length) {
    return segments
  }
  const [lo, hi] = indexA < indexB ? [indexA, indexB] : [indexB, indexA]
  const merged = [
    segments[lo].trim() + ' ' + segments[hi].trim(),
  ]
    .map((s) => s.replace(/\s+/g, ' ').trim())
  return [...segments.slice(0, lo), ...merged, ...segments.slice(lo + 1, hi), ...segments.slice(hi + 1)]
}

// 把指定位置的段以分隔点拆为两段（UI 中手动拆分使用，splitAt 为字符位置）
export function splitSegmentAt(segments: string[], index: number, splitAt: number): string[] {
  if (index < 0 || index >= segments.length) return segments
  const s = segments[index]
  if (splitAt <= 0 || splitAt >= s.length) return segments
  const left = s.slice(0, splitAt).trim()
  const right = s.slice(splitAt).trim()
  if (!left || !right) return segments
  return [...segments.slice(0, index), left, right, ...segments.slice(index + 1)]
}
