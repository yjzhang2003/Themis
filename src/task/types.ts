import { z } from 'zod';

export const TaskStatusSchema = z.enum(['in_progress', 'completed', 'blocked', 'paused']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const OpenSpecBindingSchema = z.object({
  change: z.string(),
  capability: z.string().optional(),
  path: z.string().optional(),
});
export type OpenSpecBinding = z.infer<typeof OpenSpecBindingSchema>;

export const TaskSkillSchema = z.object({
  skill: z.string(),
  version: z.string().default('1.0'),
  enabled: z.boolean().default(true),
});
export type TaskSkill = z.infer<typeof TaskSkillSchema>;

// Hook key must be valid hook type, value is array of hook IDs
export const TaskHooksSchema = z.record(
  z.enum(['PreToolUse', 'PostToolUse', 'Stop', 'SessionStart', 'SessionEnd', 'PreCompact']),
  z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid hook ID format'))
);
export type TaskHooks = z.infer<typeof TaskHooksSchema>;

// Phase 5: Attached resource schema
export const AttachedResourceSchema = z.object({
  type: z.enum(['skill', 'hook', 'rule']),
  id: z.string(),
  source: z.enum(['global', 'local']),
  path: z.string(),
});
export type AttachedResource = z.infer<typeof AttachedResourceSchema>;

// Phase 5: Isolation configuration
export const IsolationConfigSchema = z.object({
  env_vars: z.record(z.string()).optional(),
  library_path: z.string().optional(),
  workspace_restrict: z.boolean().default(true),
});
export type IsolationConfig = z.infer<typeof IsolationConfigSchema>;

// Phase 5: Task session state
export const TaskSessionSchema = z.object({
  tmux_session: z.string(),
  pid: z.number().optional(),
  started_at: z.string(),
  last_heartbeat: z.string(),
  status: z.enum(['running', 'dead', 'unknown']).default('unknown'),
});
export type TaskSession = z.infer<typeof TaskSessionSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema.default('paused'),
  openspec: OpenSpecBindingSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
  assignee: z.string().default('claude-code'),
  skills: z.array(TaskSkillSchema).default([]),
  hooks: TaskHooksSchema.default({}),
  rules: z.array(z.string()).default([]),
  directory: z.string().optional(),
  // Phase 5: New fields
  session_name: z.string().optional(),
  attached_resources: z.array(AttachedResourceSchema).default([]),
  isolation_config: IsolationConfigSchema.optional(),
  session: TaskSessionSchema.optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const WorkspaceConfigSchema = z.object({
  version: z.string().default('1.0'),
  workspace_root: z.string(),
  library_path: z.string().default('./library'),
  tasks_path: z.string().default('./tasks'),
  open_spec_path: z.string().optional(),
  active_task: z.string().optional(),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
