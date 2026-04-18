import { execSync, exec } from 'child_process';
import { TmuxSession } from './types.js';

// Validate identifiers to prevent shell injection
const SAFE_SESSION_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
// Allow paths with spaces - just reject shell metacharacters
const UNSAFE_PATH_REGEX = /[;|`$(){}[\]<>\\]/;

function validateSessionName(name: string): string {
  if (!SAFE_SESSION_NAME_REGEX.test(name)) {
    throw new Error(`Invalid session name: ${name}. Only alphanumeric, underscore, hyphen allowed.`);
  }
  return name;
}

function validatePath(path: string): string {
  if (UNSAFE_PATH_REGEX.test(path)) {
    throw new Error(`Invalid path: ${path}`);
  }
  return path;
}

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
    const sessionName = `th-task-${validateSessionName(taskId)}`;
    const safeWorkingDir = validatePath(workingDir);

    // Build environment string for tmux - validate env var names
    const envEntries = Object.entries(env)
      .filter(([k]) => SAFE_SESSION_NAME_REGEX.test(k))
      .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
      .join(' ');

    // Create session with environment
    try {
      execSync(
        `tmux new-session -d -s "${sessionName}" -c "${safeWorkingDir}"`,
        { stdio: 'ignore' }
      );

      // Set environment variables in the session
      if (envEntries) {
        try {
          execSync(
            `tmux set-environment -t "${sessionName}" ${envEntries}`,
            { stdio: 'ignore' }
          );
        } catch {
          // Env setup failed silently - session still works
        }
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
    const safeSession = validateSessionName(sessionName);
    try {
      const output = execSync(
        `tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created_string}|#{session_attached}" -t "${safeSession}"`,
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
    const safeSession = validateSessionName(sessionName);
    // Escape special characters for bash
    const escaped = keys.replace(/'/g, "'\\''").replace(/\$/g, '\\$').replace(/`/g, '\\`');
    execSync(`tmux send-keys -t "${safeSession}" '${escaped}' C-m`, {
      stdio: 'ignore',
    });
  }

  /**
   * Send raw keys without Enter
   */
  sendRawKeys(sessionName: string, keys: string): void {
    const safeSession = validateSessionName(sessionName);
    const escaped = keys.replace(/'/g, "'\\''").replace(/\$/g, '\\$').replace(/`/g, '\\`');
    execSync(`tmux send-keys -t "${safeSession}" '${escaped}'`, {
      stdio: 'ignore',
    });
  }

  /**
   * Attach to session (for takeover)
   * Note: This will hijack the terminal
   */
  attachSession(sessionName: string): void {
    const safeSession = validateSessionName(sessionName);
    execSync(`tmux attach-session -t "${safeSession}"`, { stdio: 'inherit' });
  }

  /**
   * Check if session exists
   */
  sessionExists(sessionName: string): boolean {
    const safeSession = validateSessionName(sessionName);
    try {
      execSync(`tmux has-session -t "${safeSession}"`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Kill a session
   */
  killSession(sessionName: string): boolean {
    const safeSession = validateSessionName(sessionName);
    try {
      execSync(`tmux kill-session -t "${safeSession}"`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Capture session pane contents (for logs)
   */
  capturePane(sessionName: string, pane: string = '0'): string {
    const safeSession = validateSessionName(sessionName);
    const safePane = pane.replace(/[^0-9]/g, '');
    try {
      return execSync(`tmux capture-pane -t "${safeSession}:${safePane}" -p`, {
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
    const safeSession = validateSessionName(sessionName);
    try {
      const output = execSync(
        `tmux list-panes -t "${safeSession}" -F "#{pane_index}"`,
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
  detachSession(sessionName: string): boolean {
    const safeSession = validateSessionName(sessionName);
    try {
      execSync(`tmux detach-session -t "${safeSession}"`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get session PID (if available)
   */
  getSessionPid(sessionName: string): number | null {
    const safeSession = validateSessionName(sessionName);
    try {
      const output = execSync(
        `tmux display-message -p -t "${safeSession}" "#{session_pid}"`,
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
