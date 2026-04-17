import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { TmuxManager } from '../../supervisor/tmux.js';
import { SessionMonitor } from '../../supervisor/monitor.js';
import { SupervisorConfigManager } from '../../supervisor/config.js';
import { TaskLauncher } from '../../supervisor/launcher.js';

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

      setOutput(`Supervisor Status:
  tmux: Running
  Sessions: ${states.length} total (${alive} alive, ${dead} dead)
  Config: ${join(homedir(), '.claude', 'harness', 'supervisor.yaml')}

Commands:
  th supervisor start    Start supervisor (runs in background)
  th supervisor status   Show session status
  th supervisor logs     Show supervisor logs
  th supervisor stop     Stop supervisor`);
      return;
    }

    switch (subcommand) {
      case 'status': {
        const states = monitor.checkAllSessions();
        if (states.length === 0) {
          setOutput('No task sessions running');
          return;
        }
        let status = 'Task Sessions:\n';
        for (const s of states) {
          const indicator = s.status === 'alive' ? '[RUNNING]' : '[DEAD]';
          status += `\n  ${indicator} ${s.task_id} (${s.tmux_session})`;
          if (s.pid) {
            status += ` PID:${s.pid}`;
          }
        }
        setOutput(status);
        return;
      }

      case 'logs': {
        const logPath = config.getLogPath();
        if (existsSync(logPath)) {
          const tail = cmdArgs[2] === '--tail' ? parseInt(cmdArgs[3] as string, 10) || 50 : 50;
          // Use tail command to avoid loading entire file
          try {
            const { execSync: execSyncLocal } = require('child_process');
            const content = execSyncLocal(`tail -n ${tail} "${logPath}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
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
        // Start supervisor in background
        const supervisorSession = 'ths-supervisor';
        if (tmux.sessionExists(supervisorSession)) {
          setOutput(`Supervisor already running in tmux session: ${supervisorSession}`);
          return;
        }
        // Note: In a real implementation, we'd start the supervisor loop here
        setOutput(`Supervisor started in tmux session: ${supervisorSession}\nNote: Full supervisor loop not yet implemented`);
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
