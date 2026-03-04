# AI 友好的分享页改造

> 目标：在不破坏现有视觉和交互的前提下，让 `/share/[id]` 更容易被外部 AI 工具、爬虫和 HTML→Markdown 转换器正确解析。

---

## 改动的文件

| 文件 | 类型 | 说明 |
|---|---|---|
| `src/app/share/[id]/page.tsx` | 修改 | 语义化 HTML 结构 + JSON-LD |
| `src/lib/markdownUtils.ts` | 新增 | 服务端 markdown 工具函数（零依赖） |
| `src/app/share/[id]/clean/page.tsx` | 新增 | 简洁视图 Server Component |

---

## 目标 1：语义化 HTML 结构

### 改动前（全是 `<div>`）

```html
<div class="min-h-screen">
  <div class="sticky"><!-- 导航栏 --></div>
  <div class="max-w-3xl">
    <div class="p-6">
      <div><!-- 作者 --></div>
      <div><!-- 正文 --></div>
      <div><!-- 统计 --></div>
    </div>
    <!-- 评论组件 -->
  </div>
</div>
```

### 改动后（语义化标签）

```html
<div class="min-h-screen">
  <script type="application/ld+json">…</script>  <!-- JSON-LD -->

  <div class="sticky"><!-- 导航栏，不变 --></div>

  <main class="max-w-3xl mx-auto">
    <article class="whitenote-post" data-post-id="cmmane4qh0001…">
      <div class="p-6">

        <header class="post-header">
          <!-- 作者名、@handle -->
          <span itemprop="author">GoldieRill</span>
          <!-- 机器可读时间戳 -->
          <time dateTime="2025-06-01T14:30:00.000Z">2025年6月1日 14:30</time>
          <!-- 标签，rel="tag" 是 HTML 微格式标准 -->
          <span rel="tag">#产品设计</span>
        </header>

        <section class="post-content">
          <!-- TipTap 输出真实语义标签 -->
          <h1>标题</h1>
          <p>正文段落……</p>
          <ul><li>列表项</li></ul>
          <blockquote>引用内容</blockquote>
          <pre><code class="language-ts">代码块</code></pre>
        </section>

        <section class="post-actions" aria-label="social actions">
          <!-- 评论数、转发数 —— aria-label 让爬虫不把这里当正文 -->
        </section>

      </div>
    </article>

    <section class="comments" aria-label="comments">
      <!-- 评论区 —— 独立 section，不混入帖子摘要 -->
    </section>
  </main>
</div>
```

### 每个改动的作用

| 标签/属性 | 作用 |
|---|---|
| `<main>` | 让爬虫 / 屏幕阅读器明确识别页面主体，跳过导航栏 |
| `<article class="whitenote-post">` | readability.js、Trafilatura、Jina Reader 以 `<article>` 为主内容边界 |
| `data-post-id` | 爬虫脚本可直接取帖子 ID，无需解析 URL |
| `<header class="post-header">` | 爬虫把 `<header>` 内容识别为 byline（署名行） |
| `<time dateTime="ISO">` | 机器可读时间；HTML→Markdown 工具优先读 `dateTime` 属性 |
| `itemprop="author"` | schema.org 微数据，让不解析 JSON-LD 的工具也能识别作者 |
| `rel="tag"` | HTML 微格式 rel-tag，爬虫标准 |
| `<section class="post-content">` | 明确包裹正文区，与元信息和操作区分离 |
| `<section aria-label="social actions">` | 告知工具"这里是互动按钮"，排除在正文提取结果之外 |
| `<section aria-label="comments">` | 评论区独立，不与帖子正文混淆 |

### TipTap 输出说明

TipTap 配合 `StarterKit` 已经在 `editable: false` 模式下输出真实语义 HTML：

- `# 标题` → `<h1>` … `<h6>`
- 段落 → `<p>`
- `- 列表` → `<ul><li>`
- `1. 列表` → `<ol><li>`
- `> 引用` → `<blockquote>`
- ` ```code``` ` → `<pre><code class="language-xxx">`
- `**bold**` → `<strong>`, `*italic*` → `<em>`

外部工具（如 `turndown`、`pandoc`）可直接把 TipTap 输出的 HTML 转回标准 Markdown，无损。

---

## 目标 2：JSON-LD 结构化元数据

分享页加载数据后，在 `<body>` 内注入一段 `<script type="application/ld+json">`：

```json
{
  "@context": "https://schema.org",
  "@type": "SocialMediaPosting",
  "@id": "https://whitenote.goldie-rill.top/share/cmmane4qh0001…",
  "url": "https://whitenote.goldie-rill.top/share/cmmane4qh0001…",
  "headline": "正文前 110 字（纯文本）",
  "author": {
    "@type": "Person",
    "name": "GoldieRill",
    "identifier": "@goldierill"
  },
  "datePublished": "2025-06-01T14:30:00.000Z",
  "dateModified": "2025-06-01T15:00:00.000Z",
  "articleBody": "去掉 markdown 语法后的纯文本正文……",
  "keywords": "产品设计, AI, 工作流",
  "interactionStatistic": [
    {
      "@type": "InteractionCounter",
      "interactionType": "https://schema.org/CommentAction",
      "userInteractionCount": 12
    },
    {
      "@type": "InteractionCounter",
      "interactionType": "https://schema.org/ShareAction",
      "userInteractionCount": 5
    }
  ]
}
```

