# Themis

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![INK](https://img.shields.io/badge/INK-5.x-cyan.svg)](https://github.com/vadimdemedes/ink)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Development-orange.svg)]()

**[简体中文](./README_zh.md)** · ⚠️ In Development · Not Ready for Production

</div>

---

## Project Status

**Themis is still in active development and is NOT stable. Do NOT use in production.**

### Implemented ✅

Core features for task isolation and skill management:

- **Per-task `.claude/`/`.codex/` isolation**: Each task has its own Claude Code or Codex config directory
- **Global Skills/Hooks library**: Skills and Hooks managed in global library can be bound to any task
- **Universal Skills**: Skills that work with both Claude Code and Codex, stored in a unified library
- **Skill Suites**: Bundle multiple skills and apply them to tasks in one click
- **Provider Selection**: Choose between Claude Code and Codex when creating tasks
- **Basic CLI**: INK TUI interface and command-line tool

### In Development 🔨

The following features are being developed:

- Deep OpenSpec integration (auto-binding tasks to project specifications)
- Hooks in Skill Suites (CC/Codex formats differ, deferred)
- Automatic task parsing (auto-plan execution steps from task description)
- Skills/Hooks categorized loading (intelligent loading based on task type)

### Planned 📋

The following features are on the roadmap, not yet started:

- **Multi-CLI collaboration**: Support Claude Code, Codex, and other CLIs working together
- **Full Supervisor**: Automated task monitoring, auto-repair, human review queue
- **24×7 tmux sessions**: Persistent operation, reconnect on disconnect, cross-session context recovery

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
~/.themis/
├── skills/              # Universal skills (Claude Code + Codex compatible)
├── hooks/               # Hooks for Claude Code and Codex
├── rules/               # Coding rules
└── suites.json          # Skill suite definitions
```

### Universal Skills

Universal skills work with both Claude Code and Codex. When you create a task, Themis automatically filters skills based on the selected provider:

- **Claude Code skills**: Stored in `~/.claude/skills/`
- **Codex skills**: Stored in `~/.codex/skills/`
- **Universal skills**: Stored in `~/.themis/skills/` and work with both providers

### Skill Suites

Skill Suites let you bundle a curated set of skills for quick task setup:

```
~/.themis/suites.json
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

When creating a task, you can:
1. **Use a Suite**: Select a pre-defined skill bundle
2. **No Suite**: Start with default settings
3. **Add skills later**: Link individual skills from the global library

Suite skills are filtered by provider—only skills matching the task's provider (or universal skills) are applied.

### Supervisor Autonomous Loop (In Development)

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
│              State Feedback Loop (WIP)      │
└─────────────────────────────────────────────┘
```

### tmux Session Orchestration (Planned)

Tasks run in persistent tmux sessions:

- Continue running after SSH disconnect
- Full session log capture
- Attach/detach workflow
- API credentials merged automatically

### OpenSpec Integration (Planned)

Tasks can bind to OpenSpec capabilities for traceable development:

```yaml
openspec:
  change: add-auth
  capability: auth-system
```

---

## Quick Start

> ⚠️ **For Testing Only**: This project is in development. If you're not a contributor or tester, please wait for a stable release.

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

### Suite Management

```bash
themis suite list                # List all skill suites
themis suite add <name>          # Create a new suite
themis suite delete <id>         # Delete a suite
themis suite apply <id> [task]   # Apply suite to a task
```

**Note**: Suites are applied at task creation time for new tasks, or via the TUI for existing tasks.

### Library Management

```bash
themis library list              # List universal skills
themis library add <path>        # Add a skill to universal library
themis library remove <id>       # Remove a skill
themis library promote <id>      # Promote Claude Code skill to universal
```

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

| Component | Status | Responsibility |
|-----------|--------|----------------|
| `cli/` | ✅ Done | INK TUI and command interface |
| `task/` | ✅ Done | Task store and metadata |
| `suite/` | ✅ Done | Skill suite CRUD and application |
| `global-library/` | ✅ Done | Global skills/hooks/rules with universal support |
| `openspec/` | 🔨 WIP | OpenSpec proposal parsing |
| `supervisor/` | 📋 Planned | Autonomous monitoring loop |

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

### Implemented

- [x] Per-task `.claude/`/`.codex/` isolation
- [x] Global Skills/Hooks/Rules library
- [x] Universal skills (cross-provider)
- [x] Skill Suites
- [x] Provider selection (Claude Code / Codex)
- [x] Basic CLI (TUI + command-line)

### In Development

- [ ] Deep OpenSpec integration
- [ ] Hooks in Skill Suites
- [ ] Automatic task parsing
- [ ] Skills/Hooks categorized loading

### Planned

- [ ] Multi-CLI collaboration
- [ ] Full Supervisor
- [ ] 24×7 tmux sessions

---

## Contributing

Contributions welcome, but note:

1. This project is in rapid iteration; API may have breaking changes
2. Please open an Issue to discuss major changes first
3. PRs should include adequate tests

1. Fork the repository
2. Create your branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

MIT License © 2026 Themis Team
