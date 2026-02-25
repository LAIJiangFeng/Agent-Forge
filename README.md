# Agent Forge ⚒️

> **Claude Code Skills & MCP 可视化管理工具**

Agent Forge 是一款专为 Claude Code 用户打造的桌面工具，用于可视化管理 **Skills（技能）** 和 **MCP（Model Context Protocol）** 配置，告别手动翻找目录和编辑 JSON 的烦恼。

## 解决了什么问题？

使用 Claude Code 时，Skills 和 MCP 配置散落在多个目录中，管理起来非常不便：

- 📂 Skills 文件（SKILL.md）分散在 `~/.claude/skills/`、项目 `.claude/skills/`、插件市场等多个位置
- 📝 MCP 配置（JSON）分布在 `~/.claude.json`、项目 `.mcp.json` 等不同层级
- 🔍 难以快速查看某个 Skill 的功能说明和使用命令
- ✏️ 编辑配置需要手动定位路径、用编辑器打开
- 🛒 发现和安装新的 Skills 需要手动从 GitHub 下载

**Agent Forge 将这些操作集中到一个统一的可视化界面中。**

## 功能特性

### 🎯 Skills 管理
- **自动扫描** 用户级、项目级、插件市场的所有 SKILL.md 文件
- **一键复制** 使用命令（`use skill: xxx` / `/skill-name`）
- **在线编辑** 内置 Monaco Editor，支持语法高亮和即时保存
- **Markdown 预览** 渲染 Skill 说明文档，功能点自动提取
- **翻译功能** 自动翻译英文 Skill 说明为中文

### 🛒 技能市场（SkillsMP）
- **在线搜索** 接入 [SkillsMP.com](https://skillsmp.com) 技能市场 API
- **AI 语义搜索** 支持自然语言描述需求，智能匹配技能
- **一键安装** 从 GitHub 自动下载 SKILL.md 并安装到本地
- **排序 & 分页** 按 Stars / 最近更新排序，支持翻页浏览

### 🔌 MCP 配置管理
- **多源扫描** 自动识别 `.claude.json`、`.mcp.json`、插件缓存中的所有 MCP 服务
- **健康检测** 自动检测各 MCP Server 的连接状态（绿色/红色指示灯）
- **启用/禁用** 一键切换 MCP Server 的启用状态
- **单服务编辑** 编辑时只显示选中 MCP Server 的配置 JSON，无需翻找整个文件
- **添加服务** 通过表单快速添加新的 MCP Server（Command / HTTP 类型）
- **JSON 导入** 粘贴 JSON 批量导入 MCP 配置
- **DXT 扩展安装** 支持 Desktop Extension (.dxt / .mcpb) 格式一键解析安装
- **Allowed Tools** 管理每个 MCP Server 的可用工具白名单
- **操作日志** 记录所有 MCP 管理操作的完整历史

### 📊 仪表盘
- Skills 和 MCP 数量总览
- 最近 Skills / MCP 卡片预览
- 快速跳转到管理面板

### ⚙️ 设置
- 自由配置 Skills 扫描路径
- 自由配置 MCP 配置文件路径
- 自由配置项目根目录
- SkillsMP API Key 配置

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 生产预览

```bash
npm run start
```

### 构建安装包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron + electron-vite |
| 前端 | Vue 3 (Composition API) + TypeScript |
| 样式 | Tailwind CSS |
| 编辑器 | Monaco Editor (vue-monaco-editor) |
| Markdown | marked + DOMPurify |
| 代码规范 | ESLint + Prettier |

## 项目结构

```
Agent-Forge/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts              # 入口 & IPC 注册 & 安全校验
│   │   └── services/             # 业务服务
│   │       ├── skillsService.ts           # Skills 扫描/读写
│   │       ├── skillsMarketplaceService.ts # SkillsMP 市场 API
│   │       ├── mcpService.ts              # MCP 配置管理 & 健康检测
│   │       ├── mcpLogService.ts           # MCP 操作日志
│   │       ├── dxtService.ts              # DXT 扩展解析/安装
│   │       └── translateService.ts        # 翻译服务
│   ├── preload/                  # 预加载脚本（安全桥接 API）
│   │   ├── index.ts              # contextBridge 暴露 API
│   │   └── index.d.ts            # 类型声明
│   └── renderer/                 # 渲染进程（Vue 前端）
│       └── src/
│           ├── App.vue            # 路由调度
│           ├── components/
│           │   ├── Sidebar.vue          # 侧边导航
│           │   ├── DashboardView.vue    # 仪表盘
│           │   ├── SkillsPanel.vue      # Skills 管理面板
│           │   ├── McpPanel.vue         # MCP 管理主面板
│           │   ├── SettingsPanel.vue     # 设置
│           │   └── mcp/                 # MCP 子组件
│           │       ├── types.ts          # 共享类型定义
│           │       ├── useMcpPanel.ts    # 组合式函数（状态 & 逻辑）
│           │       └── McpServerList.vue  # 服务列表组件
│           └── assets/
│               └── main.css
├── config.json                   # 用户配置（扫描路径）
├── eslint.config.mjs
├── tailwind.config.js
└── electron-builder.yml
```

## 安全设计

- **沙箱隔离** 渲染进程运行在 `sandbox: true` + `contextIsolation: true` 环境
- **路径白名单** 所有文件读写操作均通过路径白名单校验
- **协议限制** 外部链接仅允许 `http:` / `https:` 协议
- **DXT 审批流** DXT 文件必须通过文件对话框选择后才能解析/安装
- **输入净化** 所有用户输入经过 sanitize 处理，防止配置注入

## 许可证

MIT
