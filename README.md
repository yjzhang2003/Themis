# Themis

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![INK](https://img.shields.io/badge/INK-5.x-cyan.svg)](https://github.com/vadimdemedes/ink)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**面向 Claude Code 的自主任务管理系统**

*Per-task 隔离 · 全局技能库 · Supervisor 自主监控 · tmux 会话编排*

[English](./README_EN.md) · [特性](#核心特性) · [快速开始](#快速开始) · [架构](#架构) · [贡献](#贡献)

</div>

---

## 解决的问题

大型语言模型辅助开发面临一个核心矛盾：**任务持久化与上下文隔离**。

- 当一个 Claude Code 会话运行数十个任务时，上下文相互污染
- 当任务切换时，技能、钩子、规则无法复用
- 当会话中断时，进度丢失，无法续恢复
- 当任务卡死时，需要人工干预才能重启

**Themis** 以古希腊正义女神命名，取其"秩序"与"裁决"之意——为每个任务建立独立的执行空间，自主监控其生命周期，让 AI 开发流持续运转。

---

## 核心特性

### Per-Task 隔离空间

每个任务拥有独立的 `.claude/` 目录，包含：

```
task-001/
├── .claude/
│   ├── skills/      # 任务专属技能
│   ├── hooks/      # 任务专属钩子
│   └── rules/      # 任务专属规则
├── src/            # 任务代码
└── task.yaml       # 任务元数据
```

Launcher 为每个任务在 `/tmp` 下创建隔离的 HOME 目录，防止配置污染。

### 全局技能库

技能、钩子、规则存储在全局库中，一次编写，处处复用：

```
~/.claude/
├── skills/
│   ├── tdd/
│   ├── security-review/
│   └── backend-patterns/
├── hooks/
│   ├── format-on-save/
│   └── lint-check/
└── rules/
```

### Supervisor 自主监控

传统任务运行器只是"跑"，Supervisor 是"看"：

- **活跃度检测**：超过阈值无输出即判定为卡死
- **自动重启**：冷却期 + 最大重试次数后进入人工审核队列
- **状态持久化**：会话中断可完整恢复上下文

```
┌─────────────────────────────────────────────┐
│  SUPERVISOR LOOP                            │
│                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ Monitor │───▶│ Detector│───▶│ Executor│ │
│  └────┬────┘    └────┬────┘    └────┬────┘ │
│       │              │              │       │
│       └──────────────┴──────────────┘       │
│              状态反馈循环                     │
└─────────────────────────────────────────────┘
```

### tmux 会话编排

任务运行在持久化的 tmux 会话中：

- 断开 SSH 后任务继续运行
- 会话日志完整捕获
- 支持 attach/detach 切换
- API 凭据自动合并

### OpenSpec 集成

任务可绑定到 OpenSpec capability，形成可追溯的开发链路：

```yaml
openspec:
  change: add-auth
  capability: auth-system
```

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化工作区

```bash
./bin/themis.js init
```

### 创建任务

```bash
./bin/themis.js new "用户认证模块"
```

### 交互式操作

```bash
./bin/themis.js        # 启动 TUI 界面
```

---

## 命令参考

### 工作区

```bash
themis init              # 初始化工作区
```

### 任务管理

```bash
themis new <name>        # 创建新任务
themis list              # 列出所有任务
themis status [id]       # 查看任务状态
themis activate <id>     # 激活任务（生成 .claude/）
```

### 技能管理

```bash
themis skill add <name>            # 创建技能
themis skill list                  # 列出所有技能
themis skill link <id> [task-id]   # 绑定技能到任务
themis skill unlink <id> [task-id] # 解绑技能
```

### 钩子管理

```bash
themis hook add <name> <type> --command <cmd>  # 创建钩子
themis hook list                            # 列出所有钩子
themis hook link <id> [task-id]           # 绑定钩子
themis hook unlink <id> [task-id]         # 解绑钩子
```

**钩子类型**：`PreToolUse`, `PostToolUse`, `Stop`

---

## 示例工作流

```bash
# 初始化
themis init

# 创建技能和钩子
themis skill add tdd --description "Test-driven development"
themis hook add format PostToolUse --command "prettier --write" --matcher "Write|Edit"

# 创建任务并绑定
themis new "API Feature"
themis skill link tdd task-001
themis hook link format task-001
themis activate task-001
```

---

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                         THEMIS                              │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Interactive │  │   Command   │  │ Supervisor  │        │
│  │      TUI     │  │     CLI     │  │    Loop     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                 │                 │               │
│  ┌──────┴─────────────────┴─────────────────┴──────┐        │
│  │                   CLI Core                     │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │        │
│  │  │   Task   │  │ GlobalLibrary│ │ OpenSpec │   │        │
│  │  │  Store   │  │   Store     │  │ Scanner  │   │        │
│  │  └──────────┘  └──────────┘  └──────────┘   │        │
│  └───────────────────────┬─────────────────────┘        │
│                          │                                │
│  ┌───────────────────────┴─────────────────────┐        │
│  │              Task Launcher                   │        │
│  │  ┌─────────────┐      ┌─────────────┐      │        │
│  │  │   tmux      │      │  Isolated   │      │        │
│  │  │  Session    │      │   HOME dir  │      │        │
│  │  └─────────────┘      └─────────────┘      │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 组件说明

| 组件 | 职责 |
|------|------|
| `cli/` | INK TUI 和命令行接口 |
| `task/` | 任务存储和元数据管理 |
| `global-library/` | 全局技能/钩子/规则库 |
| `openspec/` | OpenSpec 提案解析和绑定 |
| `supervisor/` | 自主监控循环和任务重启 |

---

## 文件结构

```
themis/
├── bin/
│   └── themis.js           # CLI 入口
├── src/
│   ├── cli/
│   │   ├── commands/       # 命令模式实现
│   │   ├── ui/            # INK UI 组件
│   │   ├── context.tsx    # React Context
│   │   └── index.tsx      # 主入口
│   ├── task/              # 任务管理
│   ├── global-library/    # 全局库
│   ├── openspec/          # OpenSpec 集成
│   └── supervisor/        # 自主监控
├── tasks/                  # 任务工作区
├── library/                # 共享资源库
│   ├── skills/
│   ├── hooks/
│   └── rules/
└── package.json
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js 20+ |
| CLI UI | INK 5.x (React for Terminal) |
| 语言 | TypeScript 5.7 |
| 数据验证 | Zod 3.24 |
| 会话管理 | tmux |
| 测试 | Vitest 4.1 |
| 包管理 | npm |

---

## 路线图

- [x] Phase 1: 基础 CLI 和任务管理
- [x] Phase 2: Skills/Hooks/Rules 管理
- [x] Phase 3: 交互式 CLI (INK TUI)
- [x] Phase 3.5: 技能分类、搜索、分页
- [ ] Phase 4: OpenSpec 集成
- [ ] Phase 5: 24×7 tmux 会话
- [ ] Phase 6: Supervisor 自动修复

---

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing`)
5. 创建 Pull Request

---

## 许可证

MIT License © 2026 Themis Team
