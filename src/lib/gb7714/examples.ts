// GB/T 7714-2015 真值源
// 这些示例同时供：
//   1) 单元手测 (formatReference(example.ref) === example.expected)
//   2) LLM few-shot 提示词参考

import type { Reference } from './types'

export interface Example {
  description: string
  raw?: string // 用作 LLM 的反向示例：从这段原文应解析出 ref
  ref: Reference
  expected: string
}

export const EXAMPLES: Example[] = [
  {
    description: '中文期刊 - 多作者（>3 用 等）',
    raw: '袁训来, 陈哲, 肖书海, 等. 蓝田生物群: 一个认识多细胞生物早期辐射的新窗口[J]. 科学通报, 2012, 57(34): 3219.',
    ref: {
      type: 'J',
      language: 'zh',
      etAl: true,
      authors: [
        { family: '袁', given: '训来' },
        { family: '陈', given: '哲' },
        { family: '肖', given: '书海' },
      ],
      title: '蓝田生物群',
      subtitle: '一个认识多细胞生物早期辐射的新窗口',
      journal: '科学通报',
      year: '2012',
      volume: '57',
      issue: '34',
      pages: '3219',
    },
    expected:
      '袁训来, 陈哲, 肖书海, 等. 蓝田生物群: 一个认识多细胞生物早期辐射的新窗口[J]. 科学通报, 2012, 57(34): 3219.',
  },

  {
    description: '英文期刊 - 西文作者',
    raw: 'Frank D B, Ray B B. Quantum-clock and quantum-spin transitions. Phys Rev Lett, 2018, 121(4): 044403.',
    ref: {
      type: 'J',
      language: 'en',
      authors: [
        { family: 'Frank', given: 'D B', isWestern: true },
        { family: 'Ray', given: 'B B', isWestern: true },
      ],
      title: 'Quantum-clock and quantum-spin transitions',
      journal: 'Phys Rev Lett',
      year: '2018',
      volume: '121',
      issue: '4',
      pages: '044403',
    },
    expected:
      'FRANK D B, RAY B B. Quantum-clock and quantum-spin transitions[J]. Phys Rev Lett, 2018, 121(4): 044403.',
  },

  {
    description: '中文专著 - 翻译书带其他责任者',
    raw: '昂温 G, 昂温 P S. 外国出版史[M]. 陈生铮, 译. 北京: 中国书籍出版社, 1988.',
    ref: {
      type: 'M',
      language: 'zh',
      authors: [
        { family: '昂温', given: 'G' },
        { family: '昂温', given: 'P S' },
      ],
      title: '外国出版史',
      otherResponsibles: '陈生铮, 译',
      publisherPlace: '北京',
      publisher: '中国书籍出版社',
      year: '1988',
    },
    expected: '昂温 G, 昂温 P S. 外国出版史[M]. 陈生铮, 译. 北京: 中国书籍出版社, 1988.',
  },

  {
    description: '中文专著 - 带版次与引文页码',
    raw: '库恩 T S. 科学革命的结构[M]. 4版. 北京: 北京大学出版社, 2012: 89.',
    ref: {
      type: 'M',
      language: 'zh',
      authors: [{ family: '库恩', given: 'T S' }],
      title: '科学革命的结构',
      edition: '4版',
      publisherPlace: '北京',
      publisher: '北京大学出版社',
      year: '2012',
      pages: '89',
    },
    expected: '库恩 T S. 科学革命的结构[M]. 4版. 北京: 北京大学出版社, 2012: 89.',
  },

  {
    description: '中文会议论文（析出文献）',
    raw: '钟文发. 非线性规划在可燃毒物配置中的应用[C]//赵玮. 运筹学的理论与应用——中国运筹学会第五届大会论文集. 西安: 西安电子科技大学出版社, 1996: 468-471.',
    ref: {
      type: 'C',
      language: 'zh',
      authors: [{ family: '钟', given: '文发' }],
      title: '非线性规划在可燃毒物配置中的应用',
      bookEditors: '赵玮',
      bookTitle: '运筹学的理论与应用——中国运筹学会第五届大会论文集',
      publisherPlace: '西安',
      publisher: '西安电子科技大学出版社',
      year: '1996',
      pages: '468-471',
    },
    expected:
      '钟文发. 非线性规划在可燃毒物配置中的应用[C]//赵玮. 运筹学的理论与应用——中国运筹学会第五届大会论文集. 西安: 西安电子科技大学出版社, 1996: 468-471.',
  },

  {
    description: '中文学位论文',
    raw: '刘伟. 汉字编码键盘输入方法的研究[D]. 哈尔滨: 哈尔滨工业大学, 2005.',
    ref: {
      type: 'D',
      language: 'zh',
      authors: [{ family: '刘', given: '伟' }],
      title: '汉字编码键盘输入方法的研究',
      institutionPlace: '哈尔滨',
      institution: '哈尔滨工业大学',
      year: '2005',
    },
    expected: '刘伟. 汉字编码键盘输入方法的研究[D]. 哈尔滨: 哈尔滨工业大学, 2005.',
  },

  {
    description: '英文研究报告 - 带报告编号',
    raw: 'Calkin D, Ager A, Thompson M. A comparative risk assessment framework for wildland fire management: the 2010 cohesive strategy science report. RMRS-GTR-262. Fort Collins: USDA Forest Service, 2011.',
    ref: {
      type: 'R',
      language: 'en',
      authors: [
        { family: 'Calkin', given: 'D', isWestern: true },
        { family: 'Ager', given: 'A', isWestern: true },
        { family: 'Thompson', given: 'M', isWestern: true },
      ],
      title: 'A comparative risk assessment framework for wildland fire management',
      subtitle: 'the 2010 cohesive strategy science report',
      reportNumber: 'RMRS-GTR-262',
      publisherPlace: 'Fort Collins',
      publisher: 'USDA Forest Service',
      year: '2011',
    },
    expected:
      'CALKIN D, AGER A, THOMPSON M. A comparative risk assessment framework for wildland fire management: the 2010 cohesive strategy science report: RMRS-GTR-262[R]. Fort Collins: USDA Forest Service, 2011.',
  },

  {
    description: '电子文献 EB/OL',
    raw: '萧钰. 出版业信息化迈入快车道(2001-12-19). http://www.creader.com.',
    ref: {
      type: 'EB/OL',
      language: 'zh',
      authors: [{ family: '萧', given: '钰' }],
      title: '出版业信息化迈入快车道',
      publishDate: '2001-12-19',
      accessDate: '2002-04-15',
      url: 'http://www.creader.com',
    },
    expected:
      '萧钰. 出版业信息化迈入快车道[EB/OL]. (2001-12-19)[2002-04-15]. http://www.creader.com.',
  },

  {
    description: '网络期刊 J/OL',
    raw: '王明亮. 关于中国学术期刊标准化数据库系统工程的进展. 中国学术期刊文摘, 1998, 4(1): 1-2. http://www.example.com.',
    ref: {
      type: 'J/OL',
      language: 'zh',
      authors: [{ family: '王', given: '明亮' }],
      title: '关于中国学术期刊标准化数据库系统工程的进展',
      journal: '中国学术期刊文摘',
      year: '1998',
      volume: '4',
      issue: '1',
      pages: '1-2',
      accessDate: '1998-08-16',
      url: 'http://www.example.com',
    },
    expected:
      '王明亮. 关于中国学术期刊标准化数据库系统工程的进展[J/OL]. 中国学术期刊文摘, 1998, 4(1): 1-2[1998-08-16]. http://www.example.com.',
  },
]
