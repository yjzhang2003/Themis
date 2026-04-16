import { homedir } from 'os';
import { join } from 'path';
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

    // Build paths for attached resources
    const skillPaths: string[] = [];
    const hookPaths: string[] = [];
    const rulePaths: string[] = [];

    for (const skillId of config.skills) {
      // Check global library
      const globalPath = join(config.globalLibraryPath, 'skills', skillId);
      skillPaths.push(globalPath);
    }

    for (const hookId of config.hooks) {
      const globalPath = join(config.globalLibraryPath, 'hooks', hookId);
      hookPaths.push(globalPath);
    }

    for (const ruleId of config.rules) {
      const globalPath = join(config.globalLibraryPath, 'rules', ruleId);
      rulePaths.push(globalPath);
    }

    // Set isolation environment variables
    // Claude Code would read these to know what to load
    if (skillPaths.length > 0) {
      env['CLAUDE_SKILLS_PATH'] = skillPaths.join(':');
    }
    if (hookPaths.length > 0) {
      env['CLAUDE_HOOKS_PATH'] = hookPaths.join(':');
    }
    if (rulePaths.length > 0) {
      env['CLAUDE_RULES_PATH'] = rulePaths.join(':');
    }

    // Workspace restriction - Claude Code should only operate within task directory
    if (skillPaths.length > 0 || hookPaths.length > 0 || rulePaths.length > 0) {
      env['CLAUDE_WORKSPACE_RESTRICT'] = '1';
      env['CLAUDE_WORKSPACE_ROOT'] = config.taskDir;
    }

    // Task ID for identification
    env['CLAUDE_TASK_ID'] = config.taskId;

    // Merge custom env vars
    if (config.env) {
      Object.assign(env, config.env);
    }

    return env;
  }

  /**
   * Launch Claude Code in a tmux session
   */
  launch(config: LaunchConfig): string {
    const sessionName = `th-task-${config.taskId}`;
    const env = this.buildIsolationEnv(config);

    // Kill existing session if any
    if (this.tmux.sessionExists(sessionName)) {
      this.tmux.killSession(sessionName);
    }

    // Create tmux session
    this.tmux.createTaskSession(config.taskId, config.taskDir, env);

    // Give Claude Code launch command
    // The actual command depends on how Claude Code is installed
    const claudeCmd = 'claude';

    // Send the command to start Claude Code
    this.tmux.sendKeys(sessionName, claudeCmd);

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
