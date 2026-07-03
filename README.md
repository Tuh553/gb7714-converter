# GB/T 7714-2015 参考文献批量转换

纯前端、BYOK（自带 API key）的 GB/T 7714-2015 顺序编码制参考文献批量识别与转换工具。

## 特性

- **零后端**：所有逻辑在浏览器内运行，API key 仅存 `localStorage`，文本只发送到你配置的 LLM 服务
- **任意输入**：粘贴中英文混杂、APA / MLA / 旧 GB 等任意格式
- **智能切分**：自动识别 `[1]` / 行内 `[N]` / `1.` / 空行 / 单行等分隔形式，预览后可手动合并、删除或修改单条原文
- **并发解析**：每条文献一次 LLM 调用，可配并发数（默认 4，范围 1-16），逐条呈现结果
- **DOI 补全**：自动识别 DOI，并可从 `doi.org`、ACS、Wiley、Frontiers 等链接中规范化 DOI，再调用 Crossref 补全文题、作者、期刊、年份、卷期页等高置信字段
- **链接识别**：识别 `链接：URL` 或普通 URL，作为结构化标识符保留，减少完全依赖 LLM 猜测
- **结构化编辑**：解析为字段后可逐字段修改，手动修改会标记来源并重新校验
- **复核工作流**：按问题、失败、缺字段、已修改筛选；支持问题数排序、最近修改排序、上一条/下一条问题跳转和标记已确认
- **多供应商**：兼容 OpenAI 及任何 OpenAI 兼容接口（DeepSeek / 智谱 / 通义 / Moonshot / OpenRouter ...）
- **模型配置辅助**：可测试连通性、拉取 `/v1/models` 模型列表，并从常用模型或实际可用模型中选择
- **8 种文献类型**：[J] [M] [C] [D] [R] [J/OL] [M/OL] [EB/OL]
- **BibTeX 导出**：已完成条目可导出为 `.bib` 文件，自动生成引用键并映射常见 BibTeX 字段

## 使用流程

1. 点击右上角“配置 API”，填写 API key、Base URL 和模型；Base URL 留空时使用 OpenAI 官方接口。
2. 可选：点击“测试连通”验证配置，或“拉取列表”获取当前账号可用模型。
3. 粘贴参考文献原文，点击“切分预览”检查分段；原文里的 `链接：URL` 会被识别为结构化链接，URL 中的 DOI 会先规范化。
4. 必要时修改原文、删除误切分项或与上一条合并。
5. 点击“开始解析”，等待每条文献完成解析。
6. 在“解析结果”中筛选待复核条目，点击问题提示定位字段，修正后复制单条、复制全部 GB/T 7714 结果，或导出 BibTeX 文件。

## 项目结构

```text
src/
  App.tsx                  # 页面主入口与整体布局
  main.tsx                 # React 挂载入口
  index.css                # Tailwind 与全局样式
  components/              # UI 组件；不放业务解析逻辑
    ui/                    # 可复用基础组件
  store/                   # Zustand 状态与工作流编排
  lib/                     # 可测试的业务逻辑
    gb7714/                # GB/T 7714 类型、提示词与格式化
    llm/                   # OpenAI 兼容接口调用与 LLM 返回解析
    *.ts                   # 切分、校验、DOI/URL、复核等纯逻辑
    *.test.ts              # 与业务逻辑贴近的小型单元测试
  test/
    setup.ts               # Vitest 全局测试设置
    fixtures/              # 大型真实样本和跨模块回归测试数据
```

目录约定：

- `components/` 只处理交互和展示，不直接实现参考文献解析规则。
- `store/` 负责把 UI、LLM、DOI 补全和校验串成工作流，避免把状态副作用散落到组件里。
- `lib/` 保持纯函数优先，新增解析、格式化、校验能力时优先放这里并配套测试。
- `src/test/fixtures/` 存放较大的真实样本；测试文件只引用 fixture，避免业务目录被大段样本文本污染。

## 本地开发

```bash
pnpm install
pnpm dev
```

打开 http://localhost:5173

## 构建

```bash
pnpm build
```

产物输出到 `dist/`。

## 校验

```bash
pnpm test
pnpm typecheck
```

测试覆盖切分、格式化、LLM 返回解析、DOI 合并、复核筛选/排序，以及真实粘贴样本中的 16 条参考文献切分、URL 提取和 DOI 规范化。

## 部署到 Cloudflare Pages

### 方式 A：Git 自动部署（推荐）

1. 把仓库推到 GitHub / GitLab
2. Cloudflare Dashboard → Pages → Create a project → Connect to Git
3. 构建配置：
   - Framework preset: **Vite**
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Node version: 18 或更高（在 Environment variables 添加 `NODE_VERSION=20`）

### 方式 B：Wrangler 命令行直传

```bash
pnpm build
pnpm dlx wrangler pages deploy dist --project-name=gb7714-converter
```

## 技术栈

- Vite 5 + React 18 + TypeScript
- Tailwind CSS 3
- Zustand（状态管理）
- OpenAI SDK（`dangerouslyAllowBrowser`）
- lucide-react（图标）
- Vitest + jsdom（测试）

## 隐私

- API key 仅存于 `localStorage`，关闭浏览器仍在；可在设置中清空
- 解析时，粘贴的文本会作为 user message 发送给你配置的 LLM 服务
- URL 和 DOI 识别在浏览器本地完成；如果识别出 DOI，应用会直接从浏览器请求 Crossref API 拉取公开元数据
- 本应用没有任何服务端，亦不收集任何日志

## 已知限制

- 仅支持顺序编码制（v2 会加 著者-出版年制）
- 不导出 .docx / RIS（v2 增项）
- 闭页不保留历史记录
- DOI 补全依赖 Crossref 可用性；失败时会保留 LLM 解析结果并提示
- DOI 规范化主要覆盖常见 DOI 文本和出版社 landing page 链接，少数非标准跳转链接仍可能需要手动复核


