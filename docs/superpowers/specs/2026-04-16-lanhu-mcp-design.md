# LanHu MCP Server 设计文档

## 概述

构建一个 TypeScript MCP Server，用于从蓝湖获取设计稿数据，支持 AI（Claude）根据这些数据还原前端页面。

**核心工作流：** 用户给 Claude 蓝湖链接 → MCP 获取并清洗设计稿数据 → Claude 结合项目上下文生成 Vue 代码。

**设计原则：** MCP 只负责数据获取和清洗，代码生成完全交给 Claude。这样 Claude 能利用项目上下文（现有组件、风格习惯、技术栈）生成更贴合项目的代码。

## 整体架构

```
用户给 Claude 蓝湖链接
        ↓
Claude 调用 MCP Tools
        ↓
┌─ lanhu-mcp-server (TypeScript) ──────────────┐
│                                                │
│  Auth 模块 → Cookie 持久化 + 过期自动刷新       │
│       ↓                                        │
│  API 模块 → 蓝湖内部 API 调用                   │
│       ↓                                        │
│  数据清洗模块 → 剪枝 / 分类 / 样式转 UnoCSS     │
│       ↓                                        │
│  切图模块 → 下载 + 去重 + 分类命名               │
│       ↓                                        │
│  截图模块 → Playwright 页面截图                  │
│                                                │
└────────────────────────────────────────────────┘
        ↓
返回给 Claude：截图 + 清洗后的结构化数据 + 切图清单
        ↓
Claude 结合项目上下文生成 Vue 代码
```

## MCP Tools

### 1. `lanhu_login`

启动浏览器登录蓝湖，获取并持久化 cookie。

- **输入：** 无
- **输出：** 登录状态（成功/失败）
- **说明：** 一般不需要用户主动调用，其他工具检测到 cookie 过期时自动触发

### 2. `lanhu_resolve_link`

解析蓝湖分享/邀请链接为可用的项目参数。

- **输入：** 蓝湖链接 URL
- **输出：** `project_id`、`image_id`、`team_id` 等参数

### 3. `lanhu_get_design`

获取设计稿的清洗后结构化数据（核心工具）。

- **输入：** 蓝湖链接（或 project_id + image_id）
- **输出：** 精简图层树，每个节点包含类型、UnoCSS class、文本内容或切图引用

### 4. `lanhu_get_screenshot`

获取设计稿页面截图，用于 AI 整体视觉理解。

- **输入：** 蓝湖链接
- **输出：** 截图图片路径

### 5. `lanhu_download_slices`

下载设计稿中已标注的切图资源。

- **输入：** 蓝湖链接 + 输出目录（默认 `src/assets/`）+ 图片格式（默认 webp）+ 倍率（默认 2x）
- **输出：** 下载清单（文件名、路径、尺寸、分类）

## 数据清洗逻辑

蓝湖返回 Sketch 格式 JSON，原始数据噪音大。清洗分 4 步：

### Step 1 - 剪枝

- 移除不可见图层（`visible: false`、`opacity: 0`）
- 移除空的 group 节点
- 扁平化只有单个子节点的 group（去除无意义嵌套）
- 移除蓝湖内部辅助图层（标注层、参考线等）

### Step 2 - 元素分类

| 类型 | 判断规则 | 对应前端 |
|------|---------|---------|
| `container` | 有子节点的 group | `div` 容器 |
| `text` | 文本图层 | 文本元素 |
| `image` | 有 `hasExportImage` 标记或纯图片填充 | `img` 标签 |
| `shape` | 纯色/渐变填充的矩形、圆形等 | `div` + CSS |
| `icon` | 小尺寸的图片/矢量图层 | `img` 或 SVG |

**关键区分：** 有切图标记的是图片资源（`image`/`icon`），没有的用 CSS 实现（`shape`）。

### Step 3 - 样式转 UnoCSS

将每个节点的样式属性直接转换为标准 UnoCSS 原子类字符串：

