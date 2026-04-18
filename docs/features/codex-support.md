# Codex Support Feature

## Overview

Themis now supports OpenAI Codex CLI as an alternative AI provider alongside Claude Code.

## Usage

### Via CLI

```bash
# Create a Codex task
./bin/themis.js new my-codex-task --provider codex

# Create a Claude task (default)
./bin/themis.js new my-claude-task
./bin/themis.js new my-claude-task --provider claude
```

### Via Interactive TUI

1. Run `./bin/themis.js`
2. Navigate to **Tasks**
3. Select **+ Create New Task**
4. Enter task name
5. Select **Yes, create here** to use current directory
6. **Select AI Provider** - choose Claude Code or OpenAI Codex

## How It Works

### Provider Abstraction

The `AICliProvider` interface in `src/supervisor/providers/base.ts` defines:

```typescript
interface AICliProvider {
  readonly type: ProviderType;
  buildIsolationEnv(config: LaunchConfig): Record<string, string>;
  prepareIsolatedHome(taskDir: string, config: LaunchConfig): IsolatedHomeResult;
  buildLaunchCommand(isolatedHome: IsolatedHomeResult): string;
  label(): string;
  globalConfigDir(): string;
  sessionName(taskId: string): string;
}
```

### Config Directories

Each provider uses its own config directory:

| Provider | Config Directory | Settings File |
|----------|----------------|--------------|
| Claude Code | `.claude/` | `settings.json` |
| Codex | `.codex/` | `config.json` |

### Session Naming

Sessions are named by provider to avoid conflicts:

- Claude Code: `th-claude-{taskId}`
- Codex: `th-codex-{taskId}`

## Architecture

```
src/supervisor/providers/
├── base.ts          # AICliProvider interface + getProvider()
├── claude-code.ts   # Claude Code implementation
└── codex.ts        # OpenAI Codex implementation
```

## Data Flow

1. **Task Creation**: `TaskStore.createTask()` creates provider-specific config dir
2. **Task Activation**: `TaskStore.syncTaskResources()` syncs skills/hooks to config dir
3. **Task Launch**: `TaskLauncher.launch()` uses provider abstraction to:
   - Prepare isolated HOME with provider config
   - Create tmux session with provider-specific name
   - Send launch command to tmux

## Security

- Task names validated with regex: `/^[a-zA-Z0-9_-]+$/`
- Session names validated to prevent path traversal
- Config paths sanitized in `tmux.ts`

## Environment Variables

### Claude Code
- `CLAUDE_TASK_ID`
- `CLAUDE_WORKSPACE_RESTRICT`
- `CLAUDE_WORKSPACE_ROOT`

### Codex
- `CODEX_TASK_ID`
- `CODEX_WORKSPACE_RESTRICT`
- `CODEX_WORKSPACE_ROOT`

## Limitations

- Codex support is experimental
- Not all Claude Code features may be available in Codex
- Hook/Skill integration depends on provider support
