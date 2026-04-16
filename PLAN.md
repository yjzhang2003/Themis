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
│   │   │   ├── hooks/               # Task hooks (settings.json)
│   │   │   └── rules/               # Task rules (overrides)
│   │   ├── src/                     # Task deliverables
│   │   ├── task.yaml                # Task metadata
│   │   └── status.md                # Task status tracking
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
  change: add-auth
  capability: auth-system
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
```

---

## 4. Core Components

### 4.1 Task Manager CLI (`th`)

Two modes:
1. **Interactive Mode** (default): Full-screen menu navigation
2. **Command Mode**: One-shot commands via arguments

**Command Mode Commands:**
```bash
th init              # Initialize workspace
th new <name>       # Create new task
th list             # List all tasks
th status [id]      # Show task status
th skill add <name>  # Create skill
th skill list       # List skills
th skill link <id>  # Link skill to task
th hook add <name>  # Create hook
th hook list        # List hooks
th hook link <id>   # Link hook to task
th activate <id>     # Activate task
```

### 4.2 Interactive CLI Design

Using INK's `useInput` hook for keyboard navigation.

**Main Menu:**
```
┌─────────────────────────────────────────┐
│  TASK HARNESS                           │
│                                         │
│  ▶ Tasks                                │
│    Skills                               │
│    Hooks                                │
│    OpenSpec                             │
│    Settings                             │
│                                         │
│  [↑↓] Navigate  [Enter] Select  [q] Quit│
└─────────────────────────────────────────┘
```

**Tasks Submenu:**
```
┌─────────────────────────────────────────┐
│  TASKS                        [←] Back  │
│                                         │
│  + New Task                             │
│                                         │
│  ● task-001  API Feature      [paused]  │
│    task-002  Auth System       [active]  │
│    task-003  Cache Fix         [blocked] │
│                                         │
│  [↑↓] Navigate  [Enter] Select  [q] Quit│
└─────────────────────────────────────────┘
```

**Task Detail View:**
```
┌─────────────────────────────────────────┐
│  TASK-001: API Feature      [active]   │
│                                         │
│  Status: in_progress                   │
│  Created: 2026-04-16                   │
│  Skills: tdd, security-review            │
│  Hooks: format-on-save                  │
│                                         │
│  ▶ Activate / Deactivate                │
│    Edit Details                         │
│    Manage Skills                        │
│    Manage Hooks                         │
│    View OpenSpec Binding                │
│    Delete Task                          │
│                                         │
│  [↑↓] Navigate  [Enter] Select  [q] Quit│
└─────────────────────────────────────────┘
```

### 4.3 Skill Library

```
library/skills/
├── tdd/
│   └── skill.md
├── security-review/
│   └── skill.md
└── <custom>/
```

### 4.4 Hook Configuration

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "prettier --write \"$FILE_PATH\"",
        "description": "Format on save"
      }
    ]
  }
}
```

---

## 5. OpenSpec Integration

### 5.1 Capability Discovery

```bash
th openspec scan --path /path/to/project
```

### 5.2 Task Binding

When binding a task to an OpenSpec change:
1. Parse `proposal.md` for `## Capabilities`
2. Extract capability names
3. Store in `task.yaml`
4. Link to `openspec/changes/<change>/`

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
└── artifacts/        # Generated artifacts
```

---

## 7. Supervisor Design (FUTURE - Do Not Implement)

### 7.1 Purpose
Outer Claude Code that monitors task completion and can auto-fix skill/hook issues.

### 7.2 Architecture

```
thsHarness/
├── supervisor/
│   ├── .claude/
│   │   ├── skills/
│   │   │   ├── task-monitor.skill.md
│   │   │   └── skill-updater.skill.md
│   │   └── rules/
│   └── supervisor.md
└── tasks/
```

### 7.3 Skills Needed (Future)

- `task-monitor`: Watch task sessions, detect failures
- `skill-updater`: Find, evaluate, and install new skills
- `openspec-sync`: Sync task progress with OpenSpec

---

## 8. File Structure

```
thsHarness/
├── bin/
│   └── th.js              # CLI entry point
├── src/
│   ├── cli/
│   │   ├── index.tsx      # Main entry + router
│   │   ├── context.tsx    # Shared context
│   │   ├── commands/      # Command mode implementations
│   │   └── ui/           # Interactive UI components
│   │       ├── Menu.tsx
│   │       ├── TaskList.tsx
│   │       ├── TaskDetail.tsx
│   │       ├── SkillList.tsx
│   │       ├── HookList.tsx
│   │       └── Form.tsx
│   ├── task/
│   │   └── store.ts       # Task persistence
│   ├── library/
│   │   └── store.ts       # Skills/hooks/rules
│   └── openspec/
│       └── scanner.ts     # OpenSpec integration
├── library/               # Shared resources
│   ├── skills/
│   ├── hooks/
│   └── rules/
├── tasks/                # Task workspaces
└── package.json
```

---

## 9. Implementation Phases

### Phase 1: Foundation ✓
- [x] Project structure setup
- [x] Basic CLI (`init`, `new`, `list`, `status`)
- [x] Task folder generation with `.claude/`
- [x] Basic task.yaml schema

### Phase 2: Skills/Hooks/Rules Management ✓
- [x] Skill library structure
- [x] `skill add/list/link/unlink` commands
- [x] Hook configuration system
- [x] `hook add/list/link/unlink` commands

### Phase 3: Interactive CLI ✓
- [x] Interactive menu system with keyboard navigation
- [x] Main menu (Tasks, Skills, Hooks, OpenSpec placeholder, Settings placeholder)
- [x] Task list with selection
- [x] Task detail view with actions
- [x] Skill/Hook selection interfaces
- [x] Input forms for creating/editing
- [x] Command mode as fallback

### Phase 3.5: Skill Categorization & Search
- [ ] Auto-parse `category` from SKILL.md frontmatter (`metadata.scaffold.category`)
- [ ] Add `listCategories()` method to LibraryStore
- [ ] Add pagination to skill list (configurable page size, e.g., 10 per page)
- [ ] Add search/filter by name or description
- [ ] Interactive UI: Skills view shows categories first, then skills within category
- [ ] Command mode: `th skill list --category <name>`, `th skill list --search <query>`, `th skill list --page <n>`

### Phase 4: OpenSpec Integration
- [ ] OpenSpec change scanning
- [ ] Task binding to changes
- [ ] Capability extraction
- [ ] Progress sync

### Phase 5: 24*7 Operation
- [ ] tmux session management
- [ ] Status persistence
- [ ] Graceful interruption handling
- [ ] Session resume capability

### Phase 6: Supervisor (FUTURE)
- [ ] Supervisor architecture design
- [ ] Task monitoring skill
- [ ] Auto-repair logic

---

## 10. Dependencies

- **Node.js 20+**: CLI runtime
- **INK 5.x**: React for CLI (interactive terminal UI)
- **React 18**: For INK components
- **tmux** or **screen**: Terminal session management
- **OpenSpec**: Project specification framework (installed separately)
- **yaml**: Task metadata parsing

---

## 11. Out of Scope (v1)

- Multi-user support
- Cloud sync
- Web UI
- Supervisor auto-repair (Phase 6)
