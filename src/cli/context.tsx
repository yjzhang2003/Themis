import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { existsSync } from 'fs';
import { TaskStore } from '../task/store.js';

interface CLIContextType {
  store: TaskStore | null;
  workspaceRoot: string;
  args: Record<string, unknown>;
  command: string;
  showHelp: () => boolean;
}

const CLIContext = createContext<CLIContextType>({
  store: null,
  workspaceRoot: process.cwd(),
  args: {},
  command: '',
  showHelp: () => false,
});

export function useCLI() {
  return useContext(CLIContext);
}

interface CLIProviderProps {
  children: ReactNode;
}

export function CLIProvider({ children }: CLIProviderProps) {
  const [store, setStore] = useState<TaskStore | null>(null);
  const [workspaceRoot] = useState(() => process.cwd());
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const [command, setCommand] = useState('');
  const [help, setHelp] = useState(false);

  useEffect(() => {
    // Parse command line arguments
    const cliArgs = parseArgs();
    setArgs(cliArgs);

    const cmd = (cliArgs._[0] as string) || '';
    setCommand(cmd);
    setHelp(cliArgs.h || cliArgs.help || false);

    // Find workspace root by looking for harness.yaml
    // Start from current directory and walk up
    let root = process.cwd();
    let current = root;
    let found = false;
    const maxIter = 20;
    let iter = 0;

    // First check if current dir has harness.yaml
    if (existsSync(`${current}/harness.yaml`)) {
      root = current;
      found = true;
    }

    // If not found, walk up parent directories
    while (iter < maxIter && !found) {
      const configPath = `${current}/harness.yaml`;
      try {
        if (existsSync(configPath)) {
          root = current;
          found = true;
        }
      } catch {}

      if (!found) {
        const parent = `${current}/..`;
        if (parent === current) break;
        current = parent;
      }
      iter++;
    }

    if (found) {
      const taskStore = new TaskStore(root);
      taskStore.ensureDirectories();
      setStore(taskStore);
    }
  }, []);

  const showHelp = () => help;

  const context = useMemo(
    () => ({ store, workspaceRoot, args, command, showHelp }),
    [store, workspaceRoot, args, command, help]
  );

  return <CLIContext.Provider value={context}>{children}</CLIContext.Provider>;
}

function parseArgs(): Record<string, unknown> {
  const args: Record<string, unknown> = { _: [] };

  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      args.h = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      args[key] = true;
    } else {
      (args._ as unknown[]).push(arg);
    }
  }

  return args;
}
