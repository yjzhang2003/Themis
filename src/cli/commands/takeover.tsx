import React from 'react';
import { Box, Text } from 'ink';
import { execSync } from 'child_process';
import { TmuxManager } from '../../tmux/tmux.js';
import type { ParsedArgs } from '../context.js';


interface TakeoverCommandProps {
  args: ParsedArgs;
}

export function TakeoverCommand({ args }: TakeoverCommandProps) {

  const cmdArgs = args._ as string[] || [];
  const taskId = cmdArgs[1] as string | undefined;

  // If no task ID provided, list sessions
  if (!taskId || taskId === '--list' || taskId === '-l') {
    const tmux = new TmuxManager();
    const sessions = tmux.listSessions('th-task-');

    if (sessions.length === 0) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>No running task sessions</Text>
          <Text dimColor>Usage: th takeover &lt;task-id&gt;</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Running Task Sessions:</Text>
        <Box marginTop={1} flexDirection="column">
          {sessions.map((s) => (
            <Box key={s.name} paddingY={0}>
              <Text>
                <Text color="cyan">{s.name}</Text>
                {s.attached && <Text dimColor> (attached)</Text>}
              </Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Usage: th takeover &lt;task-id&gt;</Text>
          <Text dimColor>Use Ctrl+B, D to detach</Text>
        </Box>
      </Box>
    );
  }

  // Take over specified session
  const sessionName = `th-task-${taskId}`;
  const tmux = new TmuxManager();

  if (!tmux.sessionExists(sessionName)) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error:</Text>
        <Text>Session not found: {sessionName}</Text>
        <Text dimColor>Run 'th takeover --list' to see available sessions</Text>
      </Box>
    );
  }

  // Attach to session - this hijacks the terminal
  try {
    console.log(`Attaching to session: ${sessionName}`);
    console.log('Use Ctrl+B, D to detach');
    execSync(`tmux attach-session -t "${sessionName}"`, { stdio: 'inherit' });
  } catch {
    // User detached or error
  }

  // When returning from takeover, show status
  return (
    <Box flexDirection="column" padding={1}>
      <Text>Detached from session: {sessionName}</Text>
      <Text dimColor>Use 'th takeover {taskId}' to reattach</Text>
    </Box>
  );
}
