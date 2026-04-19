# Themis

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![INK](https://img.shields.io/badge/INK-5.x-cyan.svg)](https://github.com/vadimdemedes/ink)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[English](./README.md)**

</div>

---

## 概述

Themis 是一个任务管理系统，在隔离的 tmux 环境中运行 Claude Code 会话，并支持共享技能库。

**核心功能**：技能管理与基于 tmux 的任务隔离。

---

## 功能

### tmux 会话管理

任务运行在持久化的 tmux 会话中：

- 会话在终端断开后继续运行
- 完整的会话日志，支持 attach/detach 切换
- 每个任务有独立的隔离 HOME 目录（`/tmp/.themis-{taskId}-home`）
- 自动从全局配置合并 API 凭据

### 全局技能库

技能、钩子、规则存储在共享库中，一次编写，处处复用：

```
~/.themis/
├── skills/              # 通用技能（兼容 Claude Code 和 Codex）
├── hooks/               # Claude Code 和 Codex 的钩子
├── rules/               # 编码规则
└── suites.json          # 技能套件定义
```

### 通用技能

通用技能同时支持 Claude Code 和 Codex。创建任务时，Themis 会根据选择的 provider 过滤技能：

- **Claude Code 技能**：存储在 `~/.claude/skills/`
- **Codex 技能**：存储在 `~/.codex/skills/`
- **通用技能**：存储在 `~/.themis/skills/` — 兼容两种 provider

### 技能套件

将多个技能打包以便快速设置任务：

```json
{
  "suites": [{
    "id": "web-fullstack",
    "name": "Web 全栈",
    "skills": [
      { "id": "react-patterns", "provider": "universal" },
      { "id": "tdd", "provider": "claude" }
    ]
  }]
}
```

---

## 安装

```bash
npm install -g @themis/themis
```

或从源码安装：

```bash
git clone <repository>
cd themis
npm install
npm run build
npm link
```

**依赖**：Node.js 20+，tmux

---

## 快速开始

### 初始化

```bash
themis init
```

### 创建任务

```bash
themis new "用户认证模块"
themis task activate task-001
```

### 交互模式

```bash
themis
```

---

## 命令参考

### 任务管理

```bash
themis task new <name>        # 创建新任务
themis task list              # 列出所有任务
themis task status [id]       # 查看任务状态
themis task activate <id>     # 激活任务（生成 .claude/）
themis task delete <id>       # 删除任务
```

### 技能管理

```bash
themis skill add <name>            # 创建技能
themis skill list                  # 列出所有技能
themis skill link <id> [task-id]  # 绑定技能到任务
themis skill unlink <id> [task-id] # 解绑技能
```

### 钩子管理

```bash
themis hook add <name> <type> --command <cmd>  # 创建钩子
themis hook list                            # 列出所有钩子
themis hook link <id> [task-id]            # 绑定钩子
themis hook unlink <id> [task-id]          # 解绑钩子
```

**钩子类型**：`PreToolUse`、`PostToolUse`、`Stop`、`SessionStart`、`SessionEnd`、`PreCompact`

### 套件管理

```bash
themis suite list                # 列出所有技能套件
themis suite add <name>          # 创建新套件
themis suite delete <id>        # 删除套件
themis suite apply <id> [task]  # 应用套件到任务
```

### 库管理

```bash
themis library list              # 列出通用技能
themis library add <path>        # 添加技能到通用库
themis library remove <id>      # 从通用库移除
themis library promote <id>     # 将 Claude Code 技能提升为通用
```

### 会话管理

```bash
themis takeover <task-id>        # 附加到任务 tmux 会话
themis session list             # 列出所有 tmux 会话
```

---

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                         THEMIS                              │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │  交互式    │  │   命令行    │                          │
│  │     TUI     │  │     CLI     │                          │
│  └──────┬──────┘  └──────┬──────┘                          │
│         │                 │                                   │
│  ┌──────┴─────────────────┴──────┐                          │
│  │            CLI 核心              │                          │
│  │  ┌──────────┐  ┌──────────┐   │                          │
│  │  │   Task   │  │GlobalLibrary│ │                          │
│  │  │  Store   │  │   Store     │ │                          │
│  │  └──────────┘  └──────────┘   │                          │
│  └────────────────────────────────┘                          │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐          │
│  │              Task Launcher                     │          │
│  │  ┌─────────────┐      ┌─────────────┐        │          │
│  │  │   tmux     │      │  隔离的    │        │          │
│  │  │  Session   │      │  HOME 目录 │        │          │
│  │  └─────────────┘      └─────────────┘        │          │
│  └───────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
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

---

## 许可证

MIT License © 2026 Themis Team
