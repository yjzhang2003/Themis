import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface InitCommandProps {
  store: TaskStore | null;
}

function createHarnessConfig(workspaceRoot: string): void {
  const configPath = join(workspaceRoot, 'harness.yaml');
  const config = `version: '1.0'
workspace_root: ${workspaceRoot}
library_path: ./library
tasks_path: ./tasks
`;
  writeFileSync(configPath, config, 'utf-8');
  mkdirSync(join(workspaceRoot, 'tasks'), { recursive: true });
  mkdirSync(join(workspaceRoot, 'library', 'skills'), { recursive: true });
  mkdirSync(join(workspaceRoot, 'library', 'hooks'), { recursive: true });
  mkdirSync(join(workspaceRoot, 'library', 'rules'), { recursive: true });
}

export function InitCommand({ store }: InitCommandProps) {
  const [status, setStatus] = useState<'init' | 'done' | 'error'>('init');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (store) {
      // Workspace already exists, just ensure directories
      try {
        store.ensureDirectories();
        setStatus('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setStatus('error');
      }
      return;
    }

    // No store - create workspace from scratch
    try {
      const workspaceRoot = process.cwd();
      const configPath = join(workspaceRoot, 'harness.yaml');

      if (!existsSync(configPath)) {
        createHarnessConfig(workspaceRoot);
      }

      const newStore = new TaskStore(workspaceRoot);
      newStore.ensureDirectories();
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  }, [store]);

  return (
    <Box flexDirection="column" padding={1}>
      {status === 'init' && (
        <Text color="cyan">Initializing workspace...</Text>
      )}
      {status === 'done' && (
        <>
          <Box>
            <Text color="green">✓</Text>
            <Text> Workspace initialized</Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Created directories:</Text>
            <Text dimColor>  - tasks/</Text>
            <Text dimColor>  - library/skills/</Text>
            <Text dimColor>  - library/hooks/</Text>
            <Text dimColor>  - library/rules/</Text>
            <Text dimColor>  - harness.yaml</Text>
          </Box>
          <Box marginTop={1}>
            <Text>
              Run <Text color="cyan">tharness new [name]</Text> to create your first task
            </Text>
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
