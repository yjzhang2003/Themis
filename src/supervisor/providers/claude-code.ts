import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs';
import type { AICliProvider, IsolatedHomeResult } from './base.js';
import type { LaunchConfig } from '../types.js';

export class ClaudeCodeProvider implements AICliProvider {
  readonly type = 'claude' as const;

  label(): string {
    return 'Claude Code';
  }

  globalConfigDir(): string {
    return join(homedir(), '.claude');
  }

  sessionName(taskId: string): string {
    return `th-claude-${taskId}`;
  }

  buildIsolationEnv(_config: LaunchConfig): Record<string, string> {
    return {
      CLAUDE_TASK_ID: _config.taskId,
      CLAUDE_WORKSPACE_RESTRICT: '1',
      CLAUDE_WORKSPACE_ROOT: _config.taskDir,
    };
  }

  prepareIsolatedHome(taskDir: string, config: LaunchConfig): IsolatedHomeResult {
    const taskHomeDir = join('/tmp', `.themis-${config.taskId}-home`);
    const taskConfigDir = join(taskDir, '.claude');
    const isolatedConfigDir = join(taskHomeDir, '.claude');

    mkdirSync(taskHomeDir, { recursive: true });

    if (existsSync(taskConfigDir)) {
      cpSync(taskConfigDir, isolatedConfigDir, { recursive: true });
    } else {
      mkdirSync(isolatedConfigDir, { recursive: true });
      writeFileSync(
        join(isolatedConfigDir, 'settings.json'),
        JSON.stringify({ skills: [], hooks: {} }, null, 2)
      );
    }

    // Merge API credentials from global settings
    const globalSettingsPath = join(this.globalConfigDir(), 'settings.json');
    const isolatedSettingsPath = join(isolatedConfigDir, 'settings.json');
    if (existsSync(globalSettingsPath) && existsSync(isolatedSettingsPath)) {
      try {
        const globalSettings = JSON.parse(readFileSync(globalSettingsPath, 'utf-8'));
        const isolatedSettings = JSON.parse(readFileSync(isolatedSettingsPath, 'utf-8'));
        if (globalSettings.env) {
          isolatedSettings.env = { ...globalSettings.env, ...isolatedSettings.env };
        }
        writeFileSync(isolatedSettingsPath, JSON.stringify(isolatedSettings, null, 2));
      } catch {
        // Ignore errors
      }
    }

    return { homeDir: taskHomeDir, configDir: isolatedConfigDir };
  }

  buildLaunchCommand(isolatedHome: IsolatedHomeResult): string {
    return `HOME='${isolatedHome.homeDir}' claude`;
  }
}
