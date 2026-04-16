import { describe, it, expect } from 'vitest';
import {
  SupervisorConfigSchema,
  SessionStateSchema,
} from '../src/supervisor/types.js';

describe('SupervisorConfigSchema', () => {
  it('parses minimal config with defaults', () => {
    const config = SupervisorConfigSchema.parse({
      version: '1.0',
      workspace_root: '/test',
    });
    expect(config.version).toBe('1.0');
    expect(config.tmux_base_session).toBe('ths-supervisor');
    expect(config.task_session_prefix).toBe('th-task-');
    expect(config.check_interval_ms).toBe(5000);
    expect(config.auto_restart).toBe(false);
    expect(config.max_restart_attempts).toBe(3);
    expect(config.restart_cooldown_ms).toBe(30000);
  });

  it('parses full config', () => {
    const config = SupervisorConfigSchema.parse({
      version: '1.0',
      tmux_base_session: 'my-supervisor',
      task_session_prefix: 'my-task-',
      check_interval_ms: 10000,
      auto_restart: true,
      max_restart_attempts: 5,
      restart_cooldown_ms: 60000,
      log_path: '/var/log/supervisor.log',
      notifications: {
        on_death: true,
        on_restart: true,
      },
    });

    expect(config.tmux_base_session).toBe('my-supervisor');
    expect(config.task_session_prefix).toBe('my-task-');
    expect(config.check_interval_ms).toBe(10000);
    expect(config.auto_restart).toBe(true);
    expect(config.max_restart_attempts).toBe(5);
    expect(config.restart_cooldown_ms).toBe(60000);
    expect(config.log_path).toBe('/var/log/supervisor.log');
    expect(config.notifications.on_death).toBe(true);
    expect(config.notifications.on_restart).toBe(true);
  });

  it('accepts zero check_interval_ms', () => {
    const config = SupervisorConfigSchema.parse({
      check_interval_ms: 0,
    });
    expect(config.check_interval_ms).toBe(0);
  });
});

describe('SessionStateSchema', () => {
  it('parses minimal session state', () => {
    const state = SessionStateSchema.parse({
      task_id: 'task-001',
      tmux_session: 'th-task-001',
      started_at: '2026-04-16T10:00:00Z',
      last_check: '2026-04-16T10:05:00Z',
    });
    expect(state.task_id).toBe('task-001');
    expect(state.tmux_session).toBe('th-task-001');
    expect(state.status).toBe('unknown');
    expect(state.restart_count).toBe(0);
  });

  it('parses full session state', () => {
    const state = SessionStateSchema.parse({
      task_id: 'task-001',
      tmux_session: 'th-task-001',
      window_id: '0',
      pid: 12345,
      started_at: '2026-04-16T10:00:00Z',
      last_check: '2026-04-16T10:05:00Z',
      status: 'alive',
      exit_code: 0,
      restart_count: 2,
    });

    expect(state.task_id).toBe('task-001');
    expect(state.window_id).toBe('0');
    expect(state.pid).toBe(12345);
    expect(state.status).toBe('alive');
    expect(state.exit_code).toBe(0);
    expect(state.restart_count).toBe(2);
  });

  it('rejects invalid status', () => {
    expect(() => SessionStateSchema.parse({
      task_id: 'task-001',
      tmux_session: 'th-task-001',
      started_at: '2026-04-16T10:00:00Z',
      last_check: '2026-04-16T10:05:00Z',
      status: 'invalid',
    })).toThrow();
  });

  it('accepts zero restart_count', () => {
    const state = SessionStateSchema.parse({
      task_id: 'task-001',
      tmux_session: 'th-task-001',
      started_at: '2026-04-16T10:00:00Z',
      last_check: '2026-04-16T10:05:00Z',
      restart_count: 0,
    });
    expect(state.restart_count).toBe(0);
  });
});
