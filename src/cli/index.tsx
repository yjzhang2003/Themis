#!/usr/bin/env node
import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { CLIProvider, useCLI } from './context.js';
import { InitCommand } from './commands/init.js';
import { NewCommand } from './commands/new.js';
import { ListCommand } from './commands/list.js';
import { StatusCommand } from './commands/status.js';
import { HelpCommand } from './commands/help.js';
import { ActivateCommand } from './commands/activate.js';
import {
  SkillAddCommand,
  SkillListCommand,
  SkillLinkCommand,
  SkillUnlinkCommand,
} from './commands/skill.js';
import {
  HookAddCommand,
  HookListCommand,
  HookLinkCommand,
  HookUnlinkCommand,
} from './commands/hook.js';
import { OpenSpecCommand } from './commands/openspec.js';
import { InteractiveApp } from './ui/views.js';

export { TaskStore } from '../task/store.js';

function CLI() {
  const { args, store, library, command, subcommand, showHelp } = useCLI();

  // Derive interactive mode directly from args to avoid stale closure issues
  const cmdArgs = args._ as string[] || [];
  const isInteractiveMode = !cmdArgs.length || (cmdArgs.length === 1 && !cmdArgs[0]);

  // Check for help flags
  const isHelpMode = cmdArgs[0] === 'help' || args.h || args.help;

  // Interactive mode when: no command or explicitly requested, AND store/library are ready
  const showInteractive = isInteractiveMode && !isHelpMode && store && library;
  const showHelpFlag = isHelpMode || args.help || args.h;

  // Interactive mode
  if (showInteractive) {
    return <InteractiveApp store={store} library={library} onQuit={() => process.exit(0)} />;
  }

  if (showHelpFlag) {
    return <HelpCommand />;
  }

  // Skill commands
  if (command === 'skill') {
    switch (subcommand) {
      case 'add':
        return <SkillAddCommand library={library} store={store} args={args} />;
      case 'list':
      case 'ls':
        return <SkillListCommand library={library} args={args} />;
      case 'link':
        return <SkillLinkCommand library={library} store={store} args={args} />;
      case 'unlink':
        return <SkillUnlinkCommand library={library} store={store} args={args} />;
      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Skill Commands</Text>
            <Text>
              <Text color="cyan">th skill add &lt;name&gt;</Text> - Create a new skill
            </Text>
            <Text>
              <Text color="cyan">th skill list</Text> - List all skills
            </Text>
            <Text>
              <Text color="cyan">th skill link &lt;skill-id&gt; [task-id]</Text> - Link skill to task
            </Text>
            <Text>
              <Text color="cyan">th skill unlink &lt;skill-id&gt; [task-id]</Text> - Unlink skill from task
            </Text>
          </Box>
        );
    }
  }

  // Hook commands
  if (command === 'hook') {
    switch (subcommand) {
      case 'add':
        return <HookAddCommand library={library} store={store} args={args} />;
      case 'list':
      case 'ls':
        return <HookListCommand library={library} />;
      case 'link':
        return <HookLinkCommand library={library} store={store} args={args} />;
      case 'unlink':
        return <HookUnlinkCommand library={library} store={store} args={args} />;
      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Hook Commands</Text>
            <Text>
              <Text color="cyan">th hook add &lt;name&gt; &lt;type&gt;</Text> --command &lt;cmd&gt; - Create a hook
            </Text>
            <Text dimColor>  Types: PreToolUse, PostToolUse, Stop</Text>
            <Text>
              <Text color="cyan">th hook list</Text> - List all hooks
            </Text>
            <Text>
              <Text color="cyan">th hook link &lt;hook-id&gt; [task-id]</Text> - Link hook to task
            </Text>
            <Text>
              <Text color="cyan">th hook unlink &lt;hook-id&gt; [task-id]</Text> - Unlink hook from task
            </Text>
          </Box>
        );
    }
  }

  switch (command) {
    case 'init':
      return <InitCommand store={store} />;
    case 'new':
      return <NewCommand store={store} args={args} />;
    case 'list':
    case 'ls':
      return <ListCommand store={store} />;
    case 'status':
    case 'st':
      return <StatusCommand store={store} args={args} />;
    case 'activate':
    case 'ac':
      return <ActivateCommand store={store} library={library} args={args} />;
    case 'openspec':
    case 'os':
      return <OpenSpecCommand store={store} args={args} />;
    default:
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Task Harness CLI</Text>
          <Text dimColor>Run <Text color="cyan">th</Text> for interactive mode</Text>
          <Text dimColor>Run <Text color="cyan">th --help</Text> for command usage</Text>
        </Box>
      );
  }
}

const cli = render(
  <CLIProvider>
    <CLI />
  </CLIProvider>
);

export default cli;
