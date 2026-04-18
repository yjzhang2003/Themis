# Themis Development Guide

## Project Overview

Themis is an autonomous task management system for Claude Code, built with INK (React for terminals).

## Running the CLI

```bash
# Interactive mode
./bin/themis.js

# Command mode
./bin/themis.js new my-task --provider codex
./bin/themis.js list
./bin/themis.js status <task-id>
```

## Project Structure

```
src/
├── cli/                    # TUI implementation
│   ├── commands/          # CLI commands (activate, new, list, etc.)
│   ├── ui/               # INK React components
│   │   ├── views.tsx     # Main interactive views
│   │   └── listbox.tsx  # Reusable list component
│   └── index.tsx         # CLI entry point
├── supervisor/           # Task monitoring and launch
│   ├── launcher.ts       # Launches AI CLI in tmux
│   ├── providers/        # AI provider abstraction
│   │   ├── base.ts      # AICliProvider interface
│   │   ├── claude-code.ts
│   │   └── codex.ts
│   └── supervisor-loop.ts # Autonomous monitoring loop
├── task/                 # Task management
│   └── store.ts          # Task CRUD operations
└── global-library/        # Shared skills/hooks
```

## Adding a New AI Provider

### 1. Create Provider Implementation

Create `src/supervisor/providers/<provider-name>.ts`:

```typescript
import type { AICliProvider, IsolatedHomeResult } from './base.js';
import type { LaunchConfig } from '../types.js';

export class MyProvider implements AICliProvider {
  readonly type = 'myprovider' as const;

  label(): string { return 'My Provider'; }
  globalConfigDir(): string { return '~/.myprovider'; }
  sessionName(taskId: string): string { return `th-myprovider-${taskId}`; }

  buildIsolationEnv(config: LaunchConfig): Record<string, string> {
    return {
      MYPROVIDER_TASK_ID: config.taskId,
      MYPROVIDER_WORKSPACE_RESTRICT: '1',
    };
  }

  prepareIsolatedHome(taskDir: string, config: LaunchConfig): IsolatedHomeResult {
    // Copy config dir to isolated HOME
    return { homeDir: '/tmp/...', configDir: '/tmp/.../.myprovider' };
  }

  buildLaunchCommand(isolatedHome: IsolatedHomeResult): string {
    return `HOME='${isolatedHome.homeDir}' myprovider`;
  }
}
```

### 2. Register in getProvider()

Edit `src/supervisor/providers/base.ts`:

```typescript
import { MyProvider } from './myprovider.js';

export function getProvider(type: ProviderType): AICliProvider {
  switch (type) {
    case 'claude': return new ClaudeCodeProvider();
    case 'codex': return new CodexProvider();
    case 'myprovider': return new MyProvider(); // ADD THIS
  }
}
```

### 3. Add Provider Type

Update `ProviderType` in `base.ts`:

```typescript
export type ProviderType = 'claude' | 'codex' | 'myprovider';
```

### 4. Update Task Schema

Edit `src/task/types.ts`:

```typescript
const TaskProviderSchema = z.enum(['claude', 'codex', 'myprovider']).default('claude');
```

### 5. Add Interactive Selection (Optional)

Edit `src/cli/ui/views.tsx`:
- Add view state
- Add provider option in task creation flow

## Key Files for Provider Integration

| File | Purpose |
|------|---------|
| `launcher.ts` | Launches AI CLI with provider config |
| `tmux.ts` | Manages tmux sessions |
| `monitor.ts` | Monitors task sessions |
| `store.ts` | CRUD for tasks |
| `views.tsx` | Interactive TUI |

## Testing

```bash
# Create test task
./bin/themis.js new test-task --provider codex

# Check task in interactive mode
./bin/themis.js
# Navigate: Tasks → select task → see provider info
```

## Common Tasks

### Add a new CLI command
1. Create `src/cli/commands/<command>.tsx`
2. Export component with `Command` props interface
3. Register in `src/cli/index.tsx`

### Add a new TUI view
1. Add view name to `View` type in `views.tsx`
2. Add view rendering condition and JSX
3. Add navigation actions

### Modify task creation flow
1. Find task creation flow in `views.tsx`
2. `task-create` → `task-create-current-dir` → `task-create-provider`
3. Add new step or modify existing

## Troubleshooting

### Changes not visible
- Make sure running via `./bin/themis.js` (uses tsx, not dist/)
- Check TypeScript compiles: `pnpm tsc --noEmit`

### Build errors
- Many pre-existing errors exist in the codebase
- Focus on errors in files you've modified
- Use `pnpm tsc --noEmit src/path/to/file.ts` to check specific files
