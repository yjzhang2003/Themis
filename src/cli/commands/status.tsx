import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';
import { Task } from '../../task/types.js';
import { TaskHooks } from '../../task/types.js';
import { STATUS_COLORS } from '../constants.js';
import type { ParsedArgs } from '../context.js';


interface StatusCommandProps {
  store: TaskStore | null;
  args: ParsedArgs;
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
          <Box width={12}><Text dimColor>Name:</Text></Box>
          <Text>{task.name}</Text>
        </Box>

        <Box>
          <Box width={12}><Text dimColor>Status:</Text></Box>
          <Text color={STATUS_COLORS[task.status]}>{task.status}</Text>
        </Box>

        <Box>
          <Box width={12}><Text dimColor>Created:</Text></Box>
          <Text>{new Date(task.created_at).toLocaleString()}</Text>
        </Box>

        <Box>
          <Box width={12}><Text dimColor>Updated:</Text></Box>
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
            <Box width={12}><Text dimColor>OpenSpec:</Text></Box>
            <Text>{task.openspec.change}</Text>
          </Box>
        )}

        {task.skills.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Skills:</Text>
            {task.skills.map((s, i) => (
              <Box key={i} paddingLeft={2}>
                <Text>- {s.skill}@{s.version}</Text>
              </Box>
            ))}
          </Box>
        )}

        {task.hooks && Object.keys(task.hooks).length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Hooks:</Text>
            {Object.entries(task.hooks as TaskHooks).map(([type, hookIds]) =>
              (hookIds as string[]).map((h: string, i: number) => (
                <Box key={`${type}-${i}`} paddingLeft={2}>
                  <Text>- {type}: {h}</Text>
                </Box>
              ))
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
