# Claude Code Task Management System - Implementation Plan

## 1. System Overview

**Purpose**: A system for managing Claude Code tasks with per-task `.claude/` directories (skills, hooks, rules), OpenSpec integration, 24*7 terminal operation, and a Supervisor for autonomous monitoring.

**Core Philosophy**: Fluid, iterative, self-contained task management that binds to OpenSpec capabilities.

---

## 2. Architecture

```
thsHarness/                          # Root workspace
├── tasks/                            # All task folders
│   ├── task-001-add-auth/           # Individual task
│   │   ├── .claude/                 # Task-specific Claude config
│   │   │   ├── skills/              # Task skills
│   │   │   ├── hooks/                # Task hooks (settings.json)
│   │   │   └── rules/                # Task rules (overrides)
│   │   ├── src/                      # Task deliverables
│   │   ├── task.yaml                 # Task metadata
│   │   └── status.md                 # Task status tracking
│   └── task-002-fix-cache/
├── library/                          # Shared skill/hook/rule library
│   ├── skills/
│   ├── hooks/
│   └── rules/
├── .claude/                          # Global Claude config (outer)
│   └── settings.json
└── supervisor/                       # Supervisor Claude Code (FUTURE)
```

---

## 3. Data Model

### 3.1 Task Metadata (`task.yaml`)

```yaml
id: task-001
name: Add authentication
status: in_progress | completed | blocked | paused
openspec:
  change: add-auth                   # Bound to openspec/changes/add-auth/
  capability: auth-system             # OpenSpec capability
created_at: 2026-04-16T10:00:00Z
updated_at: 2026-04-16T12:30:00Z
assignee: claude-code
skills:
  - skill: tdd
    version: "1.0"
  - skill: security-review
    version: "2.0"
hooks:
  PostToolUse:
    - format-on-save
    - lint-check
rules:
  - coding-standards
  - auth-rules
```

### 3.2 OpenSpec Capability Binding

Each task maps to an OpenSpec capability from `proposal.md`:

```yaml
openspec:
  change: add-auth
  capability: auth-system
  # Derived from openspec/changes/add-auth/proposal.md:
  # ## Capabilities
  # ### New Capabilities
  # - `auth-system`: Authentication and session management
```

---

## 4. Core Components

### 4.1 Task Manager CLI (`th-cli`)

Commands:
- `th-cli init` - Initialize workspace
- `th-cli new <name>` - Create new task
- `th-cli list` - List all tasks
- `th-cli status <task-id>` - Show task status
- `th-cli bind <task-id> <openspec-change>` - Bind to OpenSpec change
- `th-cli activate <task-id>` - Activate task (set up .claude/ in current dir)
- `th-cli deactivate` - Deactivate current task
- `th-cli skill add <skill-name> [--lib | --new]` - Add skill
- `th-cli skill list` - List available skills
- `th-cli hook set <hook-type> <hook-name>` - Configure hook
- `th-cli rule enable <rule-name>` - Enable rule
- `th-cli run <task-id>` - Start task in terminal session

### 4.2 Task Activation System

When `th-cli activate <task-id>` is called:
1. Copies task's `.claude/` to current working directory
2. Sets environment variables for task context
3. Initializes tmux/screen session if not exists
4. Updates task status to `in_progress`

### 4.3 Skill Library

```
library/skills/
├── tdd/
│   ├── skill.md
│   ├── prompts/
│   └── tests/
├── security-review/
│   ├── skill.md
│   └── patterns/
└── <custom>/
```

**Skill Structure**:
```markdown
# TDD Skill

## Triggers
- New feature implementation
- Bug fix
- Refactoring

## Workflow
1. Write test first (RED)
2. Implement to pass (GREEN)
3. Refactor (IMPROVE)

## Commands
- /test:run
- /test:coverage

## Configuration
test_framework: vitest
coverage_target: 80%
```

### 4.4 Hook Configuration

Hooks stored as JSON snippets that get merged into `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "pnpm prettier --write \"$FILE_PATH\"",
        "description": "Format on save"
      }
    ]
  }
}
```

### 4.5 Rules System

Per-task rule overrides in `tasks/<task-id>/.claude/rules/`:
- `local/rules/common/coding-style.md` - Task-specific coding style
- `local/rules/typescript/coding-style.md` - TypeScript overrides

---

## 5. OpenSpec Integration

### 5.1 Capability Discovery

```bash
# Scan OpenSpec changes for capabilities
th-cli openspec scan --path /path/to/project

# Output:
# add-auth: auth-system
# add-dark-mode: theme-toggle
# fix-cache: cache-invalidation
```

