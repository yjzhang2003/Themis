import { execSync, exec } from 'child_process';
import { TmuxSession } from './types.js';

export class TmuxManager {
  /**
   * List all tmux sessions matching a pattern
   */
  listSessions(pattern?: string): TmuxSession[] {
    try {
      const output = execSync(
        'tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created_string}|#{session_attached}"',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      if (!output.trim()) return [];

      return output.trim().split('\n')
        .filter(line => !pattern || line.startsWith(pattern))
        .map(line => {
          const [name, windows, created, attached] = line.split('|');
          return {
            name,
            windows: parseInt(windows, 10),
            created,
            attached: attached === '1',
          };
        })
        .filter(s => s.name); // Filter out empty lines
    } catch {
      // No tmux sessions or tmux not running
      return [];
    }
  }

  /**
   * Create a new session for a task
   */
  createTaskSession(taskId: string, workingDir: string, env: Record<string, string>): TmuxSession {
    const sessionName = `th-task-${taskId}`;

    // Build environment string for tmux
    const envEntries = Object.entries(env)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');

    // Create session with environment
    try {
      execSync(
        `tmux new-session -d -s "${sessionName}" -c "${workingDir}"`,
        { stdio: 'ignore' }
      );

      // Set environment variables in the session
      if (envEntries) {
        execSync(
          `tmux set-environment -t "${sessionName}" ${envEntries}`,
          { stdio: 'ignore' }
        );
      }
    } catch (e) {
      // Session might already exist
      if (this.sessionExists(sessionName)) {
        return this.getSession(sessionName)!;
      }
      throw e;
    }

    return {
      name: sessionName,
      windows: 1,
      created: new Date().toISOString(),
      attached: false,
    };
  }

  /**
   * Get a specific session by name
   */
  getSession(sessionName: string): TmuxSession | null {
    try {
      const output = execSync(
        `tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created_string}|#{session_attached}" -t "${sessionName}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const [name, windows, created, attached] = output.trim().split('|');
      return {
        name,
        windows: parseInt(windows, 10),
        created,
        attached: attached === '1',
      };
    } catch {
      return null;
    }
  }

  /**
   * Send keys to a session
   */
  sendKeys(sessionName: string, keys: string): void {
    // Escape special characters
    const escaped = keys.replace(/'/g, "'\\''");
    execSync(`tmux send-keys -t "${sessionName}" '${escaped}' C-m`, {
      stdio: 'ignore',
    });
  }

  /**
   * Send raw keys without Enter
   */
  sendRawKeys(sessionName: string, keys: string): void {
    const escaped = keys.replace(/'/g, "'\\''");
    execSync(`tmux send-keys -t "${sessionName}" '${escaped}'`, {
      stdio: 'ignore',
    });
  }

  /**
   * Attach to session (for takeover)
   * Note: This will hijack the terminal
   */
  attachSession(sessionName: string): void {
    execSync(`tmux attach-session -t "${sessionName}"`, { stdio: 'inherit' });
  }

  /**
   * Check if session exists
   */
  sessionExists(sessionName: string): boolean {
    try {
      execSync(`tmux has-session -t "${sessionName}"`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Kill a session
   */
  killSession(sessionName: string): void {
    try {
      execSync(`tmux kill-session -t "${sessionName}"`, { stdio: 'ignore' });
    } catch {
      // Ignore errors
    }
  }

  /**
   * Capture session pane contents (for logs)
   */
  capturePane(sessionName: string, pane: string = '0'): string {
    try {
      return execSync(`tmux capture-pane -t "${sessionName}:${pane}" -p`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      return '';
    }
  }

  /**
   * Get list of panes in a session
   */
  listPanes(sessionName: string): string[] {
    try {
      const output = execSync(
        `tmux list-panes -t "${sessionName}" -F "#{pane_index}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return output.trim().split('\n').filter(p => p);
    } catch {
      return [];
    }
  }

  /**
   * Detach all clients from a session
   */
  detachSession(sessionName: string): void {
    try {
      execSync(`tmux detach-session -t "${sessionName}"`, { stdio: 'ignore' });
    } catch {
      // Ignore
    }
  }

  /**
   * Get session PID (if available)
   */
  getSessionPid(sessionName: string): number | null {
    try {
      const output = execSync(
        `tmux display-message -p -t "${sessionName}" "#{session_pid}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return parseInt(output.trim(), 10) || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if tmux is installed and running
   */
  isTmuxAvailable(): boolean {
    try {
      execSync('tmux -V', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
