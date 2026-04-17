import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { existsSync } from 'fs';
import { TaskStore } from '../task/store.js';
import { LibraryStore } from '../library/store.js';

interface CLIContextType {
  store: TaskStore | null;
  library: LibraryStore | null;
  workspaceRoot: string;
  args: Record<string, unknown>;
  command: string;
  subcommand: string;
  showHelp: () => boolean;
}

const CLIContext = createContext<CLIContextType>({
  store: null,
  library: null,
  workspaceRoot: process.cwd(),
  args: {},
  command: '',
  subcommand: '',
  showHelp: () => false,
});

export function useCLI() {
  return useContext(CLIContext);
}

interface CLIProviderProps {
  children: ReactNode;
}

export function CLIProvider({ children }: CLIProviderProps) {
  // Parse args synchronously
  const parsedArgs = useMemo(() => parseArgs(), []);
  const cmd = (parsedArgs._[0] as string) || '';
  const sub = (parsedArgs._[1] as string) || '';

  // Find workspace root synchronously - only check current directory
  const workspaceRoot = useMemo(() => {
    const root = process.env.ORIGINAL_PWD || process.cwd();
    if (existsSync(`${root}/harness.yaml`)) {
      return root;
    }
    return root; // Use current directory even without harness.yaml
  }, []);

  // Initialize stores synchronously
  const store = useMemo(() => {
    const taskStore = new TaskStore();
    taskStore.ensureDirectories();
    return taskStore;
  }, []);

  const library = useMemo(() => {
    const libStore = new LibraryStore(workspaceRoot);
    libStore.ensureDirectories();
    return libStore;
  }, [workspaceRoot]);

  const help = parsedArgs.h || parsedArgs.help || false;

  const context = useMemo(
    () => ({ store, library, workspaceRoot, args: parsedArgs, command: cmd, subcommand: sub, showHelp: () => help }),
    [store, library, workspaceRoot, parsedArgs, cmd, sub, help]
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
