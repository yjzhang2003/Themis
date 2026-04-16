import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';
import { STATUS_COLORS } from '../constants.js';

interface StatusCommandProps {
  store: TaskStore | null;
  args: Record<string, unknown>;
}

export function StatusCommand({ store, args }: StatusCommandProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) {
      setError('Not in a workspace. Run th init first.');
      return;
    }

    const taskId = args._[1] as string | undefined;
    if (!taskId) {
      const active = store.getActiveTask();
      if (active) {
        setTask(active);
      } else {
        setError('Usage: th status <task-id>');
      }
      return;
    }

    const found = store.getTask(taskId);
    if (found) {
      setTask(found);
    } else {
      setError(`Task not found: ${taskId}`);
    }
  }, [store, args]);

  if (error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {error}
        </Text>
      </Box>
    );
  }

  if (!task) {
    return (
      <Box padding={1}>
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Task: </Text>
        <Text color="cyan">{task.id}</Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text dimColor width={12}>Name:</Text>
          <Text>{task.name}</Text>
        </Box>

        <Box>
          <Text dimColor width={12}>Status:</Text>
          <Text color={STATUS_COLORS[task.status]}>{task.status}</Text>
        </Box>

        <Box>
          <Text dimColor width={12}>Created:</Text>
          <Text>{new Date(task.created_at).toLocaleString()}</Text>
        </Box>

        <Box>
          <Text dimColor width={12}>Updated:</Text>
          <Text>{new Date(task.updated_at).toLocaleString()}</Text>
        </Box>

        {task.description && (
          <Box flexDirection="column">
            <Text dimColor>Description:</Text>
            <Text>{task.description}</Text>
          </Box>
        )}

        {task.openspec?.change && (
          <Box>
            <Text dimColor width={12}>OpenSpec:</Text>
            <Text>{task.openspec.change}</Text>
          </Box>
        )}

        {task.skills.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Skills:</Text>
            {task.skills.map((s, i) => (
              <Text key={i} paddingLeft={2}>
                - {s.skill}@{s.version}
              </Text>
            ))}
          </Box>
        )}

        {task.hooks && Object.keys(task.hooks).length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Hooks:</Text>
            {Object.entries(task.hooks).map(([type, hooks]) =>
              hooks.map((h, i) => (
                <Text key={`${type}-${i}`} paddingLeft={2}>
                  - {type}: {h}
                </Text>
              ))
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
