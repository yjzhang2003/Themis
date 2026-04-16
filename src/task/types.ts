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

export const TaskHooksSchema = z.record(z.string(), z.array(z.string()));
export type TaskHooks = z.infer<typeof TaskHooksSchema>;

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
