import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs';
import type { AICliProvider, IsolatedHomeResult } from './base.js';
import type { LaunchConfig } from '../types.js';

export class CodexProvider implements AICliProvider {
  readonly type = 'codex' as const;

  label(): string {
    return 'OpenAI Codex';
  }

  globalConfigDir(): string {
    return join(homedir(), '.codex');
  }

  sessionName(taskId: string): string {
    return `th-codex-${taskId}`;
  }

  buildIsolationEnv(_config: LaunchConfig): Record<string, string> {
    return {
      CODEX_TASK_ID: _config.taskId,
      CODEX_WORKSPACE_RESTRICT: '1',
      CODEX_WORKSPACE_ROOT: _config.taskDir,
    };
  }

  prepareIsolatedHome(taskDir: string, config: LaunchConfig): IsolatedHomeResult {
    const taskHomeDir = join('/tmp', `.themis-${config.taskId}-home`);
    const taskConfigDir = join(taskDir, '.codex');
    const isolatedConfigDir = join(taskHomeDir, '.codex');

    mkdirSync(taskHomeDir, { recursive: true });

    if (existsSync(taskConfigDir)) {
      cpSync(taskConfigDir, isolatedConfigDir, { recursive: true });
    } else {
      mkdirSync(isolatedConfigDir, { recursive: true });
      // Codex uses config.json instead of settings.json
      writeFileSync(
        join(isolatedConfigDir, 'config.json'),
        JSON.stringify({ skills: [], hooks: {} }, null, 2)
      );
    }

    // Merge API credentials from global Codex config
    const globalConfigPath = join(this.globalConfigDir(), 'config.json');
    const isolatedConfigPath = join(isolatedConfigDir, 'config.json');
    if (existsSync(globalConfigPath) && existsSync(isolatedConfigPath)) {
      try {
        const globalConfig = JSON.parse(readFileSync(globalConfigPath, 'utf-8'));
        const isolatedConfig = JSON.parse(readFileSync(isolatedConfigPath, 'utf-8'));
        // Codex stores API key under apiKey field
        if (globalConfig.apiKey) {
          isolatedConfig.apiKey = globalConfig.apiKey;
        }
        writeFileSync(isolatedConfigPath, JSON.stringify(isolatedConfig, null, 2));
      } catch {
        // Ignore errors
      }
    }

    return { homeDir: taskHomeDir, configDir: isolatedConfigDir };
  }

  buildLaunchCommand(isolatedHome: IsolatedHomeResult): string {
    return `HOME='${isolatedHome.homeDir}' codex`;
  }
}
