import type { Reference, ValidationIssue, ValidationSeverity } from './gb7714/types'

const DOI_RE = /^10\.\d{4,9}\/\S+$/i
const YEAR_RE = /^\d{4}$/
const PAGES_RE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?$/

function createIssue(
  severity: ValidationSeverity,
  code: string,
  message: string,
  field?: ValidationIssue['field'],
): ValidationIssue {
  return {
    id: `${severity}:${code}:${field ?? 'general'}`,
    severity,
    code,
    message,
    field,
  }
}

function isOnlineType(type: Reference['type']): boolean {
  return type === 'J/OL' || type === 'M/OL' || type === 'EB/OL'
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

function missingFieldIssues(ref: Reference): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const requiredByType: Partial<Record<Reference['type'], Array<keyof Reference>>> = {
    J: ['journal', 'year'],
    M: ['publisher', 'publisherPlace'],
    D: ['institution'],
    'J/OL': ['url', 'accessDate'],
    'M/OL': ['url', 'accessDate'],
    'EB/OL': ['url', 'accessDate'],
  }
  for (const field of requiredByType[ref.type] ?? []) {
    const value = ref[field]
    if (typeof value === 'string' && !hasValue(value)) {
      issues.push(createIssue('error', `missing-${issueCodeSuffix(field)}`, `缺少${fieldLabel(field)}`, field))
    } else if (value === undefined) {
      issues.push(createIssue('error', `missing-${issueCodeSuffix(field)}`, `缺少${fieldLabel(field)}`, field))
    }
  }
  if (!ref.authors.length) {
    issues.push(createIssue('error', 'missing-authors', '缺少作者', 'authors'))
  }
  return issues
}

function fieldLabel(field: keyof Reference): string {
  const labels: Partial<Record<keyof Reference, string>> = {
    journal: '刊名',
    year: '年份',
    publisher: '出版者',
    publisherPlace: '出版地',
    institution: '保存者',
    url: 'URL',
    accessDate: '访问日期',
  }
  return labels[field] ?? String(field)
}

function issueCodeSuffix(field: keyof Reference): string {
  return String(field).replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

export function validateReference(ref: Reference): ValidationIssue[] {
  const issues = missingFieldIssues(ref)

  if (ref.year && (!YEAR_RE.test(ref.year) || Number(ref.year) < 1000 || Number(ref.year) > 2100)) {
    issues.push(createIssue('warning', 'invalid-year', '年份格式异常，应为四位数字', 'year'))
  }

  if (ref.pages && !PAGES_RE.test(ref.pages)) {
    issues.push(createIssue('warning', 'invalid-pages', '页码建议使用半角连字符，如 23-31', 'pages'))
  }

  if (ref.doi && !DOI_RE.test(ref.doi.trim())) {
    issues.push(createIssue('warning', 'invalid-doi', 'DOI 格式异常', 'doi'))
  }

  if (ref.authors.length > 3 && !ref.etAl) {
    issues.push(createIssue('hint', 'missing-etal', '作者超过 3 人时建议确认是否需要“等 / et al”', 'authors'))
  }

  if (ref.url && !isOnlineType(ref.type)) {
    issues.push(createIssue('warning', 'url-on-offline-type', '存在 URL，建议确认文献类型是否应为在线资源', 'type'))
  }

  return issues
}
