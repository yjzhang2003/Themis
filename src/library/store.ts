import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

export interface Skill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  commands: string[];
  configuration: Record<string, string>;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Hook {
  id: string;
  name: string;
  type: 'PreToolUse' | 'PostToolUse' | 'Stop';
  matcher: string;
  command: string;
  description: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  content: string;
  language?: string;
}

export interface HookConfig {
  hooks: {
    PreToolUse?: Array<{
      matcher: string;
      command: string;
      description: string;
    }>;
    PostToolUse?: Array<{
      matcher: string;
      command: string;
      description: string;
    }>;
    Stop?: Array<{
      command: string;
      description: string;
    }>;
  };
}

export class LibraryStore {
  private workspaceRoot: string;
  private libraryPath: string;
  private skillsPath: string;
  private hooksPath: string;
  private rulesPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.libraryPath = join(workspaceRoot, 'library');
    this.skillsPath = join(this.libraryPath, 'skills');
    this.hooksPath = join(this.libraryPath, 'hooks');
    this.rulesPath = join(this.libraryPath, 'rules');
  }

  private getSkillFilePath(skillId: string): string {
    return join(this.skillsPath, `${skillId}.yaml`);
  }

  private getHookFilePath(hookId: string): string {
    return join(this.hooksPath, `${hookId}.yaml`);
  }

  private getRuleFilePath(ruleId: string): string {
    return join(this.rulesPath, `${ruleId}.yaml`);
  }

  ensureDirectories(): void {
    mkdirSync(this.skillsPath, { recursive: true });
    mkdirSync(this.hooksPath, { recursive: true });
    mkdirSync(this.rulesPath, { recursive: true });
  }

  // Skills
  listSkills(): Skill[] {
    if (!existsSync(this.skillsPath)) return [];
    const entries = readdirSync(this.skillsPath);
    const skills: Skill[] = [];

    for (const entry of entries) {
      const entryPath = join(this.skillsPath, entry);
      const stat = statSync(entryPath);

      if (stat.isFile() && entry.endsWith('.yaml')) {
        // Legacy .yaml format
        const skill = this.getSkill(entry.replace('.yaml', ''));
        if (skill) skills.push(skill);
      } else if (stat.isDirectory()) {
        // Directory format with SKILL.md
        const skillMdPath = join(entryPath, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          const skill = this.getSkillFromDir(entry);
          if (skill) skills.push(skill);
        }
      }
    }

    return skills;
  }

  getSkillFromDir(skillId: string): Skill | null {
    const skillMdPath = join(this.skillsPath, skillId, 'SKILL.md');
    if (!existsSync(skillMdPath)) return null;
    try {
      const content = readFileSync(skillMdPath, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return null;
      const data = YAML.parse(frontmatterMatch[1]) as Record<string, unknown>;
      return {
        id: skillId,
        name: (data.name as string) || skillId,
        description: (data.description as string) || '',
        triggers: Array.isArray(data.trigger) ? data.trigger : data.trigger ? [data.trigger] : [],
        commands: Array.isArray(data.commands) ? data.commands : [],
        configuration: (data.configuration as Record<string, string>) || {},
        content: content,
        created_at: (data.created_at as string) || new Date().toISOString(),
        updated_at: (data.updated_at as string) || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  getSkill(skillId: string): Skill | null {
    const path = this.getSkillFilePath(skillId);
    if (!existsSync(path)) return null;
    try {
      const content = readFileSync(path, 'utf-8');
      return YAML.parse(content) as Skill;
    } catch {
      return null;
    }
  }

  createSkill(data: {
    name: string;
    description?: string;
    triggers?: string[];
    commands?: string[];
    configuration?: Record<string, string>;
    content?: string;
  }): Skill {
    const id = this.generateId(data.name);
    const now = new Date().toISOString();
    const skill: Skill = {
      id,
      name: data.name,
      description: data.description || '',
      triggers: data.triggers || [],
      commands: data.commands || [],
      configuration: data.configuration || {},
      content: data.content || this.defaultSkillContent(data.name),
      created_at: now,
      updated_at: now,
    };
    const path = this.getSkillFilePath(id);
    mkdirSync(this.skillsPath, { recursive: true });
    writeFileSync(path, YAML.stringify(skill), 'utf-8');
    return skill;
  }

  updateSkill(skillId: string, updates: Partial<Skill>): Skill | null {
    const skill = this.getSkill(skillId);
    if (!skill) return null;
    const updated: Skill = {
      ...skill,
      ...updates,
      id: skill.id,
      updated_at: new Date().toISOString(),
    };
    writeFileSync(this.getSkillFilePath(skillId), YAML.stringify(updated), 'utf-8');
    return updated;
  }

  deleteSkill(skillId: string): boolean {
    const path = this.getSkillFilePath(skillId);
    if (!existsSync(path)) return false;
    rmSync(path, { recursive: true, force: true });
    return true;
  }

  // Hooks
  listHooks(): Hook[] {
    if (!existsSync(this.hooksPath)) return [];
    const files = readdirSync(this.hooksPath).filter((f) => f.endsWith('.yaml'));
    return files
      .map((f) => this.getHook(f.replace('.yaml', '')))
      .filter((h): h is Hook => h !== null);
  }

  getHook(hookId: string): Hook | null {
    const path = this.getHookFilePath(hookId);
    if (!existsSync(path)) return null;
    try {
      const content = readFileSync(path, 'utf-8');
      return YAML.parse(content) as Hook;
    } catch {
      return null;
    }
  }

  createHook(data: {
    name: string;
    type: 'PreToolUse' | 'PostToolUse' | 'Stop';
    matcher?: string;
    command: string;
    description?: string;
  }): Hook {
    const id = this.generateId(data.name);
    const hook: Hook = {
      id,
      name: data.name,
      type: data.type,
      matcher: data.matcher || '.*',
      command: data.command,
      description: data.description || '',
    };
    const path = this.getHookFilePath(id);
    mkdirSync(this.hooksPath, { recursive: true });
    writeFileSync(path, YAML.stringify(hook), 'utf-8');
    return hook;
  }

  deleteHook(hookId: string): boolean {
    const path = this.getHookFilePath(hookId);
    if (!existsSync(path)) return false;
    rmSync(path, { recursive: true, force: true });
    return true;
  }

  // Rules
  listRules(): Rule[] {
    if (!existsSync(this.rulesPath)) return [];
    const files = readdirSync(this.rulesPath).filter((f) => f.endsWith('.yaml'));
    return files
      .map((f) => this.getRule(f.replace('.yaml', '')))
      .filter((r): r is Rule => r !== null);
  }

  getRule(ruleId: string): Rule | null {
    const path = this.getRuleFilePath(ruleId);
    if (!existsSync(path)) return null;
    try {
      const content = readFileSync(path, 'utf-8');
      return YAML.parse(content) as Rule;
    } catch {
      return null;
    }
  }

  createRule(data: {
    name: string;
    description?: string;
    content: string;
    language?: string;
  }): Rule {
    const id = this.generateId(data.name);
    const rule: Rule = {
      id,
      name: data.name,
      description: data.description || '',
      content: data.content,
      language: data.language,
    };
    const path = this.getRuleFilePath(id);
    mkdirSync(this.rulesPath, { recursive: true });
    writeFileSync(path, YAML.stringify(rule), 'utf-8');
    return rule;
  }

  deleteRule(ruleId: string): boolean {
    const path = this.getRuleFilePath(ruleId);
    if (!existsSync(path)) return false;
    rmSync(path, { recursive: true, force: true });
    return true;
  }

  // Generate Claude settings.json for a task with skills and hooks
  generateTaskSettings(taskId: string, skills: Skill[], hooks: Hook[]): HookConfig {
    const config: HookConfig = { hooks: {} };

    for (const hook of hooks) {
      if (!config.hooks[hook.type]) {
        config.hooks[hook.type] = [];
      }
      config.hooks[hook.type]!.push({
        matcher: hook.matcher,
        command: hook.command,
        description: hook.description,
      });
    }

    return config;
  }

  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private defaultSkillContent(name: string): string {
    return `# ${name} Skill

## Overview
Describe what this skill does and when to use it.

## Triggers
- When to activate this skill
- Specific use cases

## Workflow
1. Step one
2. Step two
3. Step three

## Commands
- \`/skill:${name.toLowerCase()}\` - Description

## Configuration
Optional configuration options.
`;
  }
}
