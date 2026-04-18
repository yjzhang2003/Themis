import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

export interface TaskStatus {
  task_id: string;
  phase: string;
  step: string;
  last_activity: string;
  last_tool: string;
  progress_percent: number;
  messages_count: number;
  errors: string[];
  spec_checkpoints: Record<string, boolean>;
  needs_review: boolean;
  review_reason: string | null;
}

const DEFAULT_STATUS: Omit<TaskStatus, 'task_id'> = {
  phase: 'initialized',
  step: 'initial',
  last_activity: new Date().toISOString(),
  last_tool: '',
  progress_percent: 0,
  messages_count: 0,
  errors: [],
  spec_checkpoints: {},
  needs_review: false,
  review_reason: null,
};

export class TaskStatusMonitor {
  private baseDir: string;

  constructor(baseDir?: string) {
    // Default to ~/.themis/ for task statuses
    this.baseDir = baseDir || join(homedir(), '.themis');
  }

  /**
   * Get the status file path for a task
   */
  getStatusPath(taskDir: string): string {
    return join(taskDir, '.themis', 'status.json');
  }

  /**
   * Get the log directory for a task
   */
  getLogDir(taskDir: string): string {
    return join(taskDir, '.themis', 'log');
  }

  /**
   * Read status from a task's status file
   */
  readStatus(taskDir: string): TaskStatus | null {
    const statusPath = this.getStatusPath(taskDir);
    if (!existsSync(statusPath)) {
      return null;
    }

    try {
      const content = readFileSync(statusPath, 'utf-8');
      return JSON.parse(content) as TaskStatus;
    } catch {
      return null;
    }
  }

  /**
   * Initialize status file for a new task
   */
  initStatus(taskId: string, taskDir: string): TaskStatus {
    const statusDir = join(taskDir, '.themis');
    mkdirSync(statusDir, { recursive: true });

    const status: TaskStatus = {
      task_id: taskId,
      ...DEFAULT_STATUS,
      last_activity: new Date().toISOString(),
    };

    this.writeStatus(taskDir, status);
    return status;
  }

  /**
   * Write full status to file
   */
  writeStatus(taskDir: string, status: TaskStatus): void {
    const statusDir = join(taskDir, '.themis');
    mkdirSync(statusDir, { recursive: true });

    const statusPath = this.getStatusPath(taskDir);
    writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf-8');
  }

  /**
   * Update specific fields in status
   */
  updateStatus(taskDir: string, updates: Partial<TaskStatus>): TaskStatus | null {
    const status = this.readStatus(taskDir);
    if (!status) {
      return null;
    }

    const updated: TaskStatus = {
      ...status,
      ...updates,
      last_activity: new Date().toISOString(),
    };

    this.writeStatus(taskDir, updated);
    return updated;
  }

  /**
   * Append an error message
   */
  appendError(taskDir: string, error: string): TaskStatus | null {
    const status = this.readStatus(taskDir);
    if (!status) {
      return null;
    }

    status.errors.push(error);
    status.last_activity = new Date().toISOString();

    this.writeStatus(taskDir, status);
    return status;
  }

  /**
   * Mark a spec checkpoint as reached
   */
  markCheckpoint(taskDir: string, checkpoint: string): TaskStatus | null {
    const status = this.readStatus(taskDir);
    if (!status) {
      return null;
    }

    status.spec_checkpoints[checkpoint] = true;
    status.last_activity = new Date().toISOString();

    this.writeStatus(taskDir, status);
    return status;
  }

  /**
   * Set that this task needs human review
   */
  setNeedsReview(taskDir: string, reason: string): TaskStatus | null {
    const status = this.readStatus(taskDir);
    if (!status) {
      return null;
    }

    status.needs_review = true;
    status.review_reason = reason;
    status.last_activity = new Date().toISOString();

    this.writeStatus(taskDir, status);
    return status;
  }

  /**
   * Clear the needs_review flag after review is done
   */
  clearNeedsReview(taskDir: string): TaskStatus | null {
    const status = this.readStatus(taskDir);
    if (!status) {
      return null;
    }

    status.needs_review = false;
    status.review_reason = null;
    status.last_activity = new Date().toISOString();

    this.writeStatus(taskDir, status);
    return status;
  }

  /**
   * Update phase and step
   */
  setPhase(taskDir: string, phase: string, step: string): TaskStatus | null {
    return this.updateStatus(taskDir, { phase, step });
  }

  /**
   * Update progress percentage
   */
  setProgress(taskDir: string, percent: number): TaskStatus | null {
    return this.updateStatus(taskDir, { progress_percent: Math.min(100, Math.max(0, percent)) });
  }

  /**
   * Increment message count
   */
  incrementMessages(taskDir: string): TaskStatus | null {
    const status = this.readStatus(taskDir);
    if (!status) {
      return null;
    }

    status.messages_count += 1;
    status.last_activity = new Date().toISOString();

    this.writeStatus(taskDir, status);
    return status;
  }

  /**
   * Get last activity time as Date
   */
  getLastActivityTime(status: TaskStatus): Date | null {
    if (!status.last_activity) {
      return null;
    }
    const parsed = new Date(status.last_activity);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Check if task is stuck (no activity for threshold milliseconds)
   */
  isStuck(status: TaskStatus, thresholdMs: number): boolean {
    const lastActivity = this.getLastActivityTime(status);
    if (!lastActivity) {
      return false;
    }

    const now = new Date();
    const elapsed = now.getTime() - lastActivity.getTime();
    return elapsed > thresholdMs;
  }

  /**
   * Get all checkpoints that have been reached
   */
  getReachedCheckpoints(status: TaskStatus): string[] {
    return Object.entries(status.spec_checkpoints)
      .filter(([, reached]) => reached)
      .map(([checkpoint]) => checkpoint);
  }

  /**
   * Get pending (not reached) checkpoints
   */
  getPendingCheckpoints(status: TaskStatus): string[] {
    return Object.entries(status.spec_checkpoints)
      .filter(([, reached]) => !reached)
      .map(([checkpoint]) => checkpoint);
  }

  /**
   * Check if any checkpoint was just reached
   */
  hasCheckpointJustReached(status: TaskStatus, previousStatus: TaskStatus | null): string[] {
    if (!previousStatus) {
      return this.getReachedCheckpoints(status);
    }

    const current = this.getReachedCheckpoints(status);
    const previous = this.getReachedCheckpoints(previousStatus);

    return current.filter(cp => !previous.includes(cp));
  }
}
