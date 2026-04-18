import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';

interface ActivateCommandProps {
  store: TaskStore | null;
  args: Record<string, unknown>;
}

export function ActivateCommand({ store, args }: ActivateCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string; provider?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!store) {
      setResult({ success: false, error: 'Store not available' });
      return;
    }

    const taskName = args._[1] as string | undefined;
    if (!taskName) {
      setResult({ success: false, error: 'Usage: th activate <task-name>' });
      return;
    }

    try {
      const task = store.getTask(taskName);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskName}` });
        return;
      }

      // Sync resources to task's .claude/settings.json or .codex/config.json
      store.syncTaskResources(taskName);

      // Update task status
      store.updateTask(taskName, { status: 'in_progress' });

      setResult({ success: true, provider: task.provider });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [store, args]);

  if (result.error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {result.error}
        </Text>
      </Box>
    );
  }

  const sessionPrefix = result.provider === 'codex' ? 'th-codex' : 'th-claude';

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓</Text>
        <Text> Task activated</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Use tmux to attach to the task session:</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        <Text dimColor>tmux attach-session -t {sessionPrefix}-{args._[1]}</Text>
      </Box>
    </Box>
  );
}
