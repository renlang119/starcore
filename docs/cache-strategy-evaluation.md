# 星核纪元 · 客户端资源缓存策略评估报告

> 评估日期：2026-07-13
> 评估范围：构建产物缓存现状、Nginx 缓存头配置、图标资源缓存情况
> 项目路径：项目根目录

---

## 一、构建产物缓存策略现状

### 1.1 Vite 构建配置（vite.config.ts）

```ts
build: {
  target: 'es2020',
  outDir: 'dist',
  assetsInlineLimit: 4096,  // 4KB 以下资源内联为 base64
}
```

**关键发现：**

- Vite 默认开启 **content hash 文件名指纹**（`assets/[name]-[hash].js`、`[name]-[hash].css`）
- `assetsInlineLimit: 4096` — 小于 4KB 的资源会被内联到 JS/CSS 中（作为 base64 data URI），不生成独立文件
- 未自定义 `rollupOptions.output.chunkFileNames` / `entryFileNames` / `assetFileNames`，使用 Vite 默认值

### 1.2 dist/ 产物结构

```
dist/
├── index.html                          (~937 B)   ← 无 hash，入口文件
├── favicon.svg                         (~9.5 KB)  ← 无 hash，从 public/ 原样复制
├── icons.svg                           (~5.0 KB)  ← 无 hash，从 public/ 原样复制（未使用，见第四节）
├── fonts/
│   ├── JetBrainsMono-latin.woff2       (~31 KB)   ← 无 hash，从 public/ 原样复制
│   ├── JetBrainsMono-latin-ext.woff2   (~11 KB)   ← 无 hash
│   └── Orbitron-latin.woff2            (~11 KB)   ← 无 hash
└── assets/
    ├── index-CSuhe7b9.js               (~229 KB)  ← 主 bundle，含 hash ✅
    ├── index-vwN_XJYw.css              (~22 KB)   ← 主样式，含 hash ✅
    ├── Icons-MkslwOt4.js               (~11.5 KB) ← 图标 chunk，含 hash ✅
    ├── HomeView-Gb7YUm7g.js            (~4.2 KB)  ← 路由懒加载 chunk，含 hash ✅
    ├── HomeView-BFIP0hXG.css           (~3.5 KB)  ← 含 hash ✅
    ├── BuildView-B13YqpWQ.js           (~8.9 KB)  ← 含 hash ✅
    ├── ... (每个 View 都有独立的 JS+CSS chunk，文件名均含 hash)
    └── CostTag-BFNtA1ID.js             (~700 B)   ← 含 hash ✅
```

**产物结构结论：**

| 资源类型 | hash 指纹 | 说明 |
|----------|-----------|------|
| JS chunks (`/assets/*.js`) | ✅ 有 | Vite 默认 `[name]-[hash].js`，内容变更时 hash 自动变化 |
| CSS chunks (`/assets/*.css`) | ✅ 有 | Vite 默认 `[name]-[hash].css` |
| `index.html` | ❌ 无 | 入口文件，本不应有 hash（否则浏览器无法知道该请求哪个文件名） |
| `public/` 下的静态文件 | ❌ 无 | `favicon.svg`、`icons.svg`、`fonts/*.woff2` 均无 hash |

### 1.3 路由懒加载分包

项目使用 Vue Router 的动态 `import()` 进行路由级代码分割：

```ts
{ path: '/', component: () => import('@/views/HomeView.vue') }
{ path: '/build', component: () => import('@/views/BuildView.vue') }
// ... 8 个路由均为懒加载
```

每个 View 被拆分为独立的 JS+CSS chunk。用户首次访问时只下载当前页面所需的代码，其他页面按需加载。

`Icons.vue` 被 8 个 View 组件 import，Rollup 自动将其提取为共享 chunk `Icons-MkslwOt4.js`，避免重复打包。

---

## 二、index.html 缓存控制分析

### 2.1 HTML 中的 meta 标签

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="..." />
  <meta name="theme-color" content="#05070D" />
  <meta name="description" content="..." />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; ..." />
  <title>星核纪元 · StarCore Era</title>
