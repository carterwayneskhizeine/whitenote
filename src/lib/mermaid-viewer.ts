/**
 * Mermaid 图表查看器（纯 DOM 实现，无框架依赖）。
 *
 * 功能：mermaid 源码 → SVG 渲染，带缩放（按钮/ctrl+滚轮）、拖拽平移、
 * 一键全屏（原生 Fullscreen API，Esc 退出）。
 *
 * 使用方：
 * - MermaidRenderer.tsx（share 页占位符水合）
 * - TipTapViewer.tsx（站内 markdown 阅读器的 code 块替换）
 *
 * mermaid 为动态 import，仅由客户端组件调用，避免进入 SSR 包。
 */

export interface MermaidViewerOptions {
  /** 暗色主题（跟随站点 .dark 或分享页配色） */
  dark?: boolean
  /** 常规模式视口最大高度（全屏时自动忽略） */
  maxHeight?: string
}

type ViewerCleanup = () => void

type MermaidAPI = typeof import('mermaid').default

// ── 样式（一次性注入，自包含，不依赖 Tailwind） ────────────────────────────────

const STYLE_ID = 'mermaid-viewer-style'

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.mermaid-viewer-host { margin: 0.75rem 0; }
.mermaid-viewer-box {
  position: relative;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
}
.mermaid-viewer-box.dark { border-color: #2d2d3a; background: #14141c; }
.mermaid-viewer-viewport {
  overflow: auto;
  padding: 14px;
  cursor: grab;
}
.mermaid-viewer-viewport.dragging { cursor: grabbing; user-select: none; }
.mermaid-viewer-stage { width: max-content; margin: 0 auto; line-height: 0; }
.mermaid-viewer-stage svg { display: block; }
.mermaid-viewer-toolbar {
  position: absolute;
  top: 8px;
  right: 24px; /* clear of the viewport scrollbar */
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.85);
  z-index: 5;
  opacity: 0.85;
  transition: opacity 0.15s;
}
.mermaid-viewer-box.dark .mermaid-viewer-toolbar { background: rgba(30, 30, 44, 0.85); }
.mermaid-viewer-box:hover .mermaid-viewer-toolbar { opacity: 1; }
.mv-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  border: 1px solid rgba(120, 120, 140, 0.45);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.92);
  color: #333;
  cursor: pointer;
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.mv-btn:hover { border-color: #7c8cf8; color: #4f6ef7; }
.mermaid-viewer-box.dark .mv-btn { background: rgba(30, 30, 44, 0.92); color: #ddd; }
.mermaid-viewer-box.dark .mv-btn:hover { border-color: #7c8cf8; color: #a5b4fc; }
.mermaid-viewer-box.is-fs {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  max-width: none;
  border: none;
  border-radius: 0;
  background: #0b0f19;
  z-index: 9999;
}
.mermaid-viewer-box.is-fs .mermaid-viewer-viewport {
  max-height: none;
  height: 100%;
  display: flex;
  align-items: safe center;
  justify-content: safe center;
}
.mermaid-viewer-error {
  padding: 12px 14px;
  font-size: 13px;
  color: #b91c1c;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
  white-space: pre-wrap;
  word-break: break-word;
}
.mermaid-viewer-box.dark .mermaid-viewer-error { color: #fca5a5; background: #2a1215; border-top-color: #7f1d1d; }
pre[data-mermaid-mounted] .code-copy-btn { display: none !important; }
`
  document.head.appendChild(style)
}

// ── mermaid 单例加载 ──────────────────────────────────────────────────────────

let mermaidPromise: Promise<MermaidAPI> | null = null
let activeTheme: 'dark' | 'default' | null = null

async function loadMermaid(dark: boolean): Promise<MermaidAPI> {
  if (!mermaidPromise) mermaidPromise = import('mermaid').then((m) => m.default)
  const mermaid = await mermaidPromise
  const theme = dark ? 'dark' : 'default'
  if (activeTheme !== theme) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme })
    activeTheme = theme
  }
  return mermaid
}

let renderSeq = 0

// ── 图标 ──────────────────────────────────────────────────────────────────────

const ICONS = {
  minus: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
}

// ── 挂载 ──────────────────────────────────────────────────────────────────────

/**
 * 在 host 元素内渲染 mermaid 图表并挂载查看器。
 * 返回清理函数（移除监听器、退出全屏、清空 DOM）。
 */
export async function mountMermaidViewer(
  host: HTMLElement,
  code: string,
  options: MermaidViewerOptions = {}
): Promise<ViewerCleanup> {
  injectStyles()
  const dark = options.dark ?? false

  host.classList.add('mermaid-viewer-host')
  host.innerHTML = ''

  const box = document.createElement('div')
  box.className = 'mermaid-viewer-box' + (dark ? ' dark' : '')
  box.innerHTML = `
    <div class="mermaid-viewer-viewport"><div class="mermaid-viewer-stage"></div></div>
    <div class="mermaid-viewer-toolbar">
      <button type="button" class="mv-btn" data-mv="out" title="缩小">${ICONS.minus}</button>
      <button type="button" class="mv-btn" data-mv="reset" title="重置缩放">100%</button>
      <button type="button" class="mv-btn" data-mv="in" title="放大">${ICONS.plus}</button>
      <button type="button" class="mv-btn" data-mv="fs" title="全屏">${ICONS.fullscreen}</button>
    </div>
    <div class="mermaid-viewer-error" hidden></div>`
  host.appendChild(box)

  const viewport = box.querySelector<HTMLDivElement>('.mermaid-viewer-viewport')!
  const stage = box.querySelector<HTMLDivElement>('.mermaid-viewer-stage')!
  const label = box.querySelector<HTMLButtonElement>('[data-mv="reset"]')!
  const errorBox = box.querySelector<HTMLDivElement>('.mermaid-viewer-error')!
  const maxHeight = options.maxHeight ?? '460px'
  viewport.style.maxHeight = maxHeight

  const abort = new AbortController()
  const signal = abort.signal

  let width = 0
  let height = 0
  let scale = 1
  let scaleBeforeFs = 1

  const apply = (): void => {
    stage.style.width = `${Math.round(width * scale)}px`
    const svg = stage.querySelector('svg')
    if (svg) {
      svg.style.width = `${Math.round(width * scale)}px`
      svg.style.height = `${Math.round(height * scale)}px`
    }
    label.textContent = `${Math.round(scale * 100)}%`
  }

  const setScale = (next: number): void => {
    scale = Math.min(4, Math.max(0.25, next))
    apply()
  }

  // ── 渲染图表 ──
  try {
    const mermaid = await loadMermaid(dark)
    const { svg } = await mermaid.render(`mmd-viewer-${Date.now().toString(36)}-${renderSeq++}`, code)
    stage.innerHTML = svg
  } catch (err) {
    errorBox.hidden = false
    errorBox.textContent = `Mermaid 渲染失败: ${err instanceof Error ? err.message : String(err)}\n\n${code}`
    return () => abort.abort()
  }

  const svgEl = stage.querySelector('svg')
  if (!svgEl) {
    errorBox.hidden = false
    errorBox.textContent = 'Mermaid 渲染失败: 输出为空'
    return () => abort.abort()
  }

  const viewBox = svgEl.viewBox.baseVal
  width = viewBox.width || svgEl.getBoundingClientRect().width || 600
  height = viewBox.height || svgEl.getBoundingClientRect().height || 400
  svgEl.style.maxWidth = 'none'
  svgEl.style.width = '100%'
  svgEl.style.height = 'auto'

  // 初始把整张图适配进视口（宽度和高度，不超过 100%）
  const fitInitial = (): number => {
    const availW = viewport.clientWidth - 28
    const availH = viewport.clientHeight - 28
    const fits = [availW > 0 ? availW / width : 1, availH > 0 ? availH / height : 1]
    return Math.min(1, ...fits)
  }
  scale = fitInitial()
  apply()

  // ── 工具栏 ──
  box.querySelector('[data-mv="in"]')?.addEventListener('click', () => setScale(scale * 1.25), { signal })
  box.querySelector('[data-mv="out"]')?.addEventListener('click', () => setScale(scale / 1.25), { signal })
  label.addEventListener('click', () => setScale(1), { signal })

  // ctrl/⌘ + 滚轮缩放
  viewport.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setScale(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
    },
    { signal, passive: false }
  )

  // ── 拖拽平移 ──
  let drag: { x: number; y: number; sl: number; st: number } | null = null
  viewport.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return
      drag = { x: e.clientX, y: e.clientY, sl: viewport.scrollLeft, st: viewport.scrollTop }
      viewport.classList.add('dragging')
      viewport.setPointerCapture(e.pointerId)
    },
    { signal }
  )
  viewport.addEventListener(
    'pointermove',
    (e) => {
      if (!drag) return
      viewport.scrollLeft = drag.sl - (e.clientX - drag.x)
      viewport.scrollTop = drag.st - (e.clientY - drag.y)
    },
    { signal }
  )
  const endDrag = (): void => {
    drag = null
    viewport.classList.remove('dragging')
  }
  viewport.addEventListener('pointerup', endDrag, { signal })
  viewport.addEventListener('pointercancel', endDrag, { signal })

  // ── 全屏 ──
  const fullscreenBtn = box.querySelector<HTMLButtonElement>('[data-mv="fs"]')!
  fullscreenBtn.addEventListener(
    'click',
    () => {
      if (document.fullscreenElement === box) void document.exitFullscreen()
      else void box.requestFullscreen()
    },
    { signal }
  )
  document.addEventListener(
    'fullscreenchange',
    () => {
      const isFs = document.fullscreenElement === box
      box.classList.toggle('is-fs', isFs)
      // 内联 maxHeight 优先级高于 .is-fs 的 CSS 规则，需在此同步切换
      viewport.style.maxHeight = isFs ? 'none' : maxHeight
      if (isFs) {
        scaleBeforeFs = scale
        // 全屏时按窗口尺寸适配，放大上限放宽到 3x
        const fit = Math.min((window.innerWidth - 64) / width, (window.innerHeight - 96) / height)
        setScale(Math.min(3, Math.max(0.25, fit)))
      } else {
        setScale(scaleBeforeFs)
      }
    },
    { signal }
  )

  return () => {
    if (document.fullscreenElement === box) void document.exitFullscreen()
    abort.abort()
  }
}
