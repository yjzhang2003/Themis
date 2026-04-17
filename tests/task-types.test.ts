import { describe, it, expect } from 'vitest';
import {
  TaskSchema,
  TaskStatusSchema,
  TaskSkillSchema,
  TaskHooksSchema,
} from '../src/task/types.js';

describe('TaskStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(TaskStatusSchema.parse('in_progress')).toBe('in_progress');
    expect(TaskStatusSchema.parse('completed')).toBe('completed');
    expect(TaskStatusSchema.parse('paused')).toBe('paused');
  });

  it('rejects invalid status', () => {
    expect(() => TaskStatusSchema.parse('blocked')).toThrow();
    expect(() => TaskStatusSchema.parse('invalid')).toThrow();
  });
});

describe('TaskSkillSchema', () => {
  it('parses valid task skill', () => {
    const skill = TaskSkillSchema.parse({
      skill: 'tdd',
      version: '2.0',
      enabled: true,
    });
    expect(skill.skill).toBe('tdd');
    expect(skill.version).toBe('2.0');
    expect(skill.enabled).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const skill = TaskSkillSchema.parse({ skill: 'tdd' });
    expect(skill.version).toBe('1.0');
    expect(skill.enabled).toBe(true);
  });
});

describe('TaskHooksSchema', () => {
  it('parses valid hook config', () => {
    const hooks = TaskHooksSchema.parse({
      PostToolUse: ['lint-hook'],
      PreToolUse: ['auth-check'],
    });
    expect(hooks.PostToolUse).toEqual(['lint-hook']);
    expect(hooks.PreToolUse).toEqual(['auth-check']);
  });

  it('parses empty hooks', () => {
    const hooks = TaskHooksSchema.parse({});
    expect(hooks).toEqual({});
  });

  it('rejects invalid hook type', () => {
    expect(() => TaskHooksSchema.parse({
      InvalidType: ['hook'],
    })).toThrow();
  });
});

describe('TaskSchema', () => {
  it('parses minimal valid task', () => {
    const task = TaskSchema.parse({
      name: 'Test Task',
      path: '/home/user/project',
      created_at: '2026-04-16T10:00:00Z',
    });
    expect(task.name).toBe('Test Task');
    expect(task.path).toBe('/home/user/project');
    expect(task.created_at).toBe('2026-04-16T10:00:00Z');
    expect(task.status).toBe('paused');
    expect(task.skills).toEqual([]);
    expect(task.hooks).toEqual({});
  });

  it('parses task with all fields', () => {
    const task = TaskSchema.parse({
      name: 'Full Task',
      path: '/home/user/project',
      description: 'A task with everything',
      status: 'in_progress',
      created_at: '2026-04-16T10:00:00Z',
      skills: [{ skill: 'tdd', version: '1.0', enabled: true }],
      hooks: { PostToolUse: ['lint'] },
    });

    expect(task.name).toBe('Full Task');
    expect(task.path).toBe('/home/user/project');
    expect(task.description).toBe('A task with everything');
    expect(task.status).toBe('in_progress');
    expect(task.skills).toHaveLength(1);
    expect(task.hooks).toEqual({ PostToolUse: ['lint'] });
  });

  it('rejects task without required fields', () => {
    expect(() => TaskSchema.parse({ name: 'Test' })).toThrow();
    expect(() => TaskSchema.parse({ path: '/test' })).toThrow();
  });
});