</head>
```

**发现：**

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `<meta http-equiv="Cache-Control">` | ❌ 未配置 | HTML 中无任何客户端缓存控制 meta 标签 |
| Service Worker 注册 | ❌ 未配置 | 全项目无 `navigator.serviceWorker.register()` 调用 |
| Web App Manifest | ❌ 未配置 | 无 `<link rel="manifest">` 标签，无 `manifest.json` 文件 |
| PWA 相关依赖 | ❌ 未安装 | package.json 中无 `vite-plugin-pwa`、`workbox-*` 等依赖 |

### 2.2 小结

index.html **完全依赖服务端 Nginx 的 Cache-Control 响应头来控制缓存**，HTML 本身不包含任何缓存指令。无 Service Worker、无离线 manifest，即用户离线后无法访问应用。

---

## 三、服务端 Nginx 缓存头配置（deploy.py）

deploy.py 中推送的 Nginx 配置如下，缓存策略分为三个层级：

### 3.1 完整 Nginx 缓存配置表

| location | 资源类型 | Cache-Control | expires | 说明 |
|----------|----------|---------------|---------|------|
| `= /index.html` | HTML 入口 | `no-cache, must-revalidate` | — | 每次请求都向服务器验证（ETag/Last-Modified），命中 304 时不传 body |
| `/assets/` | JS/CSS chunks | `public, immutable` | `30d` | 文件名含 content hash，可安全长缓存 |
| `/fonts/` | woff2 字体 | `public, immutable` | `30d` | 自托管字体，长缓存 + CORS `Access-Control-Allow-Origin: *` |
| `/` (try_files) | 其他所有路径 | ❌ 未配置 | ❌ 未配置 | 落入 server 级默认，无 Cache-Control 头 |

### 3.2 各资源实际缓存命中分析

#### ✅ `/assets/*.js` 和 `*.css`（有 hash 的构建产物）

- **Nginx 配置**：`Cache-Control: public, immutable` + `expires 30d`
- **文件名格式**：`[name]-[hash].js`（如 `index-CSuhe7b9.js`）
- **缓存行为**：浏览器首次下载后缓存 30 天，后续访问直接使用本地缓存，**不会发送任何请求到服务器**（`immutable` 指令阻止浏览器进行条件请求）
- **更新机制**：部署新版本后，文件内容变化 → hash 变化 → 文件名变化 → index.html 引用新文件名 → 浏览器请求新 URL → 旧文件自然从缓存过期
- **结论**：✅ **缓存策略正确，不会每次重新下载**

#### ✅ `/fonts/*.woff2`（自托管字体）

- **Nginx 配置**：`Cache-Control: public, immutable` + `expires 30d`
- **文件名**：无 hash（`Orbitron-latin.woff2` 等），但字体文件极少变更
- **缓存行为**：首次下载后缓存 30 天，30 天内不重新请求
- **潜在问题**：字体文件无 hash 指纹，若未来更新字体内容，文件名不变，浏览器在 30 天内仍使用旧缓存。需手动改名或等待缓存过期。
- **结论**：✅ **当前缓存正常，但更新字体的流程需注意版本管理**

#### ✅ `/index.html`（HTML 入口）

- **Nginx 配置**：`Cache-Control: no-cache, must-revalidate`
- **缓存行为**：浏览器每次导航都会向服务器发送条件请求（带 `If-None-Match: <ETag>` 或 `If-Modified-Since: <日期>`），服务器比对后返回 `304 Not Modified`（无 body，仅头部 ~200B）或 `200`（新内容 ~937B）
- **结论**：✅ **策略正确 — 每次访问会验证，但只在内容变化时才重新下载 body**

#### ⚠️ `/favicon.svg`（站点图标）

- **Nginx 配置**：❌ 无专属 location，落入 `location /` 的 `try_files $uri $uri/ /index.html` 规则
- **实际行为**：`try_files` 找到 `/var/www/starcore/favicon.svg` 后直接返回，但**没有添加任何 Cache-Control 头**
- **结果**：浏览器使用默认启发式缓存（通常缓存 ~10% of Age，或根据 Last-Modified 估算），行为不确定
- **另外**：index.html 中**没有 `<link rel="icon" href="/favicon.svg">` 标签**！浏览器会自动请求 `/favicon.svg`，能找到文件，但 HTML 未显式声明
- **结论**：⚠️ **缓存策略缺失，但影响小（仅 ~9.5 KB，且浏览器默认缓存通常能命中）**

#### ⚠️ `/icons.svg`（public 目录中的 SVG 文件）

- **Nginx 配置**：❌ 无专属 location，同样落入 `try_files`
- **实际行为**：无 Cache-Control 头，浏览器启发式缓存
- **重要发现**：**此文件在源码中无任何引用**（详见第四节）
- **结论**：⚠️ **是冗余文件，应该清理删除**

#### 其他路径（SPA 路由如 `/build`、`/tech` 等）

- **Nginx 配置**：`try_files $uri $uri/ /index.html` — 回退到 index.html
- **缓存行为**：回退返回的 index.html 会带上 `no-cache, must-revalidate`（因为 `= /index.html` 的 location 优先级最高）
- **结论**：✅ **SPA 路由正确回退并带上正确的缓存头**

### 3.3 安全头配置

所有 location 块中都添加了：
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
```
gzip 也正确配置了 `text/css`、`application/javascript`、`image/svg+xml` 等类型。

---

## 四、图标资源缓存单独说明

### 4.1 项目中存在两套"图标"

| 图标系统 | 位置 | 是否使用 | 说明 |
|----------|------|----------|------|
| **Icons.vue（SVG sprite 内联）** | `src/components/ui/Icons.vue` | ✅ **使用中** | 39 个 `<symbol>` 定义在 Vue 组件中，编译后进入 JS bundle |
| **public/icons.svg（独立 SVG 文件）** | `public/icons.svg` | ❌ **未使用** | 6 个 symbol（bluesky-icon 等社交图标），全项目无引用 |

### 4.2 Icons.vue 的工作方式

Icons.vue 定义了 39 个 SVG `<symbol>`，通过 `<use href="#i-xxx">` 在各 View 中引用：

```vue
<!-- Icons.vue 定义 -->
<svg style="display:none">
  <defs>
    <symbol id="i-home" viewBox="0 0 24 24">...</symbol>
    <symbol id="i-build" viewBox="0 0 24 24">...</symbol>
    <!-- ... 39 个 symbol ... -->
  </defs>
</svg>

<!-- 各 View 中引用 -->
<svg><use href="#i-home" /></svg>
```

Icons.vue 被 8 个 View 组件 import（HomeView、BuildView、TechView、MapView、ArmyView、RelicView、PrestigeView、BattleView），Rollup 自动将其提取为共享 chunk。

### 4.3 图标资源的缓存链路

```
用户访问 → 下载 index.html (no-cache, 304)
         → 解析 <script src="/assets/index-CSuhe7b9.js">
         → 下载主 bundle JS (immutable, 30d缓存) ✅
         → 路由懒加载时下载 Icons-MkslwOt4.js (immutable, 30d缓存) ✅
         → 图标 symbol 定义在此 chunk 中，随 JS 一起被浏览器缓存
         → 后续访问：Icons chunk 命中本地缓存，不重新请求 ✅
```

### 4.4 图标缓存结论

- **图标是否内联在 JS bundle 中**：✅ 是，Icons.vue 编译后成为 `Icons-MkslwOt4.js` 独立 chunk
- **图标是否被浏览器缓存**：✅ 是，该 chunk 文件名含 content hash，命中 Nginx 的 `public, immutable` + `expires 30d` 配置
- **缓存命中情况**：✅ **良好** — 首次加载后 30 天内不会重新请求 Icons chunk
- **更新机制**：图标内容变化 → Icons chunk hash 变化 → index.html 引用新文件名 → 浏览器请求新版本
- **冗余文件**：`public/icons.svg`（5 KB）是历史遗留文件，未被任何代码引用，但会被部署到服务器。建议删除以避免混淆。

### 4.5 图标 chunk 体积

| chunk | 大小 | gzip 后估算 | 说明 |
|-------|------|-------------|------|
| `Icons-MkslwOt4.js` | ~11.5 KB | ~3.5 KB | 39 个 SVG symbol，首次加载后长缓存 |

---

## 五、综合结论

### 5.1 各资源缓存情况总览

| 资源 | 大小 | 能否被缓存 | 缓存时长 | 每次访问是否重新下载 | 评级 |
|------|------|-----------|----------|-------------------|------|
| `index.html` | 937 B | ✅ 能（条件请求） | 每次验证 ETag | 仅 304 头部（~200B），内容不变时不重传 | ✅ 优秀 |
| 主 JS `index-*.js` | 229 KB | ✅ 能 | 30d immutable | 否，30 天内直接用本地缓存 | ✅ 优秀 |
| 主 CSS `index-*.css` | 22 KB | ✅ 能 | 30d immutable | 否 | ✅ 优秀 |
| Icons JS `Icons-*.js` | 11.5 KB | ✅ 能 | 30d immutable | 否 | ✅ 优秀 |
| 各 View JS/CSS | 2-9 KB each | ✅ 能 | 30d immutable | 否（按需懒加载） | ✅ 优秀 |
| 字体 `*.woff2` | 11-31 KB each | ✅ 能 | 30d immutable | 否 | ✅ 良好（无 hash 但变更少） |
| `favicon.svg` | 9.5 KB | ⚠️ 启发式缓存 | 不确定 | 可能会发条件请求 | ⚠️ 待优化 |
| `icons.svg`（public） | 5 KB | ⚠️ 启发式缓存 | 不确定 | — | ❌ 冗余文件 |

### 5.2 核心结论

**项目整体的缓存策略已经相当完善，不存在"每次访问都由服务端重新下发所有资源"的问题。**

具体来说：

1. **JS/CSS 构建产物（含图标）**：文件名带 content hash + Nginx `immutable` 30天长缓存 → 首次加载后 30 天内零请求。这部分占总传输量 90%+，缓存策略完美。

2. **index.html 入口**：`no-cache, must-revalidate` → 每次访问发条件请求，但只有内容变化时才传 body（304 响应仅 ~200B）。这是 SPA 的标准最佳实践。

3. **字体文件**：长缓存 30 天，但无 hash 指纹，更新时需注意改名。

4. **每次访问的实际网络传输**（回访用户）：
   - `index.html` 条件请求 → 304（~200B 头部）
   - 若 index.html 未变：**零额外下载**
   - 若 index.html 变了（新部署）：下载新 index.html（~937B）+ 变化了的 JS/CSS chunks（仅 hash 变化的文件）

### 5.3 存在的问题与改进建议

#### 问题 1：favicon.svg 和 public/icons.svg 缺少缓存头

**现状**：这两个文件落入 `location /` 的 `try_files` 规则，无专属 Cache-Control。

**改进建议**：在 Nginx 配置中添加：

```nginx
# favicon — 长缓存（极少变更）
location = /favicon.svg {
    expires 30d;
    add_header Cache-Control "public" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}

# SVG 静态资源（若保留 icons.svg）
location ~* \.svg$ {
    expires 30d;
    add_header Cache-Control "public" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

#### 问题 2：public/icons.svg 是冗余文件

**现状**：`public/icons.svg` 包含 6 个社交图标 symbol（bluesky-icon 等），但全项目无任何代码引用它。

**改进建议**：删除 `public/icons.svg` 文件，减少部署产物体积（-5 KB）和潜在混淆。

#### 问题 3：index.html 未声明 favicon 引用

**现状**：index.html 中无 `<link rel="icon" href="/favicon.svg">` 标签，浏览器依赖默认行为自动请求 `/favicon.svg`。

**改进建议**：在 `<head>` 中显式声明：
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

#### 问题 4：字体文件无 hash 指纹

**现状**：`fonts/*.woff2` 从 `public/` 目录原样复制，文件名无 content hash。

**改进建议**：将字体文件移至 `src/assets/fonts/` 并通过 CSS `@font-face` 引用，Vite 会自动给字体文件加上 hash 指纹。这样字体更新时文件名会变化，确保浏览器立即获取新版本。

#### 问题 5：无 Service Worker / PWA 离线支持

**现状**：项目是一个放置类游戏，非常适合 PWA 离线体验，但当前无 Service Worker。

**改进建议**（可选，非必须）：
- 安装 `vite-plugin-pwa` 插件
- 配置 Service Worker 预缓存所有 JS/CSS/字体资源
- 用户离线时仍可访问应用、查看游戏状态
- 对放置游戏来说，离线可用性是重要的用户体验提升

### 5.4 缓存策略评级

| 维度 | 评级 | 说明 |
|------|------|------|
| JS/CSS hash 指纹 | ⭐⭐⭐⭐⭐ | Vite 默认配置，完美 |
| Nginx 长缓存配置 | ⭐⭐⭐⭐⭐ | immutable 30d，策略正确 |
| HTML 入口缓存 | ⭐⭐⭐⭐⭐ | no-cache + must-revalidate，标准实践 |
| 字体缓存 | ⭐⭐⭐⭐ | 长缓存 OK，但缺 hash |
| 图标缓存 | ⭐⭐⭐⭐⭐ | 内联 JS chunk，随 bundle 长缓存 |
| favicon 缓存 | ⭐⭐⭐ | 缺专属缓存头 + HTML 未声明 |
| 冗余文件清理 | ⭐⭐ | public/icons.svg 未清理 |
| PWA 离线支持 | ⭐ | 未配置（可选增强） |
| **总体评级** | **⭐⭐⭐⭐** | **缓存策略已相当完善，有少量可优化点** |

---

## 六、总结

**用户关心的核心问题回答：**

> "包括图标在内的各类资源，能否被浏览器缓存、而非每次访问都由服务端重新下发？"

**答：✅ 能。** 项目的缓存策略已经相当完善：

1. **所有 JS/CSS 资源（含图标）** 文件名带 content hash + Nginx `immutable` 30天缓存 → 回访用户 30 天内不会重新下载这些资源
2. **index.html** 每次访问会发条件请求（ETag 验证），但只有部署了新版本时才会重新传输 body（~937B），否则返回 304（~200B 头部）
3. **图标** 以 SVG sprite 形式内联在 `Icons-MkslwOt4.js` chunk 中，随 JS bundle 一起被长缓存，不会每次重新下载
4. **字体** 也配置了 30 天长缓存

**不存在"每次访问都重新下发所有资源"的问题。** 回访用户的网络开销仅为一次 index.html 的 304 条件请求（~200B），除非有新部署。

**可优化的少量点**：为 favicon 添加缓存头、清理冗余的 public/icons.svg、在 HTML 中声明 favicon 引用、（可选）为放置游戏添加 PWA 离线支持。
