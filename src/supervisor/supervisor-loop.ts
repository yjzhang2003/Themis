import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { SessionMonitor } from './monitor.js';
import { TaskLauncher } from './launcher.js';
import { TaskStatusMonitor, TaskStatus } from './status-monitor.js';
import { SessionState, SupervisorConfig, SupervisorConfigSchema } from './types.js';
import { GlobalLibraryStore } from '../global-library/index.js';

export interface SupervisorLoopConfig {
  checkIntervalMs: number;
  stuckThresholdMs: number;
  maxRestartAttempts: number;
  restartCooldownMs: number;
  autoRestart: boolean;
  supervisorSessionName: string;
}

export type DecisionAction = 'continue' | 'restart' | 'review' | 'notify';

export interface Decision {
  action: DecisionAction;
  reason: string;
  taskId: string;
  details?: Record<string, unknown>;
}

export interface ReviewItem {
  taskId: string;
  taskDir: string;
  reason: string;
  status: TaskStatus;
  decision: Decision;
  timestamp: string;
}

const DEFAULT_CONFIG: SupervisorLoopConfig = {
  checkIntervalMs: 5000,
  stuckThresholdMs: 300000, // 5 minutes
  maxRestartAttempts: 3,
  restartCooldownMs: 60000, // 1 minute
  autoRestart: true,
  supervisorSessionName: 'ths-supervisor',
};

export class SupervisorLoop {
  private config: SupervisorLoopConfig;
  private monitor: SessionMonitor;
  private launcher: TaskLauncher;
  private statusMonitor: TaskStatusMonitor;
  private globalLibrary: GlobalLibraryStore;
  private running: boolean;
  private intervalId: ReturnType<typeof setInterval> | null;
  private restartCooldowns: Map<string, number>;
  private restartCounts: Map<string, number>;
  private reviewQueue: ReviewItem[];
  private taskDirs: Map<string, string>; // taskId -> taskDir

  constructor(config?: Partial<SupervisorLoopConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.monitor = new SessionMonitor(join(homedir(), '.claude', 'themis', 'sessions'));
    this.launcher = new TaskLauncher();
    this.statusMonitor = new TaskStatusMonitor();
    this.globalLibrary = new GlobalLibraryStore();
    this.running = false;
    this.intervalId = null;
    this.restartCooldowns = new Map();
    this.restartCounts = new Map();
    this.reviewQueue = [];
    this.taskDirs = new Map();
  }

  /**
   * Start the supervisor loop
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    console.log(`[SupervisorLoop] Started with config:`, this.config);

    // Register all existing tasks
    this.registerAllTasks();

    // Start the loop
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the supervisor loop
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[SupervisorLoop] Stopped');
  }

  /**
   * Register a task directory for monitoring
   */
  registerTask(taskId: string, taskDir: string): void {
    this.taskDirs.set(taskId, taskDir);
    console.log(`[SupervisorLoop] Registered task: ${taskId} at ${taskDir}`);
  }

  /**
   * Unregister a task
   */
  unregisterTask(taskId: string): void {
    this.taskDirs.delete(taskId);
    this.restartCooldowns.delete(taskId);
    this.restartCounts.delete(taskId);
    // Remove from review queue
    this.reviewQueue = this.reviewQueue.filter(r => r.taskId !== taskId);
  }

  /**
   * Register all tasks from the global task index
   */
  private registerAllTasks(): void {
    try {
      // This will be called from the task store to register all tasks
      // For now, we rely on explicit registerTask calls
    } catch (e) {
      console.error('[SupervisorLoop] Failed to register tasks:', e);
    }
  }

  /**
   * Main loop tick
   */
  tick(): void {
    if (!this.running) {
      return;
    }

    try {
      // Check all tmux sessions
      const sessions = this.monitor.checkAllSessions();

      // Process each registered task
      for (const [taskId, taskDir] of this.taskDirs) {
        const session = sessions.find(s => s.task_id === taskId);
        const status = this.statusMonitor.readStatus(taskDir);

        // Make decision
        const decision = this.decideForTask(taskId, taskDir, session || null, status);

        // Execute decision
        this.executeDecision(decision, taskDir);

        // Clean up cooldown if expired
        this.cleanupCooldown(taskId);
      }

      // Clean up stale sessions
      this.cleanupStaleSessions();
    } catch (e) {
      console.error('[SupervisorLoop] Tick error:', e);
    }
  }

