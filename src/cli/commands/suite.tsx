import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SuiteStore } from '../../suite/store.js';
import { Suite, SuiteSkill } from '../../suite/types.js';
import { TaskStore } from '../../task/store.js';
import type { ParsedArgs } from '../context.js';


interface SuiteCommandProps {
  store: TaskStore | null;
  args: ParsedArgs;
}

export function SuiteListCommand({ args }: SuiteCommandProps) {
  const [output, setOutput] = useState<{ suites?: Suite[]; error?: string }>({});

  useEffect(() => {
    try {
      const suiteStore = new SuiteStore();
      const suites = suiteStore.listSuites();
      setOutput({ suites });
    } catch (e) {
      setOutput({ error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [args]);

  if (output.error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {output.error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Skill Suites</Text>
      {output.suites && output.suites.length === 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>No suites defined yet.</Text>
          <Text dimColor>Use: themis suite add &lt;name&gt;</Text>
        </Box>
      )}
      {output.suites && output.suites.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {output.suites.map((suite) => (
            <Box key={suite.id} marginBottom={1} flexDirection="column">
              <Box>
                <Box width={20}><Text color="cyan">{suite.id}</Text></Box>
                <Text bold>{suite.name}</Text>
              </Box>
              {suite.description && (
                <Text dimColor>{suite.description}</Text>
              )}
              <Text dimColor>
                {suite.skills.length} skills
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function SuiteAddCommand({ args }: SuiteCommandProps) {
  const [result, setResult] = useState<{ success: boolean; suite?: Suite; error?: string }>({
    success: false,
  });

  useEffect(() => {
    const name = args._[2] as string | undefined;
    if (!name) {
      setResult({ success: false, error: 'Usage: themis suite add <name>' });
      return;
    }

    try {
      const suiteStore = new SuiteStore();
      const description = args.description as string | undefined;
      const skillsArg = args.skills as string | undefined;
      let skills: SuiteSkill[] = [];

      if (skillsArg) {
        // Parse skills from comma-separated string: "skill1:claude,skill2:universal"
        skills = skillsArg.split(',').map((s) => {
          const [id, provider] = s.split(':');
          return {
            id: id.trim(),
            provider: (provider?.trim() as 'claude' | 'codex' | 'universal') || 'universal',
          };
        });
      }

      const suite = suiteStore.createSuite({ name, description, skills });
      setResult({ success: true, suite });
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
        <Text> Suite created: {result.suite?.name}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Suite ID: {result.suite?.id}</Text>
      </Box>
    </Box>
  );
}

export function SuiteDeleteCommand({ args }: SuiteCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    const id = args._[2] as string | undefined;
    if (!id) {
      setResult({ success: false, error: 'Usage: themis suite delete <id>' });
      return;
    }

    try {
      const suiteStore = new SuiteStore();
      const deleted = suiteStore.deleteSuite(id);
      if (deleted) {
        setResult({ success: true });
      } else {
        setResult({ success: false, error: `Suite not found: ${id}` });
      }
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
        <Text> Suite deleted</Text>
      </Box>
    </Box>
  );
}

export function SuiteApplyCommand({ store, args }: SuiteCommandProps) {

  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!store) {
      setResult({ success: false, error: 'Store not available' });
      return;
    }

    const suiteId = args._[2] as string | undefined;
    const taskName = args._[3] as string | undefined;

    if (!suiteId || !taskName) {
      setResult({ success: false, error: 'Usage: themis suite apply <suite-id> <task-name>' });
      return;
    }

    try {
      const task = store.getTask(taskName);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskName}` });
        return;
      }

      const bound = store.bindSuite(taskName, suiteId);
      if (bound) {
        setResult({ success: true });
      } else {
        setResult({ success: false, error: `Failed to apply suite: ${suiteId}` });
      }
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
        <Text> Suite applied to task</Text>
      </Box>
    </Box>
  );
}
