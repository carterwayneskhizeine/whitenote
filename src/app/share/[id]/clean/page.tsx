/**
 * /share/[id]/clean — 简洁视图（Server Component）
 *
 * 设计目的：
 *   为外部 AI 工具（如 ChatGPT 插件、Jina Reader、Trafilatura 等）提供
 *   一个去掉 UI 噪音的纯内容页面。页面只保留：
 *     - 帖子标题（取正文第一行 heading 或前 80 字符）
 *     - 作者 + 发布时间
 *     - 关键词标签
 *     - 正文（语义化 HTML，h1-h6 / p / ul-ol-li / blockquote / pre-code）
 *
 *   数据直接从 Prisma 读取，无需额外 API 往返；
 *   页面不引用任何客户端组件（无 "use client"），可完整 SSR/SSG，
 *   且 HTTP 响应体对爬虫立即可读（无 JS hydration 依赖）。
 *
 * URL 示例：
 *   https://whitenote.goldie-rill.top/share/cmmane4qh0001x8im1cszwvub/clean
 *
 * 数据复用策略：
 *   与主分享页（page.tsx）共用同一个 Prisma 查询结构，
 *   渲染逻辑通过 markdownUtils.ts 中的 mdToHtml / mdToText 复用，
 *   避免在两处维护重复的 markdown 处理代码。
 */

import { notFound } from "next/navigation"
import { Metadata } from "next"
import prisma from "@/lib/prisma"
import { getHandle } from "@/lib/utils"
import { mdToHtml, mdToText } from "@/lib/markdownUtils"

// ── 类型 ─────────────────────────────────────────────────────────────────────

interface CleanPageProps {
  params: Promise<{ id: string }>
}

// ── 数据获取（内联，避免重复封装一个 server action）─────────────────────────

async function fetchPost(id: string) {
  return prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: { name: true, email: true },
      },
      tags: {
        include: {
          tag: { select: { name: true } },
        },
      },
      medias: {
        select: { url: true, type: true, description: true },
      },
      quotedMessage: {
        select: {
          content: true,
          author: { select: { name: true, email: true } },
        },
      },
      _count: {
        select: { comments: true },
      },
    },
  })
}

// ── generateMetadata：OG / Twitter Card ──────────────────────────────────────

