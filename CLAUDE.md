# LanHu MCP 工作流指南

## 技术栈
- Vue 3 + `<script setup>` + TypeScript
- UnoCSS 标准原子类（不使用项目级 shortcuts）
- 移动端 H5（375px 设计稿宽度）

## LanHu MCP 工具使用规范

本项目提供了一组蓝湖 MCP 工具，用于从蓝湖设计稿获取**参考数据**。

### 核心原则：MCP 提供参考，人工确认后再实现

MCP 工具返回的数据是**参考资料**，不应该直接当作最终实现。正确的工作流是：

1. **获取数据** — 使用 `lanhu_get_design` 获取结构化图层树（含 UnoCSS class）
2. **获取截图** — 使用 `lanhu_get_screenshot` 获取设计稿截图用于视觉参考
3. **下载切图** — 使用 `lanhu_download_slices` 下载标注的切图资源
4. **展示给用户** — 将获取到的数据、截图和切图信息**展示给用户**，说明你的理解
5. **等待确认** — 等用户确认后，再根据参考数据编写代码

### 禁止行为
- **不要**在获取 MCP 数据后直接开始写代码
- **不要**跳过展示参考数据的步骤
- **不要**假设用户希望你直接实现整个页面

### 工具说明
- `lanhu_login` — 登录蓝湖（Cookie 过期时自动触发）
- `lanhu_resolve_link` — 解析蓝湖链接，获取项目和设计图参数
- `lanhu_get_design` — 获取清洗后的结构化图层树（UnoCSS class + 元素类型）
- `lanhu_get_screenshot` — 截取设计稿页面截图
- `lanhu_download_slices` — 下载设计稿中标注的切图资源
