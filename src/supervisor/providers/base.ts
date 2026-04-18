import type { LaunchConfig } from '../types.js';
import { ClaudeCodeProvider } from './claude-code.js';
import { CodexProvider } from './codex.js';

export type ProviderType = 'claude' | 'codex';

export interface IsolatedHomeResult {
  homeDir: string;
  configDir: string;
}

export interface AICliProvider {
  readonly type: ProviderType;

  buildIsolationEnv(config: LaunchConfig): Record<string, string>;

  prepareIsolatedHome(taskDir: string, config: LaunchConfig): IsolatedHomeResult;

  buildLaunchCommand(isolatedHome: IsolatedHomeResult): string;

  label(): string;

  globalConfigDir(): string;

  sessionName(taskId: string): string;
}

let claudeProvider: AICliProvider | undefined;
let codexProvider: AICliProvider | undefined;

export function getProvider(type: ProviderType): AICliProvider {
  switch (type) {
    case 'claude':
      if (!claudeProvider) {
        claudeProvider = new ClaudeCodeProvider();
      }
      return claudeProvider;
    case 'codex':
      if (!codexProvider) {
        codexProvider = new CodexProvider();
      }
      return codexProvider;
  }
}
