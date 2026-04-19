import type { ProviderType } from './providers/base.js';

// tmux session info
export interface TmuxSession {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
}

// Task launch configuration
export interface LaunchConfig {
  taskId: string;
  taskDir: string;
  provider?: ProviderType;
  skills: string[];
  hooks: string[];
  rules: string[];
  globalLibraryPath: string;
  localLibraryPath?: string;
  env?: Record<string, string>;
}
