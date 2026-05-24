// LLM 提示词构造
// 输出严格 JSON, 结构匹配 Reference & ConfidenceMap

import { EXAMPLES } from './examples'

export const SYSTEM_PROMPT = `你是一个严格的参考文献结构化解析器。给你一条参考文献的原始文本（任意格式：GB 旧版、APA、MLA、中英文混合等），请输出一个严格的 JSON 对象，字段定义如下。

文档类型（type）只能取以下值之一：
- "J"     期刊
- "M"     专著 / 图书
- "C"     论文集 / 会议录中的析出文献
- "D"     学位论文
- "R"     研究报告 / 技术报告
- "J/OL"  网络期刊
- "M/OL"  网络专著
- "EB/OL" 一般电子文献 / 网页

输出 JSON 形状：
{
  "type": <DocumentType>,
  "language": "zh" | "en",   // 该条参考文献的主语言（决定 等/et al）
  "authors": [
    {"family": string, "given": string, "isWestern": boolean}
    // 中文姓名: family="袁", given="训来"
    // 中译外国人: family="昂温", given="G", isWestern=false（given 用大写字母）
    // 西文原文: family="Smith", given="John K", isWestern=true
    // 机构作者用 {"literal":"中国电力科学研究院"}
  ],
  "etAl": boolean,            // 原文出现 "等"/"et al" 但实际作者数未知时为 true
  "title": string,            // 不含 [J] 等类型标记，不含副题名
  "subtitle": string?,        // 副题名，渲染时用 "正题: 副题"
  // [J] / [J/OL] 期刊字段
  "journal": string?,
  "year": string?,
  "volume": string?,
  "issue": string?,
  "pages": string?,           // 半角连字符 "23-31"
  "doi": string?,
  // [M] / [M/OL] 专著字段
  "edition": string?,         // 已含 "版"，如 "4版"、"2nd ed"
  "publisher": string?,
  "publisherPlace": string?,
  "otherResponsibles": string?, // 其他责任者: "陈生铮, 译" 等
  // [C] 论文集字段
  "bookTitle": string?,
  "bookEditors": string?,
  // [D] 学位论文字段
  "institutionPlace": string?,
  "institution": string?,
  // [R] 报告字段
  "reportNumber": string?,
  // [J/OL] [M/OL] [EB/OL] 网络资源字段
  "publishDate": string?,     // 形如 "2001-12-19" 或 "2024-03"
  "accessDate": string?,
  "url": string?,
  // 每个非空字段的置信度（0-1），0.85 以上代表确信
  "confidence": {
    "<fieldName>": number, ...
  },
  "notes": string?            // 仅在解析有歧义或缺关键字段时简短记录
}

规则：
1. 不要在 JSON 中输出 null；缺失字段直接省略 key。
2. authors 中 isWestern 缺省为 false（中文/中译姓名）。
3. 如果原文用 "等" 或 "et al"，只列出原文实际给出的姓名，并将 etAl 设为 true。
4. title 中不要保留 "[J]" "[M]" 等文献类型标识，把它体现到 type 字段。
5. 副题名（用 ":" "——" "—" 或 ": " 分隔的）尽量拆到 subtitle。
6. pages 用半角连字符；卷期分开存到 volume / issue。
7. confidence 每个字段单独评估；模糊推断的字段给 0.5-0.7，确定的给 0.95+。
8. 输出必须是有效 JSON，不要包裹任何 markdown 代码块或解释文字。

以下是几个示例，输入是原文，输出是 JSON：
`

function buildFewShot(): string {
  return EXAMPLES.map((ex) => {
    const input = ex.raw ?? ex.expected
    const output: Record<string, unknown> = { ...(ex.ref as unknown as Record<string, unknown>) }
    output.confidence = autoConfidence(ex.ref as unknown as Record<string, unknown>)
    return `输入:\n${input}\n输出:\n${JSON.stringify(output)}\n`
  }).join('\n')
}

// 把示例 ref 对象的每个非空字段标 0.95 置信度供 few-shot
function autoConfidence(ref: Record<string, unknown>): Record<string, number> {
  const c: Record<string, number> = {}
  for (const [k, v] of Object.entries(ref)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v) && v.length === 0) continue
    c[k] = 0.95
  }
  return c
}

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT + '\n' + buildFewShot()
}

export const USER_PROMPT_PREFIX = '请解析下面这条参考文献，仅返回 JSON：\n\n'
