import { homedir } from 'os';
import { join, basename } from 'path';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync, statSync, copyFileSync } from 'fs';
import { readFileSync as readFile } from 'fs';
import * as YAML from 'yaml';

export interface GlobalSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  content?: string;
  created_at: string;
  updated_at: string;
}

export interface GlobalHook {
  id: string;
  name: string;
  type: 'PreToolUse' | 'PostToolUse' | 'Stop';
  command: string;
  matcher?: string;
  description?: string;
  created_at: string;
}

export interface GlobalRule {
  id: string;
  name: string;
  description: string;
  language?: string;
  content?: string;
  created_at: string;
}

export class GlobalLibraryStore {
  private globalPath: string;

  constructor() {
    // Claude Code stores skills, hooks, rules directly under ~/.claude/
    this.globalPath = join(homedir(), '.claude');
  }

  getGlobalPath(): string {
    return this.globalPath;
  }

  ensureDirectories(): void {
    // Ensure the standard Claude Code directories exist
    mkdirSync(join(this.globalPath, 'skills'), { recursive: true });
    mkdirSync(join(this.globalPath, 'hooks'), { recursive: true });
    mkdirSync(join(this.globalPath, 'rules'), { recursive: true });
  }

  // Skills
  listSkills(): GlobalSkill[] {
    const skillsDir = join(this.globalPath, 'skills');
    if (!existsSync(skillsDir)) return [];

    const skills: GlobalSkill[] = [];
    const entries = readdirSync(skillsDir);

    for (const entry of entries) {
      const entryPath = join(skillsDir, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        // Directory format with SKILL.md
        const skillMdPath = join(entryPath, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          const skill = this.parseSkillMd(skillMdPath, entry);
          if (skill) skills.push(skill);
        }
      } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
        // Legacy YAML format
        const skill = this.parseSkillYaml(join(skillsDir, entry));
        if (skill) skills.push(skill);
      }
    }

