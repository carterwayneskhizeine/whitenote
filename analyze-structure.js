import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const graphPath = join(process.cwd(), '.understand-anything', 'intermediate', 'assembled-graph.json');
const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));

const nodes = graph.nodes || [];
const edges = graph.edges || [];

function getTopLevelDir(filePath) {
  if (!filePath) return 'unknown';
  return filePath.split('/')[0];
}

function filePath(node) {
  return node.filePath || node.path || null;
}

function normalizeAlias(id) {
  if (id.startsWith('file:@/')) return 'file:src/' + id.slice(6);
  return id;
}

const nodeMap = {};
for (const n of nodes) nodeMap[n.id] = n;

// ── Phase 1: Structural Analysis ────────────────────────────────────────────

const fileNodes = nodes.filter(n => n.type === 'file' && filePath(n));
const importNodes = nodes.filter(n => n.type === 'import');

console.log(`File nodes with usable path: ${fileNodes.length} / ${nodes.filter(n => n.type === 'file').length} total`);
console.log(`Alias import stubs: ${importNodes.length}`);

// Group by top-level directory
const dirGroups = {};
for (const node of fileNodes) {
  const p = filePath(node);
  const dir = getTopLevelDir(p);
  if (!dirGroups[dir]) dirGroups[dir] = [];
  dirGroups[dir].push(node);
}

// Fan-out/fan-in
const fanOut = {}, fanIn = {};
for (const edge of edges) {
  if (edge.type === 'import') {
    fanOut[edge.source] = (fanOut[edge.source] || 0) + 1;
    const tgtId = normalizeAlias(edge.target);
    fanIn[tgtId] = (fanIn[tgtId] || 0) + 1;
  }
}
for (const imp of importNodes) {
  const impId = normalizeAlias(imp.id);
  for (const src of imp.importedBy || []) {
    fanOut[src] = (fanOut[src] || 0) + 1;
    fanIn[impId] = (fanIn[impId] || 0) + 1;
  }
}

// Inter-group import frequency
const interGroupImports = {};
for (const edge of edges) {
  if (edge.type !== 'import') continue;
  const src = nodeMap[edge.source];
  const tgtId = normalizeAlias(edge.target);
  const tgt = nodeMap[tgtId];
  if (!src || !tgt) continue;
  const sp = src.filePath || src.path;
  const tp = filePath(tgt);
  if (!sp || !tp) continue;
  const sd = getTopLevelDir(sp), td = getTopLevelDir(tp);
  if (sd !== td) {
    const key = `${sd}->${td}`;
    interGroupImports[key] = (interGroupImports[key] || 0) + 1;
  }
}
for (const imp of importNodes) {
  const impId = normalizeAlias(imp.id);
  const tgt = nodeMap[impId];
  if (!tgt) continue;
  const tp = filePath(tgt);
  if (!tp) continue;
  const td = getTopLevelDir(tp);
  for (const src of imp.importedBy || []) {
    const srcNode = nodeMap[src];
    if (!srcNode) continue;
    const sp = srcNode.filePath || srcNode.path;
    if (!sp) continue;
    const sd = getTopLevelDir(sp);
    if (sd !== td) {
      const key = `${sd}->${td}`;
      interGroupImports[key] = (interGroupImports[key] || 0) + 1;
    }
  }
}

console.log('\n=== Directory Groups ===');
for (const [dir, files] of Object.entries(dirGroups).sort((a, b) => b[1].length - a[1].length)) {
  let to = 0, ti = 0;
  for (const f of files) { to += fanOut[f.id] || 0; ti += fanIn[f.id] || 0; }
  console.log(`  ${dir}/  files=${files.length}  fan-out=${to}  fan-in=${ti}`);
}

