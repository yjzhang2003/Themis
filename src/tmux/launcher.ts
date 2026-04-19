import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { TmuxManager } from './tmux.js';
import { LaunchConfig } from './types.js';
import { getProvider, type ProviderType } from './providers/base.js';

export class TaskLauncher {
  private tmux: TmuxManager;

  constructor() {
    this.tmux = new TmuxManager();
  }

  /**
   * Launch AI CLI in a tmux session with isolated HOME
   */
  launch(config: LaunchConfig): string {
    const providerType = config.provider ?? 'claude';
    const provider = getProvider(providerType);
    const sessionName = provider.sessionName(config.taskId);
    const taskHomeDir = join('/tmp', `.themis-${config.taskId}-home`);

    // Kill existing session for this task (any provider)
    for (const pt of ['claude', 'codex'] as ProviderType[]) {
      const sn = getProvider(pt).sessionName(config.taskId);
      if (this.tmux.sessionExists(sn)) {
        this.tmux.killSession(sn);
      }
    }

    // Clean up any existing temp home for this task
    if (existsSync(taskHomeDir)) {
      rmSync(taskHomeDir, { recursive: true, force: true });
    }

    // Prepare isolated HOME directory with provider-specific config
    const isolated = provider.prepareIsolatedHome(config.taskDir, config);

    // Build environment with isolated HOME + provider-specific vars
    const env: Record<string, string> = {
      ...provider.buildIsolationEnv(config),
      HOME: isolated.homeDir,
    };

    // Merge custom env vars
    if (config.env) {
      Object.assign(env, config.env);
    }

    // Create tmux session with isolated HOME
    this.tmux.createSession(sessionName, config.taskDir, env);

    // Send command to start the AI CLI
    this.tmux.sendKeys(sessionName, provider.buildLaunchCommand(isolated));

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
  stop(taskId: string, provider: ProviderType = 'claude'): void {
    const providerInstance = getProvider(provider);
    const sessionName = providerInstance.sessionName(taskId);
    this.tmux.killSession(sessionName);
  }

  /**
   * Send input to a running task
   */
  sendInput(taskId: string, input: string, provider: ProviderType = 'claude'): void {
    const sessionName = getProvider(provider).sessionName(taskId);
    this.tmux.sendKeys(sessionName, input);
  }

  /**
   * Get session output (for logs)
   */
  getSessionOutput(taskId: string, provider: ProviderType = 'claude'): string {
    const sessionName = getProvider(provider).sessionName(taskId);
    return this.tmux.capturePane(sessionName);
  }

  /**
   * Check if a task is running
   */
  isRunning(taskId: string, provider: ProviderType = 'claude'): boolean {
    const sessionName = getProvider(provider).sessionName(taskId);
    const state = this.tmux.getSession(sessionName);
    return state !== null;
  }
}