export async function generateMetadata({
  params,
}: CleanPageProps): Promise<Metadata> {
  const { id } = await params
  const post = await fetchPost(id)
  if (!post) return {}

  const plainText = mdToText(post.content)
  const title = plainText.slice(0, 80)
  const description = plainText.slice(0, 160)
  const authorName = post.author?.name || "GoldieRill"

  return {
    title: `${title} — ${authorName} | WhiteNote`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      authors: [authorName],
      publishedTime: post.createdAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      tags: post.tags.map(({ tag }) => tag.name),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    // 告知爬虫规范 URL 是主分享页，clean 视图仅为辅助
    alternates: {
      canonical: `https://whitenote.goldie-rill.top/share/${id}`,
    },
  }
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

export default async function CleanSharePage({ params }: CleanPageProps) {
  const { id } = await params
  const post = await fetchPost(id)

  if (!post) notFound()

  const authorName = post.author?.name || "GoldieRill"
  const authorHandle = getHandle(post.author?.email || null, !!post.author)
  const tags = post.tags.map(({ tag }) => tag.name)
  const plainText = mdToText(post.content)

  // JSON-LD（schema.org/SocialMediaPosting）
  // 在 generateMetadata 无法插入 JSON-LD 时，直接在 <body> 内放 <script> 也完全有效。
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": `https://whitenote.goldie-rill.top/share/${post.id}`,
    "url": `https://whitenote.goldie-rill.top/share/${post.id}`,
    "headline": plainText.slice(0, 110),
    "author": {
      "@type": "Person",
      "name": authorName,
      "identifier": `@${authorHandle}`,
    },
    "datePublished": post.createdAt.toISOString(),
    "dateModified": post.updatedAt.toISOString(),
    "articleBody": plainText,
    "keywords": tags.join(", ") || undefined,
  }

  // mdToHtml 将 markdown 转为语义化 HTML（h1-h6, p, ul/ol/li, blockquote, pre/code）
  const contentHtml = mdToHtml(post.content)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/*
        极简样式：只做排版，不依赖 Tailwind 或任何 CSS 框架。
        这样即使爬虫禁用 CSS，HTML 结构依然完整可读。
        AI 工具拿到的就是纯语义 HTML，无需解析样式。
      */}
      <style>{`
        .wn-clean-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 2rem 1rem;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 1rem;
          line-height: 1.7;
          color: #111;
        }
        .wn-clean-page a {
          color: #0070f3;
        }
        .wn-clean-page pre {
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 1rem;
          border-radius: 6px;
          overflow-x: auto;
          font-size: 0.875em;
        }
        .wn-clean-page code {
          background: #f0f0f0;
          padding: 0.1em 0.35em;
          border-radius: 3px;
          font-size: 0.875em;
        }
        .wn-clean-page pre code {
          background: transparent;
          padding: 0;
        }
        .wn-clean-page blockquote {
          border-left: 3px solid #aaa;
          margin: 0;
          padding-left: 1rem;
          color: #555;
        }
        .wn-clean-page .post-meta {
          font-size: 0.875rem;
          color: #555;
          margin-bottom: 0.5rem;
        }
        .wn-clean-page .post-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }
        .wn-clean-page .post-tag {
          color: #0070f3;
        }
        .wn-clean-page .back-link {
          display: block;
          margin-bottom: 2rem;
          font-size: 0.875rem;
        }
        .wn-clean-page .quoted-post {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 0.75rem 1rem;
          margin: 1rem 0;
          font-size: 0.9rem;
          color: #444;
        }
        @media (prefers-color-scheme: dark) {
          .wn-clean-page { color: #eee; background: #111; }
          .wn-clean-page code { background: #2a2a2a; color: #eee; }
          .wn-clean-page blockquote { color: #aaa; border-left-color: #555; }
          .wn-clean-page .post-meta { color: #aaa; }
          .wn-clean-page .quoted-post { border-color: #333; color: #bbb; }
        }
      `}</style>

      <div className="wn-clean-page">
        {/* 返回完整分享页的链接，方便用户 / 爬虫溯源 */}
        <a className="back-link" href={`/share/${post.id}`}>
          ← 查看完整分享页
        </a>

        {/*
          <article> 是整篇内容的语义边界。
          Jina Reader、Trafilatura、readability.js 等工具都以 <article> 为
          主内容识别锚点。
        */}
        <article className="whitenote-post" data-post-id={post.id}>
          {/*
            <header> 包含署名行（byline）。
            爬虫把 <header> 内的 <address> / <span rel="author"> 识别为作者，
            把 <time dateTime="ISO"> 识别为发布时间。
          */}
          <header className="post-header">
            <address className="post-meta" style={{ fontStyle: "normal" }}>
              <span rel="author">{authorName}</span>
              {" "}
              <span>@{authorHandle}</span>
            </address>
            <p className="post-meta">
              <time dateTime={post.createdAt.toISOString()}>
                {post.createdAt.toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              {post.updatedAt.getTime() > post.createdAt.getTime() + 1000 && (
                <> · 已编辑</>
              )}
            </p>

            {/* rel="tag" 是 HTML 微格式标准，让爬虫识别这些是主题标签 */}
            {tags.length > 0 && (
              <div className="post-tags" aria-label="标签">
                {tags.map((name) => (
                  <span key={name} className="post-tag" rel="tag">
                    #{name}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/*
            <section class="post-content"> 包裹正文。
            dangerouslySetInnerHTML 的内容由 mdToHtml() 生成，
            该函数仅使用自己的转义（escapeHtml），无 XSS 风险。
            输出的 HTML 标签：h1-h6, p, ul/ol/li, blockquote, pre/code, a, img。
          */}
          <section
            className="post-content"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* 引用帖子（如果有）*/}
          {post.quotedMessage && (
            <aside className="quoted-post" aria-label="引用帖子">
              <p className="post-meta">
                {post.quotedMessage.author?.name || "GoldieRill"}
              </p>
              <p>{mdToText(post.quotedMessage.content).slice(0, 200)}</p>
            </aside>
          )}

          {/* 媒体附件列表（图片/视频），供爬虫索引 */}
          {post.medias && post.medias.length > 0 && (
            <section aria-label="媒体附件">
              {post.medias.map((media, idx) =>
                media.type === "image" || media.type === "IMAGE" ? (
                  <img
                    key={idx}
                    src={media.url}
                    alt={media.description || `附件图片 ${idx + 1}`}
                    style={{ maxWidth: "100%", borderRadius: 6, marginTop: "0.5rem" }}
                  />
                ) : null
              )}
            </section>
          )}
        </article>

        {/* 页脚：来源说明，方便 AI 工具标注引用来源 */}
        <footer style={{ marginTop: "3rem", fontSize: "0.8rem", color: "#888" }}>
          <p>
            来源：<a href={`https://whitenote.goldie-rill.top/share/${post.id}`}>
              WhiteNote · {post.id}
            </a>
          </p>
        </footer>
      </div>
    </>
  )
}
