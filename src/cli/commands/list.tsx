import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';
import { Task } from '../../task/types.js';
import { STATUS_COLORS } from '../constants.js';

interface ListCommandProps {
  store: TaskStore | null;
}

export function ListCommand({ store }: ListCommandProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) {
      setError('Not in a workspace. Run th init first.');
      return;
    }

    try {
      const allTasks = store.listTasks();
      setTasks(allTasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [store]);

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
      <Text bold>Tasks</Text>
      <Box marginTop={1}>
        {tasks.length === 0 ? (
          <Text dimColor>No tasks yet. Run 'th new [name]' to create one.</Text>
        ) : (
          <Box flexDirection="column">
            {tasks.map((task) => (
              <Box key={task.id} marginBottom={1}>
                <Box width={12}>
                  <Text color={STATUS_COLORS[task.status] || 'white'}>
                    [{task.status}]
                  </Text>
                </Box>
                <Box width={12}>
                  <Text color="cyan">{task.id}</Text>
                </Box>
                <Text>{task.name}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
