import React from 'react';
import { Box, Text } from 'ink';

export function HelpCommand() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Task Harness CLI</Text>
      <Text dimColor>Claude Code Task Management System</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Usage:</Text>
        <Text>  th &lt;command&gt; [options]</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Workspace:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <CommandRow cmd="init" desc="Initialize workspace" />
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Tasks:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <CommandRow cmd="new &lt;name&gt;" desc="Create new task" />
          <CommandRow cmd="list, ls" desc="List all tasks" />
          <CommandRow cmd="status [id]" desc="Show task status" />
          <CommandRow cmd="activate &lt;id&gt;" desc="Activate task (setup .claude/)" />
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Skills:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <CommandRow cmd="skill add &lt;name&gt;" desc="Create a new skill" />
          <CommandRow cmd="skill list" desc="List all skills" />
          <CommandRow cmd="skill link &lt;id&gt; [task]" desc="Link skill to task" />
          <CommandRow cmd="skill unlink &lt;id&gt; [task]" desc="Unlink skill from task" />
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Hooks:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <CommandRow cmd="hook add &lt;name&gt; &lt;type&gt;" desc="Create a hook" />
          <Text dimColor paddingLeft={2}>  Types: PreToolUse, PostToolUse, Stop</Text>
          <CommandRow cmd="hook list" desc="List all hooks" />
          <CommandRow cmd="hook link &lt;id&gt; [task]" desc="Link hook to task" />
          <CommandRow cmd="hook unlink &lt;id&gt; [task]" desc="Unlink hook from task" />
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Run 'th &lt;command&gt; --help' for command-specific help</Text>
      </Box>
    </Box>
  );
}

function CommandRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <Box>
      <Text color="cyan" width={28}>
        {cmd}
      </Text>
      <Text>{desc}</Text>
    </Box>
  );
}