  /**
   * Make a decision for a specific task
   */
  decideForTask(
    taskId: string,
    taskDir: string,
    session: SessionState | null,
    status: TaskStatus | null
  ): Decision {
    // Case 1: No status file yet (task just started)
    if (!status) {
      return { action: 'continue', reason: 'no_status_file', taskId };
    }

    // Case 2: Needs review flagged
    if (status.needs_review && status.review_reason) {
      return {
        action: 'review',
        reason: status.review_reason,
        taskId,
        details: { phase: status.phase, progress: status.progress_percent },
      };
    }

    // Case 3: tmux session is dead
    if (!session || session.status === 'dead') {
      if (this.canAutoRestart(taskId)) {
        return { action: 'restart', reason: 'session_dead', taskId };
      } else {
        return { action: 'notify', reason: 'session_dead_requires_user', taskId };
      }
    }

    // Case 4: Stuck detection (no activity for threshold)
    if (this.statusMonitor.isStuck(status, this.config.stuckThresholdMs)) {
      if (status.needs_review) {
        return {
          action: 'review',
          reason: status.review_reason || 'stuck_and_needs_review',
          taskId,
          details: { stuckDuration: this.getStuckDuration(status) },
        };
      } else {
        return { action: 'restart', reason: 'stuck_no_progress', taskId };
      }
    }

    // Case 5: Too many errors
    if (status.errors.length > 10) {
      return {
        action: 'review',
        reason: 'too_many_errors',
        taskId,
        details: { errorCount: status.errors.length },
      };
    }

    // Case 6: Phase/step completed - checkpoint reached
    // This is handled by the needs_review flag being set by the hook

    // Default: continue
    return { action: 'continue', reason: 'ok', taskId };
  }

  /**
   * Execute a decision
   */
  executeDecision(decision: Decision, taskDir: string): void {
    switch (decision.action) {
      case 'continue':
        // No action needed
        break;

      case 'restart':
        this.handleRestart(decision.taskId, taskDir, decision.reason);
        break;

      case 'review':
        this.handleReview(decision, taskDir);
        break;

      case 'notify':
        this.handleNotify(decision);
        break;
    }
  }

  /**
   * Handle task restart
   */
  private handleRestart(taskId: string, taskDir: string, reason: string): void {
    if (this.isInCooldown(taskId)) {
      console.log(`[SupervisorLoop] ${taskId}: skip restart (in cooldown)`);
      return;
    }

    const count = this.restartCounts.get(taskId) || 0;
    if (count >= this.config.maxRestartAttempts) {
      console.log(`[SupervisorLoop] ${taskId}: max restart attempts reached (${count})`);
      this.queueReview(taskId, taskDir, 'max_restart_attempts');
      return;
    }

    console.log(`[SupervisorLoop] ${taskId}: restarting (reason: ${reason}, attempt: ${count + 1})`);

    // Stop existing session
    this.launcher.stop(taskId);

    // Re-launch after a brief delay
    setTimeout(() => {
      try {
        // Build launch config from task
        const launchConfig = this.buildLaunchConfig(taskId, taskDir);
        this.launcher.launch(launchConfig);

        // Update counters
        this.restartCounts.set(taskId, count + 1);
        this.restartCooldowns.set(taskId, Date.now() + this.config.restartCooldownMs);

        // Update status
        this.statusMonitor.updateStatus(taskDir, {
          phase: 'restarting',
          step: 'recovery',
        });
      } catch (e) {
        console.error(`[SupervisorLoop] ${taskId}: restart failed:`, e);
      }
    }, 1000);
  }

  /**
   * Handle review needed
   */
  private handleReview(decision: Decision, taskDir: string): void {
    const status = this.statusMonitor.readStatus(taskDir);
    if (!status) {
      return;
    }

    // Check if already in queue
    const existing = this.reviewQueue.find(r => r.taskId === decision.taskId);
    if (existing) {
      return;
    }

    console.log(`[SupervisorLoop] ${decision.taskId}: queued for review (reason: ${decision.reason})`);

    this.queueReview(decision.taskId, taskDir, decision.reason);
  }

