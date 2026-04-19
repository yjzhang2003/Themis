# Themis

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![INK](https://img.shields.io/badge/INK-5.x-cyan.svg)](https://github.com/vadimdemedes/ink)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[简体中文](./README_zh.md)**

</div>

---

## Overview

Themis is a task management system that runs Claude Code sessions in isolated tmux environments with shared skill libraries.

**Core focus**: Skill management and tmux-based task isolation.

---

## Features

### tmux Session Management

Tasks run in persistent tmux sessions:

- Sessions persist after terminal disconnect
- Full session log capture with attach/detach workflow
- Per-task isolated HOME directory (`/tmp/.themis-{taskId}-home`)
- Automatic API credential merging from global config

### Global Skill Library

Skills, hooks, and rules live in a shared library — write once, use everywhere:

```
~/.themis/
├── skills/              # Universal skills (Claude Code + Codex compatible)
├── hooks/               # Hooks for Claude Code and Codex
├── rules/               # Coding rules
└── suites.json          # Skill suite definitions
```

### Universal Skills

Universal skills work with both Claude Code and Codex. When creating a task, Themis filters skills based on the selected provider:

- **Claude Code skills**: Stored in `~/.claude/skills/`
- **Codex skills**: Stored in `~/.codex/skills/`
- **Universal skills**: Stored in `~/.themis/skills/` — work with both providers

### Skill Suites

Bundle multiple skills for quick task setup:

```json
{
  "suites": [{
    "id": "web-fullstack",
    "name": "Web Full-Stack",
    "skills": [
      { "id": "react-patterns", "provider": "universal" },
      { "id": "tdd", "provider": "claude" }
    ]
  }]
}
```

---

## Installation

```bash
npm install -g @themis/themis
```

Or install from source:

```bash
git clone <repository>
cd themis
npm install
npm run build
npm link
```

**Requirements**: Node.js 20+, tmux

---

## Quick Start

### Initialize

```bash
themis init
```

### Create a Task

```bash
themis new "User Authentication Module"
themis task activate task-001
```

### Interactive Mode

```bash
themis
```

---

## Command Reference

### Task Management

```bash
themis task new <name>        # Create new task
themis task list              # List all tasks
themis task status [id]       # View task status
themis task activate <id>     # Activate task (generate .claude/)
themis task delete <id>       # Delete a task
```

### Skill Management

```bash
themis skill add <name>            # Create skill
themis skill list                  # List all skills
themis skill link <id> [task-id]  # Link skill to task
themis skill unlink <id> [task-id] # Unlink skill
```

### Hook Management

```bash
themis hook add <name> <type> --command <cmd>  # Create hook
themis hook list                            # List all hooks
themis hook link <id> [task-id]            # Link hook
themis hook unlink <id> [task-id]          # Unlink hook
```

**Hook Types**: `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `PreCompact`

### Suite Management

```bash
themis suite list                # List all skill suites
themis suite add <name>          # Create a new suite
themis suite delete <id>         # Delete a suite
themis suite apply <id> [task]   # Apply suite to a task
```

### Library Management

```bash
themis library list              # List universal skills
themis library add <path>        # Add a skill to universal library
themis library remove <id>      # Remove a skill
themis library promote <id>     # Promote Claude Code skill to universal
```

### Session Management

```bash
themis takeover <task-id>        # Attach to task tmux session
themis session list             # List all tmux sessions
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         THEMIS                              │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │  Interactive │  │   Command   │                          │
│  │      TUI     │  │     CLI     │                          │
│  └──────┬──────┘  └──────┬──────┘                          │
│         │                 │                                   │
│  ┌──────┴─────────────────┴──────┐                          │
│  │            CLI Core            │                          │
│  │  ┌──────────┐  ┌──────────┐   │                          │
│  │  │   Task   │  │GlobalLibrary│ │                          │
│  │  │  Store   │  │   Store     │ │                          │
│  │  └──────────┘  └──────────┘   │                          │
│  └────────────────────────────────┘                          │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐          │
│  │              Task Launcher                     │          │
│  │  ┌─────────────┐      ┌─────────────┐        │          │
│  │  │   tmux      │      │  Isolated   │        │          │
│  │  │  Session    │      │   HOME dir  │        │          │
│  │  └─────────────┘      └─────────────┘        │          │
│  └───────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| CLI UI | INK 5.x (React for Terminal) |
| Language | TypeScript 5.7 |
| Data Validation | Zod 3.24 |
| Session Management | tmux |
| Testing | Vitest 4.1 |

---

## License

MIT License © 2026 Themis Team
