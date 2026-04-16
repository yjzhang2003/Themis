import { z } from 'zod';

// Supervisor configuration schema
export const SupervisorConfigSchema = z.object({
  version: z.string().default('1.0'),
  tmux_base_session: z.string().default('ths-supervisor'),
  task_session_prefix: z.string().default('th-task-'),
  check_interval_ms: z.number().default(5000),
  auto_restart: z.boolean().default(false),
  max_restart_attempts: z.number().default(3),
  restart_cooldown_ms: z.number().default(30000),
  log_path: z.string().default('~/.claude/harness/supervisor.log'),
  notifications: z.object({
    on_death: z.boolean().default(true),
    on_restart: z.boolean().default(false),
  }).default({}),
});
export type SupervisorConfig = z.infer<typeof SupervisorConfigSchema>;

// Session state schema
export const SessionStateSchema = z.object({
  task_id: z.string(),
  tmux_session: z.string(),
  window_id: z.string().optional(),
  pid: z.number().optional(),
  started_at: z.string(),
  last_check: z.string(),
  status: z.enum(['alive', 'dead', 'unknown']).default('unknown'),
  exit_code: z.number().optional(),
  restart_count: z.number().default(0),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

// tmux session info
export interface TmuxSession {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
}

// Task launch configuration
export interface LaunchConfig {
  taskId: string;
  taskDir: string;
  skills: string[];
  hooks: string[];
  rules: string[];
  globalLibraryPath: string;
  localLibraryPath?: string;
  env?: Record<string, string>;
}
