import { z } from 'zod';

export const TaskStatusSchema = z.enum(['in_progress', 'completed', 'paused']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

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

// Simple task entry - stored in tasks.json
export const TaskSchema = z.object({
  name: z.string(),
  path: z.string(),           // Absolute path to task directory
  created_at: z.string(),
  status: TaskStatusSchema.default('paused'),
  description: z.string().optional(),
  skills: z.array(TaskSkillSchema).default([]),
  hooks: TaskHooksSchema.default({}),
});
export type Task = z.infer<typeof TaskSchema>;

// Tasks index file
export const TasksIndexSchema = z.object({
  version: z.string().default('1.0'),
  tasks: z.array(TaskSchema).default([]),
});
export type TasksIndex = z.infer<typeof TasksIndexSchema>;
