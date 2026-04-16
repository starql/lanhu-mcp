# LanHu MCP Server

蓝湖设计稿 MCP Server —— 让 AI 编码助手读懂蓝湖设计稿。

通过 [Model Context Protocol](https://modelcontextprotocol.io/) 将蓝湖设计稿的结构化数据、预览图和切图资源提供给 Claude Code 等 AI 工具，作为前端还原的参考资料。

## 功能

| 工具 | 说明 |
|------|------|
| `lanhu_login` | 登录蓝湖，自动管理 Cookie 生命周期 |
| `lanhu_resolve_link` | 解析蓝湖链接 / 邀请链接，提取项目参数 |
| `lanhu_get_design` | 获取设计稿结构化图层树（含 UnoCSS 原子类、元素分类、图片引用） |
| `lanhu_get_screenshot` | 通过 API 下载设计稿预览图 |
| `lanhu_download_slices` | 下载设计稿中标注的切图资源，自动分类命名 |

### 核心特性

- **结构化输出** — 将蓝湖 Sketch JSON 清洗为精简图层树，剔除不可见图层、标注图层、空容器
- **UnoCSS 原子类** — 直接从图层属性生成标准 UnoCSS class（宽高、圆角、背景色、字号、阴影等）
- **智能节点分类** — 自动识别 `text` / `image` / `icon` / `shape` / `container` 五种类型
- **切图自动分类** — 按尺寸分为 `bg`（背景图 ≥600px）、`icon`（图标 ≤128px）、`img`（普通图片），自动去重
- **Cookie 自动管理** — 过期时自动弹出浏览器引导登录，登录后持久化到本地
- **支持 Figma / Sketch 来源** — 自动检测设计稿来源，适配不同的切图识别逻辑

## 安装

```bash
npm install -g @starql/lanhu-mcp
```

首次运行需要安装 Playwright 浏览器（用于登录和解析邀请链接）：

```bash
npx playwright install chromium
```

### 系统要求

- Node.js >= 18

## 配置

在你的项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "lanhu": {
      "command": "lanhu-mcp"
    }
  }
}
```

也可以不全局安装，通过 npx 运行：

```json
{
  "mcpServers": {
    "lanhu": {
      "command": "npx",
      "args": ["@starql/lanhu-mcp"]
    }
  }
}
```

## 使用流程

```
蓝湖链接 → lanhu_get_design（结构数据）
         → lanhu_get_screenshot（预览图）
         → lanhu_download_slices（切图资源）
         → 展示参考资料给用户
         → 用户确认
         → 编写代码
```

### 1. 给出蓝湖链接

将 UI 设计师分享的蓝湖链接发给 Claude Code。以下是一些提示词示例：

**分析设计稿（仅获取参考数据）：**
> 帮我分析这个设计稿 https://lanhuapp.com/web/#/item/project/detailDetach?tid=xxx&pid=xxx&image_id=xxx

**分析并还原页面：**
> 根据这个蓝湖设计稿还原页面，技术栈用 Vue 3 + UnoCSS https://lanhuapp.com/web/#/item/...

**只下载切图：**
> 帮我下载这个设计稿的切图资源 https://lanhuapp.com/web/#/item/...

**分析多个设计稿：**
> 这个项目有多个页面，先列出所有设计图让我选 https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx

### 2. 自动登录

首次使用或 Cookie 过期时，会自动弹出浏览器窗口，手动扫码或输入密码登录蓝湖即可。登录成功后 Cookie 保存到 `~/.lanhu-mcp/cookie.json`，后续请求自动复用。

### 3. 获取参考数据

MCP 工具自动调用蓝湖 API，获取三类数据：

- **结构化图层树**（JSON）— 包含 UnoCSS class、节点类型、文本内容、图片引用
- **设计稿预览图** — 通过 API 下载的高清设计稿渲染图
- **切图资源** — 自动下载并按类型命名（icon-1.webp、img-1.webp、bg-1.webp）

### 4. 确认后实现

Claude Code 会将以上数据展示给你，等待确认后再编写前端代码。你可以在确认前修正 AI 对设计意图的理解。

## 产出物目录

所有 MCP 获取的资源默认保存在项目的 `page/lanhu-mcp-assets/` 目录下：

```
page/lanhu-mcp-assets/
├── designs/          # 结构化图层数据（JSON）
│   └── <imageId>.json
├── screenshots/      # 设计稿预览图
│   └── <imageId>.png
└── slices/           # 切图资源
    ├── icon-1.webp
    ├── img-1.webp
    └── bg-1.webp
```

## 项目结构

```
src/
├── index.ts              # MCP Server 入口
├── core/
│   ├── auth.ts           # Cookie 生命周期管理
│   ├── api.ts            # 蓝湖 API 客户端
│   └── parser.ts         # Sketch JSON 解析 & UnoCSS 生成
├── tools/
│   ├── login.ts          # lanhu_login 工具
│   ├── resolve-link.ts   # lanhu_resolve_link 工具
│   ├── get-design.ts     # lanhu_get_design 工具
│   ├── get-screenshot.ts # lanhu_get_screenshot 工具
│   └── download-slices.ts# lanhu_download_slices 工具
└── utils/
    ├── link-parser.ts    # URL 解析
    └── download.ts       # 切图下载 & 分类
```

## 开发

```bash
# 监听模式编译
pnpm dev

# 运行测试
pnpm test

# 监听模式测试
pnpm test:watch
```

## 技术栈

- TypeScript + Node.js
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP 协议实现
- [Playwright](https://playwright.dev/) — 浏览器自动化（登录 & 邀请链接解析）
- [Axios](https://axios-http.com/) — HTTP 请求
- [Zod](https://zod.dev/) — 参数校验
- [Vitest](https://vitest.dev/) — 单元测试

## 许可证

MIT

## 作者

**伽蓝** — [GitHub](https://github.com/starql)