  /**
   * Handle notification needed
   */
  private handleNotify(decision: Decision): void {
    console.log(`[SupervisorLoop] ${decision.taskId}: NOTIFY - ${decision.reason}`);
    // TODO: Implement notification (could be terminal bell, file write, etc.)
  }

  /**
   * Queue a task for review
   */
  private queueReview(taskId: string, taskDir: string, reason: string): void {
    const status = this.statusMonitor.readStatus(taskDir);
    if (!status) {
      return;
    }

    this.reviewQueue.push({
      taskId,
      taskDir,
      reason,
      status,
      decision: { action: 'review', reason, taskId },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Build launch config for a task
   */
  private buildLaunchConfig(taskId: string, taskDir: string) {
    // Read task from store to get skills and hooks
    // For now, we'll get them from the status file's linked resources
    const status = this.statusMonitor.readStatus(taskDir);
    const globalLib = new GlobalLibraryStore();

    return {
      taskId,
      taskDir,
      skills: [], // Will be populated from task store
      hooks: [],   // Will be populated from task store
      rules: [],
      globalLibraryPath: globalLib.getGlobalPath(),
    };
  }

  /**
   * Check if task can be auto-restarted
   */
  private canAutoRestart(taskId: string): boolean {
    if (!this.config.autoRestart) {
      return false;
    }

    const count = this.restartCounts.get(taskId) || 0;
    return count < this.config.maxRestartAttempts;
  }

  /**
   * Check if task is in cooldown period
   */
  private isInCooldown(taskId: string): boolean {
    const cooldownEnd = this.restartCooldowns.get(taskId);
    if (!cooldownEnd) {
      return false;
    }

    if (Date.now() > cooldownEnd) {
      // Cooldown expired
      this.restartCooldowns.delete(taskId);
      return false;
    }

    return true;
  }

  /**
   * Clean up cooldown for a task
   */
  private cleanupCooldown(taskId: string): void {
    const cooldownEnd = this.restartCooldowns.get(taskId);
    if (cooldownEnd && Date.now() > cooldownEnd) {
      this.restartCooldowns.delete(taskId);
      this.restartCounts.delete(taskId);
    }
  }

  /**
   * Clean up sessions that no longer have a task registered
   */
  private cleanupStaleSessions(): void {
    // Remove review items for tasks that no longer exist
    this.reviewQueue = this.reviewQueue.filter(r => this.taskDirs.has(r.taskId));
  }

  /**
   * Get stuck duration in milliseconds
   */
  private getStuckDuration(status: TaskStatus): number {
    const lastActivity = this.statusMonitor.getLastActivityTime(status);
    if (!lastActivity) {
      return 0;
    }
    return Date.now() - lastActivity.getTime();
  }

  /**
   * Get pending reviews
   */
  getPendingReviews(): ReviewItem[] {
    return [...this.reviewQueue];
  }

  /**
   * Approve and continue a reviewed task
   */
  approveReview(taskId: string): void {
    const item = this.reviewQueue.find(r => r.taskId === taskId);
    if (!item) {
      return;
    }

    // Clear needs_review flag
    this.statusMonitor.clearNeedsReview(item.taskDir);

    // Remove from queue
    this.reviewQueue = this.reviewQueue.filter(r => r.taskId !== taskId);

    // Reset restart count
    this.restartCounts.delete(taskId);

    console.log(`[SupervisorLoop] ${taskId}: review approved, continuing`);
  }

  /**
   * Reject a reviewed task
   */
  rejectReview(taskId: string): void {
    const item = this.reviewQueue.find(r => r.taskId === taskId);
    if (!item) {
      return;
    }

    // Stop the task
    this.launcher.stop(taskId);

    // Remove from queue
    this.reviewQueue = this.reviewQueue.filter(r => r.taskId !== taskId);

    console.log(`[SupervisorLoop] ${taskId}: review rejected, task stopped`);
  }

  /**
   * Check if supervisor is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current config
   */
  getConfig(): SupervisorLoopConfig {
    return { ...this.config };
  }
}