### 字段来源

| JSON-LD 字段 | 数据来源 |
|---|---|
| `headline` | `message.content` → `mdToText()` 取前 110 字符 |
| `author.name` | `message.author.name` |
| `author.identifier` | `getHandle(message.author.email)` |
| `datePublished` | `message.createdAt.toISOString()` |
| `dateModified` | `message.updatedAt.toISOString()` |
| `articleBody` | `message.content` 经正则去掉 markdown 语法后的纯文本 |
| `keywords` | `message.tags[].tag.name` 逗号拼接 |
| `interactionStatistic` | `message._count.comments`、`message.retweetCount` |

### 为什么放在 `<body>` 而非 `<head>`

分享页是 `"use client"` 组件，数据通过客户端 fetch 加载，无法在服务端 `generateMetadata` 里填充动态内容。将 `<script type="application/ld+json">` 放在 `<body>` 是 Google、Bing 官方支持的做法，AI 爬虫同样支持。

---

## 目标 3：简洁视图 `/share/[id]/clean`

### 用途

为 AI 工具提供一个"无噪音"入口：

- 去掉粘性导航栏、点赞按钮、推荐卡片等视觉 UI
- 只保留：作者、时间、标签、正文、引用、媒体
- 完全服务端渲染（Server Component），HTTP 响应体直接是完整 HTML，**不需要执行任何 JavaScript**

### 使用方式

在原始分享 URL 后追加 `/clean`：

```
# 完整分享页（客户端渲染）
https://whitenote.goldie-rill.top/share/cmmane4qh0001x8im1cszwvub

# 简洁视图（服务端渲染，AI 友好）
https://whitenote.goldie-rill.top/share/cmmane4qh0001x8im1cszwvub/clean
```

在 Jina Reader、ChatGPT Browse、curl 等场景下，直接请求 `/clean` 即可得到干净的内容。

### 架构设计

```
src/app/share/[id]/clean/page.tsx   ← Server Component（无 "use client"）
    │
    ├── fetchPost()                 ← 直接查 Prisma（无额外 HTTP 往返）
    ├── generateMetadata()          ← OG / Twitter Card + canonical URL
    ├── mdToHtml(content)           ← markdown → 语义化 HTML
    └── JSON-LD <script>            ← 同主分享页格式
```

`canonical` 指向主分享页，告知搜索引擎规范 URL，避免重复内容惩罚：

```html
<link rel="canonical" href="https://whitenote.goldie-rill.top/share/[id]">
```

### 输出的 HTML 结构

```html
<article class="whitenote-post" data-post-id="…">
  <header class="post-header">
    <address><span rel="author">GoldieRill</span></address>
    <time dateTime="2025-06-01T14:30:00.000Z">2025年6月1日 14:30</time>
    <span rel="tag">#产品设计</span>
  </header>

  <section class="post-content">
    <!-- mdToHtml() 输出 -->
    <h1>标题</h1>
    <p>段落</p>
    <ul><li>列表</li></ul>
    <blockquote>引用</blockquote>
    <pre><code class="language-ts">代码</code></pre>
  </section>

  <aside><!-- 引用帖子摘要（如有）--></aside>
  <section aria-label="媒体附件"><!-- img 标签 --></section>
</article>
```

---

## `src/lib/markdownUtils.ts`

共享的服务端 markdown 工具函数，两个视图（主分享页、clean view）均可复用，避免逻辑重复。

### `mdToText(md: string): string`

将 markdown 剥离为纯文本，用于填充 JSON-LD `articleBody` 和 `headline`。

处理内容：代码块、行内代码、图片、链接、标题 `#`、粗/斜/删除线、列表符号、引用 `>`。

### `mdToHtml(md: string): string`

将 markdown 转为语义化 HTML，用于 clean view 服务端渲染。

- 零外部依赖（无需 `marked` / `remark`）
- 支持：h1-h6、p、ul/ol/li、blockquote、pre/code（带语言标签）、a、img、strong、em、s
- 围栏代码块内容经 `escapeHtml()` 处理，无 XSS 风险

---

## 验证工具

改造完成后，可用以下工具验证效果：

| 工具 | 用途 | URL |
|---|---|---|
| Google Rich Results Test | 验证 JSON-LD 结构化数据 | https://search.google.com/test/rich-results |
| Schema.org Validator | 验证 schema.org 类型正确性 | https://validator.schema.org |
| Jina Reader | 测试 AI 抓取效果 | `https://r.jina.ai/https://whitenote.goldie-rill.top/share/[id]/clean` |
| readability.js | 主内容提取测试 | Firefox 阅读模式 / `@mozilla/readability` |
| curl | 验证 clean view 无 JS 依赖 | `curl https://whitenote.goldie-rill.top/share/[id]/clean` |
