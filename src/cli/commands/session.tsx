import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { execSync, exec } from 'child_process';
import { TmuxManager } from '../../supervisor/tmux.js';
import { SessionMonitor } from '../../supervisor/monitor.js';
import { SupervisorConfigManager } from '../../supervisor/config.js';
import { TaskLauncher } from '../../supervisor/launcher.js';
import { SupervisorLoop, SupervisorLoopConfig } from '../../supervisor/supervisor-loop.js';
import { TaskStatusMonitor } from '../../supervisor/status-monitor.js';
import { TaskStore } from '../../task/store.js';

interface SupervisorCommandProps {
  args: Record<string, unknown>;
}

export function SupervisorCommand({ args }: SupervisorCommandProps) {
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cmdArgs = args._ as string[] || [];
  const subcommand = cmdArgs[1] as string | undefined;

  useEffect(() => {
    const tmux = new TmuxManager();
    const config = new SupervisorConfigManager();
    const monitor = new SessionMonitor(config.getSessionsDir(), config.getTaskSessionPrefix());

    // Check if tmux is available
    if (!tmux.isTmuxAvailable()) {
      setError('tmux is not installed or not running');
      return;
    }

    if (!subcommand) {
      const states = monitor.checkAllSessions();
      const alive = states.filter(s => s.status === 'alive').length;
      const dead = states.filter(s => s.status === 'dead').length;
      const supervisorRunning = tmux.sessionExists('ths-supervisor');

      setOutput(`Supervisor Status:
  tmux: ${supervisorRunning ? 'RUNNING' : 'STOPPED'}
  Sessions: ${states.length} total (${alive} alive, ${dead} dead)
  Config: ${join(homedir(), '.claude', 'themis', 'supervisor.yaml')}

Commands:
  th supervisor start      Start supervisor (runs in tmux)
  th supervisor status     Show task session status
  th supervisor reviews     Show tasks pending review
  th supervisor review <id> [approve|reject]  Review a task
  th supervisor logs       Show supervisor logs
  th supervisor stop       Stop supervisor`);
      return;
    }

    switch (subcommand) {
      case 'status': {
        const states = monitor.checkAllSessions();
        const supervisorRunning = tmux.sessionExists('ths-supervisor');

        if (states.length === 0) {
          setOutput(`Supervisor: ${supervisorRunning ? 'RUNNING' : 'STOPPED'}\nNo task sessions`);
          return;
        }

        let status = `Supervisor: ${supervisorRunning ? 'RUNNING' : 'STOPPED'}\nTask Sessions:\n`;
        for (const s of states) {
          const indicator = s.status === 'alive' ? '[RUNNING]' : '[DEAD]';
          status += `  ${indicator} ${s.task_id}`;
          if (s.pid) {
            status += ` (PID:${s.pid})`;
          }
          status += '\n';
        }
        setOutput(status);
        return;
      }

      case 'reviews': {
        // Check for tasks needing review
        const store = new TaskStore();
        const tasks = store.listTasks();
        const statusMonitor = new TaskStatusMonitor();
        const reviews: string[] = [];

        for (const task of tasks) {
          const status = statusMonitor.readStatus(task.path);
          if (status && status.needs_review) {
            reviews.push(`  ${task.name}: ${status.review_reason || 'needs_review'} (progress: ${status.progress_percent}%)`);
          }
        }

        if (reviews.length === 0) {
          setOutput('No tasks pending review');
        } else {
          setOutput(`Tasks Pending Review:\n${reviews.join('\n')}\n\nUse 'th session list' for full status`);
        }
        return;
      }

      case 'logs': {
        const logPath = config.getLogPath();
        if (existsSync(logPath)) {
          const tail = cmdArgs[2] === '--tail' ? parseInt(cmdArgs[3] as string, 10) || 50 : 50;
          // Use tail command to avoid loading entire file
          try {
            const content = execSync(`tail -n ${tail} "${logPath}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
            setOutput(`Supervisor Logs (last ${tail} lines):\n\n${content}`);
          } catch {
            setOutput('Failed to read logs (file may be too large)');
          }
        } else {
          setOutput('No supervisor logs found');
        }
        return;
      }

      case 'start': {
        // Start supervisor in background using tmux
        const supervisorSession = 'ths-supervisor';
        if (tmux.sessionExists(supervisorSession)) {
          setOutput(`Supervisor already running in tmux session: ${supervisorSession}`);
          return;
        }

        // Get task store to register all tasks
        const store = new TaskStore();
        const tasks = store.listTasks();

        // Register all tasks with their directories
        const taskDirs: Array<{ id: string; path: string }> = [];
        for (const task of tasks) {
          taskDirs.push({ id: task.name, path: task.path });
        }

        // Create a script that starts the supervisor loop and registers tasks
        const hookScriptPath = join(homedir(), '.claude', 'themis', 'supervisor-start.sh');
        const hookScript = `#!/bin/bash
# Supervisor startup script
export NODE_PATH="$(npm root -g 2>/dev/null || npm root):$NODE_PATH"
node --input-type=module << 'EOF'
import { SupervisorLoop } from '${join(process.cwd(), 'dist', 'supervisor', 'supervisor-loop.js').replace(/'/g, "'\\''")}';
import { TaskStore } from '${join(process.cwd(), 'dist', 'task', 'store.js').replace(/'/g, "'\\''")}';

const loop = new SupervisorLoop({
  checkIntervalMs: 5000,
  stuckThresholdMs: 300000,
  maxRestartAttempts: 3,
  restartCooldownMs: 60000,
  autoRestart: true,
  supervisorSessionName: 'ths-supervisor',
});

// Register all existing tasks
const store = new TaskStore();
const tasks = store.listTasks();
for (const task of tasks) {
  loop.registerTask(task.name, task.path);
}

console.log('[Supervisor] Starting loop with', tasks.length, 'tasks');
loop.start();

// Keep running
setInterval(() => {}, 1000000);
EOF
`;

        mkdirSync(join(homedir(), '.claude', 'themis'), { recursive: true });
        require('fs').writeFileSync(hookScriptPath, hookScript);
        require('fs').chmodSync(hookScriptPath, 0o755);

        try {
          // Start in detached tmux session
          execSync(`tmux new-session -d -s "${supervisorSession}" -c "${homedir()}" "${hookScriptPath}"`, {
            stdio: 'ignore',
          });
          setOutput(`Supervisor started in tmux session: ${supervisorSession}\nRegistered ${tasks.length} tasks for monitoring\n\nUse 'th supervisor status' to view progress`);
        } catch (e) {
          setOutput(`Failed to start supervisor: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
        return;
      }

      case 'review': {
        const taskId = cmdArgs[2] as string;
        const action = cmdArgs[3] as string; // 'approve' or 'reject'

        if (!taskId) {
          setOutput('Usage: th supervisor review <task-id> [approve|reject]');
          return;
        }

        const store = new TaskStore();
        const task = store.getTask(taskId);
        if (!task) {
          setOutput(`Task not found: ${taskId}`);
          return;
        }

        const statusMonitor = new TaskStatusMonitor();
        const status = statusMonitor.readStatus(task.path);

        if (!status || !status.needs_review) {
          setOutput(`Task ${taskId} does not need review`);
          return;
        }

        if (!action) {
          // Show review info
          let info = `Review for task: ${taskId}\n`;
          info += `  Phase: ${status.phase}\n`;
          info += `  Progress: ${status.progress_percent}%\n`;
          info += `  Reason: ${status.review_reason || 'unknown'}\n`;
          info += `  Errors: ${status.errors.length}\n`;
          if (status.errors.length > 0) {
            info += `  Last error: ${status.errors[status.errors.length - 1]}\n`;
          }
          info += `\nCommands:\n`;
          info += `  th supervisor review ${taskId} approve  - Continue task\n`;
          info += `  th supervisor review ${taskId} reject   - Stop task`;
          setOutput(info);
          return;
        }

        if (action === 'approve') {
          statusMonitor.clearNeedsReview(task.path);
          setOutput(`Task ${taskId} approved, continuing`);
        } else if (action === 'reject') {
          const launcher = new TaskLauncher();
          launcher.stop(taskId);
          setOutput(`Task ${taskId} rejected and stopped`);
        } else {
          setOutput(`Unknown action: ${action}`);
        }
        return;
      }

      case 'stop': {
        const supervisorSession = 'ths-supervisor';
        if (tmux.sessionExists(supervisorSession)) {
          tmux.killSession(supervisorSession);
          setOutput('Supervisor stopped');
        } else {
          setOutput('Supervisor not running');
        }
        return;
      }

      default:
        setOutput(`Unknown supervisor command: ${subcommand}`);
    }
  }, [args, subcommand]);

  if (error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text white>{output}</Text>
    </Box>
  );
}

