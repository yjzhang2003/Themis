import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';

interface InitCommandProps {
  store: TaskStore | null;
}

export function InitCommand({ store }: InitCommandProps) {
  const [status, setStatus] = useState<'init' | 'done' | 'error'>('init');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      store?.ensureDirectories();
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  }, [store]);

  return (
    <Box flexDirection="column" padding={1}>
      {status === 'init' && (
        <Text color="cyan">Initializing...</Text>
      )}
      {status === 'done' && (
        <>
          <Box>
            <Text color="green">✓</Text>
            <Text> Themis initialized</Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Main directory: ~/.themis/</Text>
            <Text dimColor>Run <Text color="cyan">themis</Text> to start</Text>
          </Box>
        </>
      )}
      {status === 'error' && (
        <Text>
          <Text color="red">Error:</Text> {error}
        </Text>
      )}
    </Box>
  );
}
