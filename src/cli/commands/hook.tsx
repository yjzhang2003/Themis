import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { GlobalLibraryStore, GlobalHook } from '../../global-library/store.js';
import { TaskStore } from '../../task/store.js';
import type { ParsedArgs } from '../context.js';


interface HookCommandProps {
  store: TaskStore | null;
  args: ParsedArgs;
}

export function HookAddCommand({ args }: HookCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    const globalLib = new GlobalLibraryStore();
    globalLib.ensureDirectories();

    const name = args._[2] as string | undefined;
    const type = (args._[3] as string) || 'PostToolUse';
    const command = args.command as string | undefined;
    const matcher = (args.matcher || args.m) as string | undefined;

    if (!name) {
      setResult({ success: false, error: 'Usage: themis global hook add <name> <type> --command <cmd> [--matcher <pattern>]' });
      return;
    }

    if (!command) {
      setResult({ success: false, error: 'Usage: themis global hook add <name> <type> --command <cmd>' });
      return;
    }

    if (!['PreToolUse', 'PostToolUse', 'Stop'].includes(type)) {
      setResult({ success: false, error: `Invalid hook type: ${type}. Must be PreToolUse, PostToolUse, or Stop.` });
      return;
    }

    try {
      globalLib.installHook(command, name, type, matcher);
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [args]);

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
        <Text> Hook installed to global library</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Hooks are stored in ~/.claude/hooks/hooks.json</Text>
      </Box>
    </Box>
  );
}

export function HookListCommand() {
  const [hooks, setHooks] = useState<GlobalHook[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const globalLib = new GlobalLibraryStore();
      setHooks(globalLib.listHooks());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);

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
      <Text bold>Global Hooks</Text>
      {hooks.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No hooks yet. Run 'themis global hook add [name] [type] --command [cmd]' to create one.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {hooks.map((hook) => (
            <Box key={hook.id} marginBottom={1} flexDirection="column">
              <Box>
                <Box width={20}><Text color="cyan">{hook.id}</Text></Box>
                <Text color="yellow">[{hook.type}]</Text>
              </Box>
              <Box paddingLeft={2}><Text dimColor>{hook.command}</Text></Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function HookLinkCommand({ store, args }: HookCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!store) {
      setResult({ success: false, error: 'Store not available' });
      return;
    }

    const hookId = args._[2] as string | undefined;
    const taskName = args._[3] as string | undefined;

    if (!hookId) {
      setResult({ success: false, error: 'Usage: themis hook link <hook-id> [task-name]' });
      return;
    }

    if (!taskName) {
      setResult({ success: false, error: 'Usage: themis hook link <hook-id> [task-name]' });
      return;
    }

    try {
      const globalLib = new GlobalLibraryStore();
      const hook = globalLib.getHook(hookId);
      if (!hook) {
        setResult({ success: false, error: `Hook not found: ${hookId}` });
        return;
      }

      const task = store.getTask(taskName);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskName}` });
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

      store.updateTask(taskName, { hooks: updatedHooks });
      setResult({ success: true });
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓</Text>
        <Text> Linked hook to task</Text>
      </Box>
    </Box>
  );
}

export function HookUnlinkCommand({ store, args }: HookCommandProps) {

  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!store) {
      setResult({ success: false, error: 'Store not available' });
      return;
    }

    const hookId = args._[2] as string | undefined;
    const taskName = args._[3] as string | undefined;

    if (!hookId) {
      setResult({ success: false, error: 'Usage: themis hook unlink <hook-id> [task-name]' });
      return;
    }

    if (!taskName) {
      setResult({ success: false, error: 'Usage: themis hook unlink <hook-id> [task-name]' });
      return;
    }

    try {
      const task = store.getTask(taskName);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskName}` });
        return;
      }

      // Remove hook from all types
      const updatedHooks: Record<string, string[]> = {};
      for (const [type, hooks] of Object.entries(task.hooks)) {
        updatedHooks[type] = hooks.filter((h) => h !== hookId);
      }

      store.updateTask(taskName, { hooks: updatedHooks });
      setResult({ success: true });
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓</Text>
        <Text> Unlinked hook from task</Text>
      </Box>
    </Box>
  );
}