// Session management commands
export function SessionCommand({ args }: SupervisorCommandProps) {
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cmdArgs = args._ as string[] || [];
  const subcommand = cmdArgs[1] as string | undefined;

  useEffect(() => {
    const tmux = new TmuxManager();
    const config = new SupervisorConfigManager();
    const monitor = new SessionMonitor(config.getSessionsDir(), config.getTaskSessionPrefix());

    // Check if tmux is available
    if (!tmux.isTmuxAvailable()) {
      setError('tmux is not installed or not running');
      return;
    }

    if (!subcommand) {
      const states = monitor.checkAllSessions();
      let status = `Sessions (${states.length}):\n`;
      for (const s of states) {
        const indicator = s.status === 'alive' ? '[RUNNING]' : '[DEAD]';
        status += `\n  ${indicator} ${s.task_id} - ${s.tmux_session}`;
      }
      setOutput(status + '\n\nCommands:\n  th session list        List all sessions\n  th session attach <id>  Attach to session\n  th session kill <id>    Kill session\n  th session logs <id>     Show session logs');
      return;
    }

    switch (subcommand) {
      case 'list': {
        const states = monitor.checkAllSessions();
        if (states.length === 0) {
          setOutput('No task sessions');
          return;
        }
        let status = '';
        for (const s of states) {
          const indicator = s.status === 'alive' ? 'RUNNING' : 'DEAD';
          status += `${indicator.padEnd(8)} ${s.task_id.padEnd(20)} ${s.tmux_session}\n`;
        }
        setOutput(`STATUS     TASK_ID             SESSION\n${status}`);
        return;
      }

      case 'attach': {
        const taskId = cmdArgs[2] as string;
        if (!taskId) {
          setError('Usage: th session attach <task-id>');
          return;
        }
        const sessionName = `th-task-${taskId}`;
        if (!tmux.sessionExists(sessionName)) {
          setError(`Session not found: ${sessionName}`);
          return;
        }
        // This will hijack the terminal - we need to exec
        setOutput(`Attaching to session: ${sessionName}\nUse Ctrl+B, D to detach`);
        // Note: In command mode, we can't actually hijack
        // The user should use the interactive mode for takeover
        return;
      }

      case 'kill': {
        const taskId = cmdArgs[2] as string;
        if (!taskId) {
          setError('Usage: th session kill <task-id>');
          return;
        }
        const sessionName = `th-task-${taskId}`;
        if (!tmux.sessionExists(sessionName)) {
          setOutput(`Session not found: ${sessionName}`);
          return;
        }
        tmux.killSession(sessionName);
        setOutput(`Killed session: ${sessionName}`);
        return;
      }

      case 'logs': {
        const taskId = cmdArgs[2] as string;
        if (!taskId) {
          setError('Usage: th session logs <task-id>');
          return;
        }
        const sessionName = `th-task-${taskId}`;
        const logs = tmux.capturePane(sessionName);
        if (!logs) {
          setOutput(`No logs for session: ${sessionName}`);
          return;
        }
        setOutput(`Logs for ${sessionName}:\n\n${logs}`);
        return;
      }

      default:
        setOutput(`Unknown session command: ${subcommand}`);
    }
  }, [args, subcommand]);

  if (error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text white>{output}</Text>
    </Box>
  );
}
