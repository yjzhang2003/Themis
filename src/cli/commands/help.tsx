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
        <Text bold>Commands:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <CommandRow cmd="init" desc="Initialize workspace" />
          <CommandRow cmd="new &lt;name&gt;" desc="Create new task" />
          <CommandRow cmd="list, ls" desc="List all tasks" />
          <CommandRow cmd="status [id]" desc="Show task status" />
          <CommandRow cmd="help" desc="Show this help" />
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Task Management:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <CommandRow cmd="activate &lt;id&gt;" desc="Activate task (set up .claude/)" />
          <CommandRow cmd="deactivate" desc="Deactivate current task" />
          <CommandRow cmd="delete &lt;id&gt;" desc="Delete a task" />
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Skills:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <CommandRow cmd="skill add &lt;name&gt;" desc="Add skill to library" />
          <CommandRow cmd="skill list" desc="List available skills" />
          <CommandRow cmd="skill link &lt;name&gt;" desc="Link skill to active task" />
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>OpenSpec:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <CommandRow cmd="openspec scan" desc="Scan for OpenSpec changes" />
          <CommandRow cmd="bind &lt;task-id&gt; &lt;change&gt;" desc="Bind task to OpenSpec change" />
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
      <Text color="cyan" width={24}>
        {cmd}
      </Text>
      <Text>{desc}</Text>
    </Box>
  );
}