```typescript
interface CleanedNode {
  type: 'container' | 'text' | 'image' | 'shape' | 'icon'
  name: string
  class: string             // 标准 UnoCSS 原子类
  text?: string             // 仅 text 类型
  imageRef?: string         // 仅 image/icon 类型，关联切图文件名
  children?: CleanedNode[]  // 仅 container 类型
}
```

使用标准 UnoCSS 原子类（不使用项目自定义 shortcut），保证通用性。

### Step 4 - 压缩输出

- 超大设计稿分块输出，避免上下文溢出

## Cookie 管理

```
首次使用 / Cookie 过期
        ↓
Playwright 有头模式启动浏览器 → 打开蓝湖登录页
        ↓
用户手动登录（处理验证码、扫码等）
        ↓
登录成功 → 提取 Cookie → 持久化到 ~/.lanhu-mcp/cookie.json
        ↓
后续请求自动携带 Cookie
        ↓
API 返回 401/403 → 判定过期 → 重新触发登录流程
```

- Cookie 持久化到 `~/.lanhu-mcp/cookie.json`，跨会话复用
- 不主动检测过期，请求失败时触发刷新
- 登录成功判断：监听页面跳转到蓝湖主页或检测到关键 cookie 字段

## 切图下载策略

**分类命名规则：**

| 分类 | 命名 | 判断依据 |
|------|------|---------|
| 背景图 | `bg-1.webp`、`bg-2.webp` | 全宽/全高的大尺寸图片 |
| 普通图片 | `img-1.webp`、`img-2.webp` | 中等尺寸图片 |
| 图标 | `icon-1.webp`、`icon-2.webp` | 小尺寸图片/矢量 |

**下载流程：**

1. 解析设计稿 JSON，找到所有有切图标记的图层
2. 利用蓝湖 OSS 参数（`x-oss-process=image/resize`）生成指定倍率和格式的 URL
3. 去重：相同资源只下载一次
4. 按分类命名，同类型自增序号
5. 下载到用户指定目录（默认 `src/assets/`）
6. 返回下载清单

**默认配置：** 2x 倍率、webp 格式（移动端 H5 常用）。

## 蓝湖 API 端点

基于现有实现逆向获得的内部 API：

| 端点 | 用途 |
|------|------|
| `lanhuapp.com/api/project/image` | 获取设计稿元信息，含 `json_url` |
| `json_url`（动态返回）| 下载完整 Sketch 格式设计稿 JSON |
| `lanhuapp.com/api/project/images` | 获取项目下所有设计图列表 |
| `lanhuapp.com/api/project/multi_info` | 获取项目级元信息 |
| `dds.lanhuapp.com/api/dds/image/store_schema_revise` | 获取设计 schema（更详细）|

## 项目结构

```
lanhu-mcp/
├── src/
│   ├── index.ts              # MCP Server 入口，注册 tools
│   ├── tools/
│   │   ├── login.ts          # lanhu_login
│   │   ├── resolve-link.ts   # lanhu_resolve_link
│   │   ├── get-design.ts     # lanhu_get_design
│   │   ├── get-screenshot.ts # lanhu_get_screenshot
│   │   └── download-slices.ts# lanhu_download_slices
│   ├── core/
│   │   ├── api.ts            # 蓝湖 API 封装
│   │   ├── auth.ts           # Cookie 管理 + 自动刷新
│   │   └── parser.ts         # 设计稿 JSON 解析 + 清洗
│   ├── transforms/
│   │   ├── classify.ts       # 元素分类
│   │   ├── prune.ts          # 图层树剪枝
│   │   └── to-unocss.ts      # 样式 → UnoCSS class 转换
│   └── utils/
│       ├── download.ts       # 切图下载 + 去重 + 命名
│       └── link-parser.ts    # 蓝湖 URL 解析
├── package.json
└── tsconfig.json
```

## 核心依赖

- `@modelcontextprotocol/sdk` — MCP 协议实现
- `playwright` — 自动登录 + 页面截图
- `axios` — HTTP 请求
- `zod` — 参数校验

## 参考实现

- `lanhu-developer-mcp`（TS）— API 调用方式、图片下载逻辑
- `lanhu-mcp-main`（Python）— 工具设计、图层解析、切图多倍率处理
