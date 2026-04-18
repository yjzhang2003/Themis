# Themis

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![INK](https://img.shields.io/badge/INK-5.x-cyan.svg)](https://github.com/vadimdemedes/ink)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Autonomous Task Management System for Claude Code**

*Per-task Isolation · Global Skill Library · Supervisor Loop · tmux Orchestration*

[中文](./README.md) · [Features](#features) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Contributing](#contributing)

</div>

---

## The Problem We Solve

Large language model-assisted development faces a core contradiction: **task persistence vs. context isolation**.

- When one Claude Code session runs dozens of tasks, contexts contaminate each other
- When switching tasks, skills, hooks, and rules cannot be reused
- When a session is interrupted, progress is lost with no way to resume
- When a task hangs, manual intervention is required to restart

**Themis**, named after the Greek goddess of justice and divine order, brings order to AI-driven development—establishing isolated execution spaces for each task and autonomously monitoring their lifecycles.

---

## Features

### Per-Task Isolation

Each task owns a dedicated `.claude/` directory:

```
task-001/
├── .claude/
│   ├── skills/      # Task-specific skills
│   ├── hooks/       # Task-specific hooks
│   └── rules/       # Task-specific rules
├── src/             # Task code
└── task.yaml       # Task metadata
```

The Launcher creates an isolated HOME directory under `/tmp` to prevent configuration pollution.

### Global Skill Library

Skills, hooks, and rules live in a global library—write once, use everywhere:

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

### Supervisor Autonomous Loop

Traditional task runners just "run"—Supervisor "watches":

- **Liveness Detection**: No output beyond threshold = hung
- **Auto-Restart**: Cooldown + max retries before queuing for human review
- **State Persistence**: Full context recovery after interruption

```
┌─────────────────────────────────────────────┐
│  SUPERVISOR LOOP                            │
│                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐│
│  │ Monitor │───▶│ Detector│───▶│ Executor ││
│  └────┬────┘    └────┬────┘    └────┬────┘│
│       │              │              │      │
│       └──────────────┴──────────────┘      │
│              State Feedback Loop            │
└─────────────────────────────────────────────┘
```

### tmux Session Orchestration

Tasks run in persistent tmux sessions:

- Continue running after SSH disconnect
- Full session log capture
- Attach/detach workflow
- API credentials merged automatically

### OpenSpec Integration

Tasks can bind to OpenSpec capabilities for traceable development:

```yaml
openspec:
  change: add-auth
  capability: auth-system
```

---

## Quick Start

### Install Dependencies

```bash
npm install
```

### Initialize Workspace

```bash
./bin/themis.js init
```

### Create a Task

```bash
./bin/themis.js new "User Authentication Module"
```

### Interactive Mode

```bash
./bin/themis.js        # Launch TUI
```

---

## Command Reference

### Workspace

```bash
themis init              # Initialize workspace
```

### Task Management

```bash
themis new <name>        # Create new task
themis list              # List all tasks
themis status [id]       # View task status
themis activate <id>     # Activate task (generate .claude/)
```

### Skill Management

```bash
themis skill add <name>            # Create skill
themis skill list                  # List all skills
themis skill link <id> [task-id]   # Link skill to task
themis skill unlink <id> [task-id] # Unlink skill
```

### Hook Management

```bash
themis hook add <name> <type> --command <cmd>  # Create hook
themis hook list                            # List all hooks
themis hook link <id> [task-id]           # Link hook
themis hook unlink <id> [task-id]         # Unlink hook
```

**Hook Types**: `PreToolUse`, `PostToolUse`, `Stop`

---

## Example Workflow

```bash
# Initialize
themis init

# Create skills and hooks
themis skill add tdd --description "Test-driven development"
themis hook add format PostToolUse --command "prettier --write" --matcher "Write|Edit"

# Create task and link resources
themis new "API Feature"
themis skill link tdd task-001
themis hook link format task-001
themis activate task-001
```

---

## Architecture

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

### Component Map

| Component | Responsibility |
|-----------|----------------|
| `cli/` | INK TUI and command interface |
| `task/` | Task store and metadata |
| `global-library/` | Global skills/hooks/rules |
| `openspec/` | OpenSpec proposal parsing |
| `supervisor/` | Autonomous monitoring loop |

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
| Package Manager | npm |

---

## Roadmap

- [x] Phase 1: Foundation - Basic CLI and task management
- [x] Phase 2: Skills/Hooks/Rules management
- [x] Phase 3: Interactive CLI (INK TUI)
- [x] Phase 3.5: Skill categorization, search, pagination
- [ ] Phase 4: OpenSpec integration
- [ ] Phase 5: 24×7 tmux sessions
- [ ] Phase 6: Supervisor auto-repair

---

## Contributing

Issues and Pull Requests are welcome!

1. Fork the repository
2. Create your branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

MIT License © 2026 Themis Team
