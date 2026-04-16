import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';

interface NewCommandProps {
  store: TaskStore | null;
  args: Record<string, unknown>;
}

export function NewCommand({ store, args }: NewCommandProps) {
  const [task, setTask] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) {
      setError('Not in a workspace. Run th init first.');
      return;
    }

    const nameArg = args._[1] as string | undefined;
    if (!nameArg) {
      setError('Usage: th new <task-name>');
      return;
    }

    try {
      const newTask = store.createTask(nameArg, args.description as string | undefined);
      setTask({ id: newTask.id, name: newTask.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [store, args]);

  return (
    <Box flexDirection="column" padding={1}>
      {task && (
        <>
          <Box>
            <Text color="green">✓</Text>
            <Text> Created task </Text>
            <Text color="cyan">{task.id}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} paddingLeft={2}>
            <Text>Name: {task.name}</Text>
            <Text dimColor>Directory: tasks/{task.id}/</Text>
          </Box>
          <Box marginTop={1}>
            <Text>
              Run <Text color="cyan">th status {task.id}</Text> to view task details
            </Text>
          </Box>
        </>
      )}
      {error && (
        <Text>
          <Text color="red">Error:</Text> {error}
        </Text>
      )}
    </Box>
  );
}