console.log('\n=== Inter-group Imports (top 20) ===');
for (const [pair, count] of Object.entries(interGroupImports).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${pair}: ${count}`);
}

// ── Phase 2: Layer Assignment ─────────────────────────────────────────────────

function matches(node, prefixes) {
  const p = filePath(node);
  if (!p) return false;
  return prefixes.some(pre => p.startsWith(pre));
}

function classify(node) {
  const p = filePath(node);

  // AI integration first (most specific)
  if (matches(node, ['src/lib/ai/', 'src/lib/openclaw/', 'src/app/api/openclaw/', 'src/app/api/hermes/',
                      'src/components/OpenClawChat/', 'src/app/aichat/'])) return 'ai-integration';
  // Real-time infra
  if (matches(node, ['src/lib/socket/'])) return 'realtime-infra';
  // Queue (data access via queue)
  if (matches(node, ['src/lib/queue/'])) return 'data-access';
  // Prisma schema + scripts (pure data)
  if (matches(node, ['prisma/', 'scripts/'])) return 'data-access';
  // Store + hooks (business logic glue)
  if (matches(node, ['src/store/', 'src/hooks/'])) return 'business-logic';
  // Business components (non-UI, non-layout)
  if (matches(node, ['src/components/']) && !matches(node, ['src/components/ui/', 'src/components/layout/'])) return 'business-logic';
  // Layout + UI atoms (presentation)
  if (matches(node, ['src/components/layout/', 'src/components/ui/'])) return 'presentation';
  // Pages (presentation)
  if (matches(node, ['src/app/settings/', 'src/app/page.tsx', 'src/app/[workspace]/', 'src/app/status/',
                      'src/app/retweet/', 'src/app/share/', 'src/app/aichat/'])) return 'presentation';
  // Data access via API routes (check BEFORE generic api-routing)
  if (matches(node, ['src/app/api/comments/', 'src/app/api/messages/', 'src/app/api/media/',
                      'src/app/api/auth/', 'src/app/api/workspaces/'])) return 'data-access';
  // Generic API routes (check AFTER specific data-access routes)
  if (matches(node, ['src/app/api/'])) return 'api-routing';
  // Foundation: lib (not ai, not openclaw, not socket, not queue)
  if (matches(node, ['src/lib/'])) return 'foundation';
  if (matches(node, ['src/types/'])) return 'foundation';
  return null;
}

const layerMap = {};
for (const node of fileNodes) {
  const layer = classify(node);
  if (!layer) continue;
  if (!layerMap[layer]) layerMap[layer] = [];
  layerMap[layer].push(node.id);
}

const layerDefs = {
  'presentation':    { name: '展示层 (Presentation Layer)',                desc: 'Next.js App Router 页面组件、布局组件、UI 原子组件（shadcn/ui）。负责渲染用户界面、处理交互事件、响应式布局。' },
  'business-logic':  { name: '业务逻辑层 (Business Logic Layer)',           desc: 'React 业务组件（MessageCard、CommentsList、InputMachine 等）、Zustand Store、Custom Hooks。封装可复用的 UI 逻辑与状态管理。' },
  'api-routing':     { name: 'API 路由层 (API Routing Layer)',              desc: 'Next.js API Routes，处理 HTTP 请求/响应，调用数据层和 AI 层。负责认证、中间件、请求验证与路由分发。' },
  'ai-integration':  { name: 'AI 集成层 (AI Integration Layer)',            desc: 'AI 服务集成库、OpenClaw/Hermes 客户端、RAGFlow 向量检索。封装对外部 AI 服务的调用，包括检测层、RAG 层、命令层、自动化层。' },
  'realtime-infra':  { name: '实时基础设施层 (Real-time Infrastructure)',  desc: 'Socket.IO 服务端配置、消息广播、事件处理。提供实时消息推送与协作功能。' },
  'data-access':     { name: '数据访问层 (Data Access Layer)',             desc: 'Prisma ORM 模型操作、Queue 任务队列处理。封装数据库 CRUD 操作与异步任务调度。' },
  'foundation':      { name: '基础设施层 (Foundation Layer)',             desc: '工具库、常量定义、TypeScript 类型声明。提供跨层共享的工具函数，包括 D3.js 可视化配置等。' },
};

const layers = Object.entries(layerMap)
  .map(([key, nodeIds]) => ({
    id: `layer:${key.replace(/_/g, '-')}`,
    name: layerDefs[key]?.name || key,
    description: layerDefs[key]?.desc || '',
    nodeIds: [...new Set(nodeIds)]
      .filter(nid => !nid.startsWith('file:file-')) // deduplicate + fix double-normalized
      .filter(nid => /\.(ts|tsx|js|jsx)$/.test(nid)) // only source files
  }))
  .filter(l => l.nodeIds.length > 0)
  .sort((a, b) => b.nodeIds.length - a.nodeIds.length);

mkdirSync('.understand-anything/internal', { recursive: true });
writeFileSync('.understand-anything/internal/layers.json', JSON.stringify(layers, null, 2));
console.log('\n=== Layers saved to .understand-anything/internal/layers.json ===');
for (const l of layers) {
  console.log(`  ${l.id}: ${l.nodeIds.length} nodes`);
  l.nodeIds.forEach(nid => console.log(`    ${nid}`));
}