    return skills;
  }

  private parseSkillMd(filePath: string, id: string): GlobalSkill | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const skill = this.parseSkillFromContent(content, id);
      return skill;
    } catch {
      return null;
    }
  }

  private parseSkillFromContent(content: string, id: string): GlobalSkill | null {
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let metadata: Record<string, unknown> = {};
    let description = '';

    if (frontmatterMatch) {
      try {
        metadata = YAML.parse(frontmatterMatch[1]) || {};
      } catch {
        // Invalid frontmatter
      }
    }

    // Extract name from first # heading or frontmatter
    const nameMatch = content.match(/^#\s+(.+)$/m);
    const name = (metadata.name as string) || nameMatch?.[1]?.trim() || id;

    // Extract description (paragraph after name or from frontmatter)
    const descMatch = content.match(/^#\s+.+\n\n(.+?)(?=\n##|\n#|$)/s);
    description = (metadata.description as string) || descMatch?.[1]?.trim() || '';

    // Parse metadata.scaffold.category
    const scaffold = metadata.scaffold as Record<string, unknown> | undefined;
    const category = (scaffold?.category as string) || 'uncategorized';

    return {
      id,
      name,
      description,
      category,
      content: content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private parseSkillYaml(filePath: string): GlobalSkill | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = YAML.parse(content);
      return {
        id: parsed.id || basename(filePath, '.yaml'),
        name: parsed.name || parsed.id || basename(filePath, '.yaml'),
        description: parsed.description || '',
        category: parsed.category || 'uncategorized',
        content: parsed.content,
        created_at: parsed.created_at || new Date().toISOString(),
        updated_at: parsed.updated_at || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  getSkill(id: string): GlobalSkill | null {
    const skillsDir = join(this.globalPath, 'skills');

    // Check directory format
    const dirPath = join(skillsDir, id, 'SKILL.md');
    if (existsSync(dirPath)) {
      return this.parseSkillMd(dirPath, id);
    }

    // Check YAML format
    const yamlPath = join(skillsDir, `${id}.yaml`);
    if (existsSync(yamlPath)) {
      return this.parseSkillYaml(yamlPath);
    }

    return null;
  }

  installSkill(sourcePath: string, name?: string): GlobalSkill {
    this.ensureDirectories();
    const skillsDir = join(this.globalPath, 'skills');
    const id = name || basename(sourcePath);
    const destDir = join(skillsDir, id);

    const stat = statSync(sourcePath);
    if (stat.isDirectory()) {
      // Copy entire directory
      mkdirSync(destDir, { recursive: true });
      const entries = readdirSync(sourcePath);
      for (const entry of entries) {
        copyFileSync(join(sourcePath, entry), join(destDir, entry));
      }
    } else if (sourcePath.endsWith('.md') || sourcePath.endsWith('.yaml')) {
      // Copy single file
      mkdirSync(destDir, { recursive: true });
      copyFileSync(sourcePath, join(destDir, 'SKILL.md'));
    }

    return this.getSkill(id)!;
  }

  removeSkill(id: string): boolean {
    const skillsDir = join(this.globalPath, 'skills');
    const dirPath = join(skillsDir, id);

    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  // Hooks
  listHooks(): GlobalHook[] {
    const hooksDir = join(this.globalPath, 'hooks');
    if (!existsSync(hooksDir)) return [];

    const hooks: GlobalHook[] = [];
    const entries = readdirSync(hooksDir);

    for (const entry of entries) {
      if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
        const hook = this.parseHookYaml(join(hooksDir, entry));
        if (hook) hooks.push(hook);
      }
    }

    return hooks;
  }

  private parseHookYaml(filePath: string): GlobalHook | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = YAML.parse(content);
      return {
        id: parsed.id || basename(filePath, '.yaml'),
        name: parsed.name || parsed.id || basename(filePath, '.yaml'),
        type: parsed.type || 'PostToolUse',
        command: parsed.command || '',
        matcher: parsed.matcher,
        description: parsed.description,
        created_at: parsed.created_at || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  getHook(id: string): GlobalHook | null {
    const hooksDir = join(this.globalPath, 'hooks');
    const yamlPath = join(hooksDir, `${id}.yaml`);

    if (existsSync(yamlPath)) {
      return this.parseHookYaml(yamlPath);
    }
    return null;
  }

  installHook(sourcePath: string, name?: string): GlobalHook {
    this.ensureDirectories();
    const hooksDir = join(this.globalPath, 'hooks');
    const id = name || basename(sourcePath, '.yaml');
    const destPath = join(hooksDir, `${id}.yaml`);

    copyFileSync(sourcePath, destPath);
    return this.getHook(id)!;
  }

  removeHook(id: string): boolean {
    const hooksDir = join(this.globalPath, 'hooks');
    const yamlPath = join(hooksDir, `${id}.yaml`);

    if (existsSync(yamlPath)) {
      rmSync(yamlPath, { force: true });
      return true;
    }
    return false;
  }

  // Rules
  listRules(): GlobalRule[] {
    const rulesDir = join(this.globalPath, 'rules');
    if (!existsSync(rulesDir)) return [];

    const rules: GlobalRule[] = [];
    const entries = readdirSync(rulesDir);

    for (const entry of entries) {
      if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
        const rule = this.parseRuleYaml(join(rulesDir, entry));
        if (rule) rules.push(rule);
      }
    }

    return rules;
  }

  private parseRuleYaml(filePath: string): GlobalRule | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = YAML.parse(content);
      return {
        id: parsed.id || basename(filePath, '.yaml'),
        name: parsed.name || parsed.id || basename(filePath, '.yaml'),
        description: parsed.description || '',
        language: parsed.language,
        content: parsed.content,
        created_at: parsed.created_at || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  getRule(id: string): GlobalRule | null {
    const rulesDir = join(this.globalPath, 'rules');
    const yamlPath = join(rulesDir, `${id}.yaml`);

    if (existsSync(yamlPath)) {
      return this.parseRuleYaml(yamlPath);
    }
    return null;
  }

  installRule(sourcePath: string, name?: string): GlobalRule {
    this.ensureDirectories();
    const rulesDir = join(this.globalPath, 'rules');
    const id = name || basename(sourcePath, '.yaml');
    const destPath = join(rulesDir, `${id}.yaml`);

    copyFileSync(sourcePath, destPath);
    return this.getRule(id)!;
  }

  removeRule(id: string): boolean {
    const rulesDir = join(this.globalPath, 'rules');
    const yamlPath = join(rulesDir, `${id}.yaml`);

    if (existsSync(yamlPath)) {
      rmSync(yamlPath, { force: true });
      return true;
    }
    return false;
  }

  // List categories
  listSkillCategories(): { name: string; count: number }[] {
    const skills = this.listSkills();
    const categories: Record<string, number> = {};

    for (const skill of skills) {
      categories[skill.category] = (categories[skill.category] || 0) + 1;
    }

    return Object.entries(categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  listSkillsByCategory(category: string): GlobalSkill[] {
    const skills = this.listSkills();
    if (category === 'all') return skills;
    return skills.filter((s) => s.category === category);
  }
}