### 5.2 Task Binding

When binding a task to an OpenSpec change:
1. Parse `proposal.md` for `## Capabilities`
2. Extract capability names
3. Store in `task.yaml`
4. Link to `openspec/changes/<change>/`

### 5.3 Progress Sync

Task progress updates OpenSpec `tasks.md`:
```markdown
## 1. Authentication
- [x] 1.1 Add JWT middleware
- [ ] 1.2 Implement login endpoint
```

---

## 6. 24*7 Operation Design

### 6.1 Session Management

- Tasks run in persistent tmux/screen sessions
- Session name format: `task-<task-id>`
- Auto-save context on interrupt
- Resume capability after disconnection

### 6.2 Status Persistence

```
tasks/<task-id>/.claude/state/
├── session.log        # Full session transcript
├── checkpoint.json    # Last known state
└── artifacts/         # Generated artifacts
```

### 6.3 Graceful Interruption Handling

1. On SIGINT: Save checkpoint, pause task
2. On SIGTERM: Clean shutdown, archive session
3. On reconnect: Offer resume or review checkpoint

---

## 7. Supervisor Design (FUTURE - Do Not Implement)

> **NOTE**: This section describes the Supervisor feature which is out of scope for current implementation. Design only.

### 7.1 Purpose
Outer Claude Code that monitors task completion and can auto-fix skill/hook issues.

### 7.2 Architecture

```
thsHarness/                          # Outer workspace (Supervisor lives here)
├── supervisor/
│   ├── .claude/                     # Supervisor's own config
│   │   ├── skills/
│   │   │   ├── task-monitor.skill.md
│   │   │   └── skill-updater.skill.md
│   │   └── rules/
│   └── supervisor.md               # Supervisor instructions
└── tasks/                           # Same tasks directory
```

### 7.3 Monitored Events

- Task status changes
- Session interruptions
- Skill/hook failures
- OpenSpec capability completion

### 7.4 Auto-Repair Logic

1. Detect failure in task session
2. Analyze error (skill missing? hook broken? rule conflict?)
3. Search library for fix or fetch from internet
4. Update task's `.claude/` accordingly
5. Notify and offer retry

### 7.5 Skills Needed (Future)

- `task-monitor`: Watch task sessions, detect failures
- `skill-updater`: Find, evaluate, and install new skills
- `openspec-sync`: Sync task progress with OpenSpec

---

## 8. File Structure

```
thsHarness/
├── bin/
│   └── th-cli                    # CLI entry point
├── src/
│   ├── cli/                      # CLI commands
│   ├── task/                     # Task operations
│   ├── openspec/                 # OpenSpec integration
│   ├── skills/                   # Skill management
│   ├── hooks/                    # Hook management
│   └── rules/                    # Rules management
├── library/                      # Shared resources
│   ├── skills/
│   ├── hooks/
│   └── rules/
├── tasks/                        # Task workspaces
└── package.json
```

---

## 9. Implementation Phases

### Phase 1: Foundation
- [ ] Project structure setup
- [ ] Basic CLI (`init`, `new`, `list`, `status`)
- [ ] Task folder generation with `.claude/`
- [ ] Basic task.yaml schema

### Phase 2: Skills/Hooks/Rules Management
- [x] Skill library structure
- [x] `skill add/list/link/unlink` commands
- [x] Hook configuration system
- [x] `hook add/list/link/unlink` commands
- [ ] Rule override system (basic)

### Phase 3: OpenSpec Integration
- [ ] OpenSpec change scanning
- [ ] Task binding to changes
- [ ] Capability extraction
- [ ] Progress sync

### Phase 4: 24*7 Operation
- [ ] tmux session management
- [ ] Status persistence
- [ ] Graceful interruption handling
- [ ] Session resume capability

### Phase 5: Supervisor (FUTURE)
- [ ] Supervisor architecture design
- [ ] Task monitoring skill
- [ ] Auto-repair logic
- [ ] Skill updater skill

---

## 10. Dependencies

- **Node.js 20+**: CLI runtime
- **INK**: React for CLI (interactive terminal UI)
- **tmux** or **screen**: Terminal session management
- **OpenSpec**: Project specification framework (installed separately)
- **yaml**: Task metadata parsing
- **@oclif/core** or similar for CLI framework

---

## 11. Out of Scope (v1)

- Multi-user support
- Cloud sync
- Web UI
- Supervisor auto-repair (Phase 5)
