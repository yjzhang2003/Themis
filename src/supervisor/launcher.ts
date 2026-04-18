import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync, symlinkSync, unlinkSync, cpSync, rmSync } from 'fs';
import { TmuxManager } from './tmux.js';
import { LaunchConfig } from './types.js';

export class TaskLauncher {
  private tmux: TmuxManager;

  constructor() {
    this.tmux = new TmuxManager();
  }

  /**
   * Build isolation environment variables
   */
  buildIsolationEnv(config: LaunchConfig): Record<string, string> {
    const env: Record<string, string> = {};

    // Task ID for identification
    env['CLAUDE_TASK_ID'] = config.taskId;

    // Workspace restriction
    env['CLAUDE_WORKSPACE_RESTRICT'] = '1';
    env['CLAUDE_WORKSPACE_ROOT'] = config.taskDir;

    // Merge custom env vars
    if (config.env) {
      Object.assign(env, config.env);
    }

    return env;
  }

  /**
   * Launch Claude Code in a tmux session with isolated HOME
   */
  launch(config: LaunchConfig): string {
    const sessionName = `th-task-${config.taskId}`;
    const taskHomeDir = join('/tmp', `.themis-${config.taskId}-home`);

    // Kill existing session if any
    if (this.tmux.sessionExists(sessionName)) {
      this.tmux.killSession(sessionName);
    }

    // Clean up any existing temp home for this task
    if (existsSync(taskHomeDir)) {
      rmSync(taskHomeDir, { recursive: true, force: true });
    }

    // Create isolated HOME directory
    mkdirSync(taskHomeDir, { recursive: true });

    // Copy or link task's .claude config to isolated HOME
    const taskClaudeDir = join(config.taskDir, '.claude');
    const isolatedClaudeDir = join(taskHomeDir, '.claude');

    if (existsSync(taskClaudeDir)) {
      // Copy task's .claude to isolated HOME
      cpSync(taskClaudeDir, isolatedClaudeDir, { recursive: true });
    } else {
      // Create minimal .claude with empty skills/hooks
      mkdirSync(isolatedClaudeDir, { recursive: true });
      writeFileSync(join(isolatedClaudeDir, 'settings.json'), JSON.stringify({ skills: [], hooks: {} }, null, 2));
    }

    // Merge system's API credentials into isolated settings.json
    const globalSettingsPath = join(homedir(), '.claude', 'settings.json');
    const isolatedSettingsPath = join(isolatedClaudeDir, 'settings.json');
    if (existsSync(globalSettingsPath)) {
      try {
        const globalSettings = JSON.parse(readFileSync(globalSettingsPath, 'utf-8'));
        let isolatedSettings = JSON.parse(readFileSync(isolatedSettingsPath, 'utf-8'));

        // Merge env credentials from global settings
        if (globalSettings.env) {
          isolatedSettings.env = { ...globalSettings.env, ...isolatedSettings.env };
        }

        writeFileSync(isolatedSettingsPath, JSON.stringify(isolatedSettings, null, 2));
      } catch {
        // Ignore errors reading/parsing settings
      }
    }

    // Build environment with isolated HOME
    const env: Record<string, string> = {
      ...this.buildIsolationEnv(config),
      HOME: taskHomeDir,
    };

    // Create tmux session with isolated HOME
    this.tmux.createTaskSession(config.taskId, config.taskDir, env);

    // Send command to start Claude Code with isolated HOME
    this.tmux.sendKeys(sessionName, `HOME='${taskHomeDir}' claude`);

    return sessionName;
  }

  /**
   * Launch with custom command (e.g., with specific prompts)
   */
  launchWithCommand(sessionName: string, command: string, workingDir: string, env: Record<string, string> = {}): string {
    // Kill existing session if any
    if (this.tmux.sessionExists(sessionName)) {
      this.tmux.killSession(sessionName);
    }

    // Create tmux session
    this.tmux.createTaskSession(sessionName.replace('th-task-', ''), workingDir, env);

    // Send the command
    this.tmux.sendKeys(sessionName, command);

    return sessionName;
  }

  /**
   * Stop a running task
   */
  stop(taskId: string): void {
    const sessionName = `th-task-${taskId}`;
    this.tmux.killSession(sessionName);
  }

  /**
   * Send input to a running task
   */
  sendInput(taskId: string, input: string): void {
    const sessionName = `th-task-${taskId}`;
    this.tmux.sendKeys(sessionName, input);
  }

  /**
   * Get session output (for logs)
   */
  getSessionOutput(taskId: string): string {
    const sessionName = `th-task-${taskId}`;
    return this.tmux.capturePane(sessionName);
  }

  /**
   * Check if a task is running
   */
  isRunning(taskId: string): boolean {
    const sessionName = `th-task-${taskId}`;
    const state = this.tmux.getSession(sessionName);
    return state !== null;
  }
}
