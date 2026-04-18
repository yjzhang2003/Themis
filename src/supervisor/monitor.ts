import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { TmuxManager } from './tmux.js';
import { SessionState, SupervisorConfig } from './types.js';

const TASK_SESSION_PREFIXES = ['th-claude-', 'th-codex-', 'th-task-'];

export class SessionMonitor {
  private tmux: TmuxManager;
  private sessionsDir: string;
  private taskSessionPrefix: string;

  constructor(sessionsDir: string, taskSessionPrefix: string = 'th-task-') {
    this.tmux = new TmuxManager();
    this.sessionsDir = sessionsDir;
    this.taskSessionPrefix = taskSessionPrefix;
    mkdirSync(this.sessionsDir, { recursive: true });
  }

  /**
   * Check all task sessions
   */
  checkAllSessions(): SessionState[] {
    const states: SessionState[] = [];

    // Check sessions for all providers
    for (const prefix of TASK_SESSION_PREFIXES) {
      const sessions = this.tmux.listSessions(prefix);
      for (const session of sessions) {
        const state = this.checkSession(session.name);
        states.push(state);
        this.saveSessionState(state);
      }
    }

    // Clean up states for sessions that no longer exist
    this.cleanupOldSessions(states.map(s => s.task_id));

    return states;
  }

  /**
   * Check a single session by task ID (checks all provider prefixes)
   */
  checkSessionByTaskId(taskId: string): SessionState | null {
    for (const prefix of TASK_SESSION_PREFIXES) {
      const sessionName = `${prefix}${taskId}`;
      const session = this.tmux.getSession(sessionName);
      if (session) {
        const state = this.buildSessionState(session);
        this.saveSessionState(state);
        return state;
      }
    }

    // Check if we have a saved state
    const stateFile = this.getStateFile(taskId);
    if (existsSync(stateFile)) {
      try {
        const saved = JSON.parse(readFileSync(stateFile, 'utf-8')) as SessionState;
        // Update status to dead
        const updated: SessionState = {
          ...saved,
          status: 'dead',
          last_check: new Date().toISOString(),
        };
        this.saveSessionState(updated);
        return updated;
      } catch {
        // Ignore
      }
    }
    return null;
  }

  /**
   * Check a single session by tmux session name
   */
  checkSession(sessionName: string): SessionState {
    const session = this.tmux.getSession(sessionName);
    if (!session) {
      // Return dead state from saved file
      const taskId = this.extractTaskId(sessionName);
      const stateFile = this.getStateFile(taskId);
      if (existsSync(stateFile)) {
        try {
          const saved = JSON.parse(readFileSync(stateFile, 'utf-8')) as SessionState;
          return {
            ...saved,
            status: 'dead',
            last_check: new Date().toISOString(),
          };
        } catch {
          // Fall through
        }
      }
    }

    return this.buildSessionState(session || this.createDeadState(sessionName));
  }

  /**
   * Build session state from tmux session
   */
  private buildSessionState(session: { name: string; windows: number; attached: boolean }): SessionState {
    const taskId = this.extractTaskId(session.name);
    const pid = this.tmux.getSessionPid(session.name);

    // Check if the process is actually alive
    let status: 'alive' | 'dead' | 'unknown' = 'unknown';
    if (pid) {
      try {
        process.kill(pid, 0);
        status = 'alive';
      } catch {
        status = 'dead';
      }
    } else if (session.attached) {
      status = 'alive';
    }

    return {
      task_id: taskId,
      tmux_session: session.name,
      window_id: undefined,
      pid: pid || undefined,
      started_at: session.name, // Would need tmux API to get actual creation time
      last_check: new Date().toISOString(),
      status,
      exit_code: undefined,
      restart_count: 0,
    };
  }

  /**
   * Create a dead state for a session that doesn't exist
   */
  private createDeadState(sessionName: string): { name: string; windows: number; attached: boolean } {
    return {
      name: sessionName,
      windows: 0,
      attached: false,
    };
  }

  /**
   * Extract task ID from session name
   */
  private extractTaskId(sessionName: string): string {
    for (const prefix of TASK_SESSION_PREFIXES) {
      if (sessionName.startsWith(prefix)) {
        const taskId = sessionName.replace(prefix, '');
        // Validate extracted task ID to prevent path traversal
        if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) {
          throw new Error(`Invalid task ID extracted from session name: ${taskId}`);
        }
        return taskId;
      }
    }
    const taskId = sessionName.replace(this.taskSessionPrefix, '');
    if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) {
      throw new Error(`Invalid task ID extracted from session name: ${taskId}`);
    }
    return taskId;
  }

  /**
   * Get the state file path for a task
   */
  private getStateFile(taskId: string): string {
    return join(this.sessionsDir, `session-${taskId}.json`);
  }

  /**
   * Save session state to file
   */
  private saveSessionState(state: SessionState): void {
    const stateFile = this.getStateFile(state.task_id);
    writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }

  /**
   * Clean up state files for sessions that no longer exist
   */
  private cleanupOldSessions(activeTaskIds: string[]): void {
    try {
      const { readdirSync, unlinkSync } = require('fs');
      const files = readdirSync(this.sessionsDir);
      for (const file of files) {
        if (file.startsWith('session-') && file.endsWith('.json')) {
          const taskId = file.replace('session-', '').replace('.json', '');
          if (!activeTaskIds.includes(taskId)) {
            unlinkSync(join(this.sessionsDir, file));
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Detect dead sessions
   */
  detectDeadSessions(): SessionState[] {
    const states = this.checkAllSessions();
    return states.filter(s => s.status === 'dead');
  }

  /**
   * Get all alive sessions
   */
  getAliveSessions(): SessionState[] {
    const states = this.checkAllSessions();
    return states.filter(s => s.status === 'alive');
  }

  /**
   * Get session by task ID
   */
  getSession(taskId: string): SessionState | null {
    return this.checkSessionByTaskId(taskId);
  }
}
