# GB/T 7714-2015 参考文献批量转换

纯前端、BYOK（自带 API key）的 GB/T 7714-2015 顺序编码制参考文献批量识别与转换工具。

## 特性

- **零后端**：所有逻辑在浏览器内运行，API key 仅存 `localStorage`，文本只发送到你配置的 LLM 服务
- **任意输入**：粘贴中英文混杂、APA / MLA / 旧 GB 等任意格式
- **智能切分**：自动识别 `[1]` / `1.` / 空行 等分隔形式，预览可手动合并/拆分
- **并发解析**：每条文献一次 LLM 调用，可配并发数（默认 4），流式呈现
- **结构化编辑**：解析为字段后可逐字段修改，置信度低/缺失字段高亮提示
- **多供应商**：兼容 OpenAI 及任何 OpenAI 兼容接口（DeepSeek / 智谱 / 通义 / Moonshot / OpenRouter ...）
- **8 种文献类型**：[J] [M] [C] [D] [R] [J/OL] [M/OL] [EB/OL]

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

## 隐私

- API key 仅存于 `localStorage`，关闭浏览器仍在；可在设置中清空
- 解析时，粘贴的文本会作为 user message 发送给你配置的 LLM 服务
- 本应用没有任何服务端，亦不收集任何日志

## 已知限制（v1）

- 仅支持顺序编码制（v2 会加 著者-出版年制）
- 不做 DOI / CrossRef 元数据校验（v2 增项）
- 不导出 .docx / BibTeX / RIS（v2 增项）
- 闭页不保留历史记录
