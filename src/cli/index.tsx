#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { TaskStore } from '../task/store.js';
import { Task } from '../task/types.js';
import { CLIProvider, useCLI } from './context.js';
import { InitCommand } from './commands/init.js';
import { NewCommand } from './commands/new.js';
import { ListCommand } from './commands/list.js';
import { StatusCommand } from './commands/status.js';
import { HelpCommand } from './commands/help.js';

export { TaskStore } from '../task/store.js';

function CLI() {
  const { args, store, command, showHelp } = useCLI();

  useEffect(() => {
    const cmdArgs = args._ as string[];
    if (!cmdArgs?.length || cmdArgs[0] === 'help' || args.h || args.help) {
      showHelp();
    }
  }, [args, showHelp]);

  if (showHelp()) {
    return <HelpCommand />;
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
    default:
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Task Harness CLI</Text>
          <Text dimColor>Use --help or run 'help' for usage information</Text>
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
