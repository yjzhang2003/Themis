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
import { GlobalCommand } from './commands/global.js';
import { SupervisorCommand, SessionCommand } from './commands/session.js';
import { TakeoverCommand } from './commands/takeover.js';
import {
  SuiteListCommand,
  SuiteAddCommand,
  SuiteDeleteCommand,
  SuiteApplyCommand,
} from './commands/suite.js';
import {
  LibraryListCommand,
  LibraryAddCommand,
  LibraryRemoveCommand,
  LibraryPromoteCommand,
} from './commands/library.js';
import { InteractiveApp } from './ui/views.js';

export { TaskStore } from '../task/store.js';

function CLI() {
  const { args, store, command, subcommand, showHelp } = useCLI();

  // Derive interactive mode directly from args to avoid stale closure issues
  const cmdArgs = args._ as string[] || [];
  const isInteractiveMode = !cmdArgs.length || (cmdArgs.length === 1 && !cmdArgs[0]);

  // Check for help flags
  const isHelpMode = cmdArgs[0] === 'help' || args.h || args.help;

  // Interactive mode when: no command or explicitly requested, AND store is ready
  const showInteractive = isInteractiveMode && !isHelpMode && store;
  const showHelpFlag = isHelpMode || args.help || args.h;

  // Interactive mode
  if (showInteractive) {
    return <InteractiveApp store={store} onQuit={() => process.exit(0)} />;
  }

  if (showHelpFlag) {
    return <HelpCommand />;
  }

  // Skill commands
  if (command === 'skill') {
    switch (subcommand) {
      case 'add':
        return <SkillAddCommand store={store} args={args} />;
      case 'list':
      case 'ls':
        return <SkillListCommand store={store} args={args} />;
      case 'link':
        return <SkillLinkCommand store={store} args={args} />;
      case 'unlink':
        return <SkillUnlinkCommand store={store} args={args} />;
      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Skill Commands</Text>
            <Text>
              <Text color="cyan">themis skill link &lt;skill-id&gt; &lt;task-name&gt;</Text> - Link skill to task
            </Text>
            <Text>
              <Text color="cyan">themis skill unlink &lt;skill-id&gt; &lt;task-name&gt;</Text> - Unlink skill from task
            </Text>
            <Text dimColor>Use themis global skill list to browse available skills</Text>
          </Box>
        );
    }
  }

  // Hook commands
  if (command === 'hook') {
    switch (subcommand) {
      case 'add':
        return <HookAddCommand store={store} args={args} />;
      case 'list':
      case 'ls':
        return <HookListCommand />;
      case 'link':
        return <HookLinkCommand store={store} args={args} />;
      case 'unlink':
        return <HookUnlinkCommand store={store} args={args} />;
      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Hook Commands</Text>
            <Text>
              <Text color="cyan">themis hook link &lt;hook-id&gt; &lt;task-name&gt;</Text> - Link hook to task
            </Text>
            <Text>
              <Text color="cyan">themis hook unlink &lt;hook-id&gt; &lt;task-name&gt;</Text> - Unlink hook from task
            </Text>
            <Text dimColor>Use themis global hook list to browse available hooks</Text>
          </Box>
        );
    }
  }

  // Suite commands
  if (command === 'suite') {
    switch (subcommand) {
      case 'list':
      case 'ls':
        return <SuiteListCommand store={store} args={args} />;
      case 'add':
        return <SuiteAddCommand store={store} args={args} />;
      case 'delete':
      case 'rm':
        return <SuiteDeleteCommand store={store} args={args} />;
      case 'apply':
        return <SuiteApplyCommand store={store} args={args} />;
      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Suite Commands</Text>
            <Text>
              <Text color="cyan">themis suite list</Text> - List all suites
            </Text>
            <Text>
              <Text color="cyan">themis suite add &lt;name&gt;</Text> - Create a new suite
            </Text>
            <Text>
              <Text color="cyan">themis suite delete &lt;id&gt;</Text> - Delete a suite
            </Text>
            <Text>
              <Text color="cyan">themis suite apply &lt;suite-id&gt; &lt;task-name&gt;</Text> - Apply suite to task
            </Text>
          </Box>
        );
    }
  }

  // Library commands
  if (command === 'library') {
    switch (subcommand) {
      case 'list':
      case 'ls':
        return <LibraryListCommand args={args} />;
      case 'add':
        return <LibraryAddCommand args={args} />;
      case 'remove':
      case 'rm':
        return <LibraryRemoveCommand args={args} />;
      case 'promote':
        return <LibraryPromoteCommand args={args} />;
      default:
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Universal Library Commands</Text>
            <Text>
              <Text color="cyan">themis library list</Text> - List universal skills
            </Text>
            <Text>
              <Text color="cyan">themis library add &lt;path&gt;</Text> - Add skill to universal library
            </Text>
            <Text>
              <Text color="cyan">themis library remove &lt;skill-id&gt;</Text> - Remove skill from universal library
            </Text>
            <Text>
              <Text color="cyan">themis library promote &lt;skill-id&gt;</Text> - Promote Claude Code skill to universal
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
      return <ActivateCommand store={store} args={args} />;
    case 'openspec':
    case 'os':
      return <OpenSpecCommand store={store} args={args} />;
    case 'global':
      return <GlobalCommand args={args} />;
    case 'supervisor':
    case 'sup':
      return <SupervisorCommand args={args} />;
    case 'session':
    case 'ses':
      return <SessionCommand args={args} />;
    case 'takeover':
    case 'to':
      return <TakeoverCommand args={args} />;
    default:
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Themis CLI</Text>
          <Text dimColor>Run <Text color="cyan">themis</Text> for interactive mode</Text>
          <Text dimColor>Run <Text color="cyan">themis --help</Text> for command usage</Text>
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
