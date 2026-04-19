import { z } from 'zod';

// Skill entry in a suite - references a skill by ID and its provider
export const SuiteSkillSchema = z.object({
  id: z.string(),
  provider: z.enum(['claude', 'codex', 'universal']).default('universal'),
});
export type SuiteSkill = z.infer<typeof SuiteSkillSchema>;

// A Skill Suite definition
export const SuiteSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Suite ID must match /^[a-zA-Z0-9_-]+$/'),
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  skills: z.array(SuiteSkillSchema).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Suite = z.infer<typeof SuiteSchema>;

// The suites index file
export const SuitesIndexSchema = z.object({
  version: z.string().default('1.0'),
  suites: z.array(SuiteSchema).default([]),
});
export type SuitesIndex = z.infer<typeof SuitesIndexSchema>;
