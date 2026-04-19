import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { join } from 'path';
import { scanOpenSpecProject, OpenSpecProject } from '../../openspec/scanner.js';
import { TaskStore } from '../../task/store.js';
import type { ParsedArgs } from '../context.js';


interface OpenSpecCommandProps {
  store: TaskStore | null;
  args: ParsedArgs;
}

export function OpenSpecCommand({ store, args }: OpenSpecCommandProps) {

  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) {
      setError('Not in a workspace. Run th init first.');
      return;
    }

    const subcommand = args._[1] as string | undefined;

    if (subcommand === 'scan') {
      // themis openspec scan [--path <path>]
      const pathArg = args.path as string | undefined;
      const scanPath = pathArg || join(process.cwd(), '..');

      const project = scanOpenSpecProject(scanPath);
      if (!project) {
        setOutput(`No OpenSpec project found at: ${scanPath}\nNo changes/ directory with proposal.md found.`);
        return;
      }

      setOutput(`OpenSpec Project: ${project.name}\nPath: ${project.root}\n\nChanges (${project.changes.length}):`);
      if (project.changes.length > 0) {
        const changeList = project.changes.map((c) =>
          `  - ${c.id}: ${c.name || '(unnamed)'} (${c.capabilities.length} capabilities)`
        ).join('\n');
        setOutput((prev) => `${prev}\n${changeList}`);
      }
      return;
    }

    if (subcommand === 'bind') {
      // themis openspec bind <task-id> <change-id> [--capability <capability>]
      const taskId = args._[2] as string | undefined;
      const changeId = args._[3] as string | undefined;
      const capability = args.capability as string | undefined;

      if (!taskId || !changeId) {
        setError('Usage: themis openspec bind <task-id> <change-id> [--capability <capability>]');
        return;
      }

      const task = store.getTask(taskId);
      if (!task) {
        setError(`Task not found: ${taskId}`);
        return;
      }

      store.updateTask(taskId, {
        openspec: {
          change: changeId,
          capability: capability,
          path: undefined,
        },
      });

      setOutput(`Bound task "${task.name}" to change "${changeId}"${capability ? ` with capability "${capability}"` : ''}`);
      return;
    }

    if (subcommand === 'list') {
      // themis openspec list [--path <path>]
      const pathArg = args.path as string | undefined;
      const scanPath = pathArg || join(process.cwd(), '..');

      const project = scanOpenSpecProject(scanPath);
      if (!project) {
        setOutput(`No OpenSpec project found at: ${scanPath}`);
        return;
      }

      setOutput(`OpenSpec Project: ${project.name}\n\nChanges:`);
      project.changes.forEach((c) => {
        setOutput((prev) => `${prev}\n  ${c.id}: ${c.name || '(unnamed)'}`);
        if (c.capabilities.length > 0) {
          c.capabilities.slice(0, 5).forEach((cap) => {
            setOutput((prev) => `${prev}\n    - ${cap}`);
          });
          if (c.capabilities.length > 5) {
            setOutput((prev) => `${prev}\n    ... and ${c.capabilities.length - 5} more`);
          }
        }
      });
      return;
    }

    // Default: show help
    setOutput(`OpenSpec Commands:
  themis openspec scan [--path <path>]   Scan for OpenSpec project
  themis openspec list [--path <path>]   List changes and capabilities
  themis openspec bind <task-id> <change-id> [--capability <cap>]  Bind task to change
`);
  }, [store, args]);

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
      <Text>{output}</Text>
    </Box>
  );
}
