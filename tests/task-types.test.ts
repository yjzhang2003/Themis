import { describe, it, expect } from 'vitest';
import {
  TaskSchema,
  TaskStatusSchema,
  OpenSpecBindingSchema,
  TaskSkillSchema,
  AttachedResourceSchema,
  IsolationConfigSchema,
  TaskSessionSchema,
} from '../src/task/types.js';

describe('TaskStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(TaskStatusSchema.parse('in_progress')).toBe('in_progress');
    expect(TaskStatusSchema.parse('completed')).toBe('completed');
    expect(TaskStatusSchema.parse('blocked')).toBe('blocked');
    expect(TaskStatusSchema.parse('paused')).toBe('paused');
  });

  it('rejects invalid status', () => {
    expect(() => TaskStatusSchema.parse('invalid')).toThrow();
  });
});

describe('OpenSpecBindingSchema', () => {
  it('parses valid binding with all fields', () => {
    const binding = OpenSpecBindingSchema.parse({
      change: 'add-auth',
      capability: 'auth-system',
      path: '/path/to/project',
    });
    expect(binding.change).toBe('add-auth');
    expect(binding.capability).toBe('auth-system');
    expect(binding.path).toBe('/path/to/project');
  });

  it('parses binding with only required fields', () => {
    const binding = OpenSpecBindingSchema.parse({ change: 'add-auth' });
    expect(binding.change).toBe('add-auth');
    expect(binding.capability).toBeUndefined();
    expect(binding.path).toBeUndefined();
  });

  it('rejects binding without change', () => {
    expect(() => OpenSpecBindingSchema.parse({})).toThrow();
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

describe('AttachedResourceSchema', () => {
  it('parses valid attached resource', () => {
    const resource = AttachedResourceSchema.parse({
      type: 'skill',
      id: 'tdd',
      source: 'global',
      path: '/home/user/.claude/library/skills/tdd',
    });
    expect(resource.type).toBe('skill');
    expect(resource.id).toBe('tdd');
    expect(resource.source).toBe('global');
    expect(resource.path).toBe('/home/user/.claude/library/skills/tdd');
  });

  it('rejects invalid resource type', () => {
    expect(() => AttachedResourceSchema.parse({
      type: 'invalid',
      id: 'tdd',
      source: 'global',
      path: '/path',
    })).toThrow();
  });

  it('rejects invalid source', () => {
    expect(() => AttachedResourceSchema.parse({
      type: 'skill',
      id: 'tdd',
      source: 'remote',
      path: '/path',
    })).toThrow();
  });
});

describe('IsolationConfigSchema', () => {
  it('parses valid isolation config', () => {
    const config = IsolationConfigSchema.parse({
      env_vars: { CLAUDE_SKILLS_PATH: '/path' },
      workspace_restrict: true,
    });
    expect(config.env_vars?.CLAUDE_SKILLS_PATH).toBe('/path');
    expect(config.workspace_restrict).toBe(true);
  });

  it('applies defaults', () => {
    const config = IsolationConfigSchema.parse({});
    expect(config.workspace_restrict).toBe(true);
    expect(config.env_vars).toBeUndefined();
  });
});

describe('TaskSessionSchema', () => {
  it('parses valid session', () => {
    const session = TaskSessionSchema.parse({
      tmux_session: 'th-task-001',
      pid: 12345,
      started_at: '2026-04-16T10:00:00Z',
      last_heartbeat: '2026-04-16T10:05:00Z',
      status: 'running',
    });
    expect(session.tmux_session).toBe('th-task-001');
    expect(session.pid).toBe(12345);
    expect(session.status).toBe('running');
  });

  it('applies defaults for status', () => {
    const session = TaskSessionSchema.parse({
      tmux_session: 'th-task-001',
      started_at: '2026-04-16T10:00:00Z',
      last_heartbeat: '2026-04-16T10:05:00Z',
    });
    expect(session.status).toBe('unknown');
  });
});

describe('TaskSchema', () => {
  it('parses minimal valid task', () => {
    const task = TaskSchema.parse({
      id: 'task-001',
      name: 'Test Task',
      created_at: '2026-04-16T10:00:00Z',
      updated_at: '2026-04-16T10:00:00Z',
    });
    expect(task.id).toBe('task-001');
    expect(task.name).toBe('Test Task');
    expect(task.status).toBe('paused');
    expect(task.skills).toEqual([]);
    expect(task.hooks).toEqual({});
    expect(task.rules).toEqual([]);
    expect(task.attached_resources).toEqual([]);
  });

  it('parses task with all fields', () => {
    const task = TaskSchema.parse({
      id: 'task-001',
      name: 'Full Task',
      description: 'A task with everything',
      status: 'in_progress',
      openspec: { change: 'add-auth', capability: 'auth' },
      created_at: '2026-04-16T10:00:00Z',
      updated_at: '2026-04-16T12:00:00Z',
      assignee: 'claude-code',
      skills: [{ skill: 'tdd', version: '1.0', enabled: true }],
      hooks: { PostToolUse: ['lint'] },
      rules: ['coding-standards'],
      directory: './tasks/task-001',
      session_name: 'th-task-001',
      attached_resources: [
        { type: 'skill', id: 'tdd', source: 'global', path: '/path/to/tdd' },
      ],
      isolation_config: { workspace_restrict: true },
      session: {
        tmux_session: 'th-task-001',
        pid: 12345,
        started_at: '2026-04-16T10:00:00Z',
        last_heartbeat: '2026-04-16T10:05:00Z',
        status: 'running',
      },
    });

    expect(task.id).toBe('task-001');
    expect(task.name).toBe('Full Task');
    expect(task.description).toBe('A task with everything');
    expect(task.status).toBe('in_progress');
    expect(task.openspec?.change).toBe('add-auth');
    expect(task.skills).toHaveLength(1);
    expect(task.hooks).toEqual({ PostToolUse: ['lint'] });
    expect(task.rules).toEqual(['coding-standards']);
    expect(task.session_name).toBe('th-task-001');
    expect(task.attached_resources).toHaveLength(1);
    expect(task.isolation_config?.workspace_restrict).toBe(true);
    expect(task.session?.status).toBe('running');
  });

  it('rejects task without required fields', () => {
    expect(() => TaskSchema.parse({ name: 'Test' })).toThrow();
    expect(() => TaskSchema.parse({ id: 'task-001' })).toThrow();
  });
});
