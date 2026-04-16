import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { LibraryStore, Hook } from '../../library/store.js';
import { TaskStore } from '../../task/store.js';

interface HookCommandProps {
  library: LibraryStore | null;
  store: TaskStore | null;
  args: Record<string, unknown>;
}

export function HookAddCommand({ library, store, args }: HookCommandProps) {
  const [result, setResult] = useState<{ success: boolean; hook?: Hook; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!library) {
      setResult({ success: false, error: 'Not in a workspace' });
      return;
    }

    const name = args._[2] as string | undefined;
    const type = (args._[3] as string) || 'PostToolUse';
    const command = args.command as string | undefined;
    const matcher = (args.matcher || args.m) as string | undefined;

    if (!name) {
      setResult({ success: false, error: 'Usage: tharness hook add <name> <type> --command <cmd> [--matcher <pattern>]' });
      return;
    }

    if (!command) {
      setResult({ success: false, error: 'Usage: tharness hook add <name> <type> --command <cmd>' });
      return;
    }

    if (!['PreToolUse', 'PostToolUse', 'Stop'].includes(type)) {
      setResult({ success: false, error: `Invalid hook type: ${type}. Must be PreToolUse, PostToolUse, or Stop.` });
      return;
    }

    try {
      const hook = library.createHook({
        name,
        type: type as 'PreToolUse' | 'PostToolUse' | 'Stop',
        matcher: matcher || '.*',
        command,
        description: (args.description || args.d) as string | undefined,
      });
      setResult({ success: true, hook });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [library, args]);

  if (result.error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {result.error}
        </Text>
      </Box>
    );
  }

  if (!result.hook) {
    return (
      <Box padding={1}>
        <Text dimColor>Creating hook...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓</Text>
        <Text> Created hook </Text>
        <Text color="cyan">{result.hook.id}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text>Type: {result.hook.type}</Text>
        <Text>Command: {result.hook.command}</Text>
        <Text dimColor>File: library/hooks/{result.hook.id}.yaml</Text>
      </Box>
    </Box>
  );
}

export function HookListCommand({ library }: { library: LibraryStore | null }) {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!library) {
      setError('Not in a workspace');
      return;
    }

    try {
      setHooks(library.listHooks());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [library]);

  if (error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Hooks</Text>
      {hooks.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No hooks yet. Run 'tharness hook add [name] [type] --command [cmd]' to create one.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {hooks.map((hook) => (
            <Box key={hook.id} marginBottom={1} flexDirection="column">
              <Box>
                <Text color="cyan" width={20}>
                  {hook.id}
                </Text>
                <Text color="yellow">[{hook.type}]</Text>
              </Box>
              <Text dimColor paddingLeft={2}>
                {hook.command}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function HookLinkCommand({
  library,
  store,
  args,
}: {
  library: LibraryStore | null;
  store: TaskStore | null;
  args: Record<string, unknown>;
}) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!library || !store) {
      setResult({ success: false, error: 'Not in a workspace' });
      return;
    }

    const hookId = args._[2] as string | undefined;
    const taskId = (args._[3] as string | undefined) || store.getConfig().active_task;

    if (!hookId) {
      setResult({ success: false, error: 'Usage: tharness hook link <hook-id> [task-id]' });
      return;
    }

    if (!taskId) {
      setResult({ success: false, error: 'No active task. Specify task-id or activate a task first.' });
      return;
    }

    try {
      const hook = library.getHook(hookId);
      if (!hook) {
        setResult({ success: false, error: `Hook not found: ${hookId}` });
        return;
      }

      const task = store.getTask(taskId);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskId}` });
        return;
      }

      // Add hook to task
      const updatedHooks = { ...task.hooks };
      if (!updatedHooks[hook.type]) {
        updatedHooks[hook.type] = [];
      }
      if (!updatedHooks[hook.type]!.includes(hookId)) {
        updatedHooks[hook.type]!.push(hookId);
      }

      store.updateTask(taskId, { hooks: updatedHooks });
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [library, store, args]);

  if (result.error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {result.error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓</Text>
        <Text> Linked hook to task</Text>
      </Box>
    </Box>
  );
}

export function HookUnlinkCommand({
  library,
  store,
  args,
}: {
  library: LibraryStore | null;
  store: TaskStore | null;
  args: Record<string, unknown>;
}) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!library || !store) {
      setResult({ success: false, error: 'Not in a workspace' });
      return;
    }

    const hookId = args._[2] as string | undefined;
    const taskId = (args._[3] as string | undefined) || store.getConfig().active_task;

    if (!hookId) {
      setResult({ success: false, error: 'Usage: tharness hook unlink <hook-id> [task-id]' });
      return;
    }

    if (!taskId) {
      setResult({ success: false, error: 'No active task. Specify task-id or activate a task first.' });
      return;
    }

    try {
      const task = store.getTask(taskId);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskId}` });
        return;
      }

      // Remove hook from all types
      const updatedHooks: Record<string, string[]> = {};
      for (const [type, hooks] of Object.entries(task.hooks)) {
        updatedHooks[type] = hooks.filter((h) => h !== hookId);
      }

      store.updateTask(taskId, { hooks: updatedHooks });
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [library, store, args]);

  if (result.error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {result.error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓</Text>
        <Text> Unlinked hook from task</Text>
      </Box>
    </Box>
  );
}
