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
  provider: 'claude' | 'codex' | 'universal';
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
  private themisPath: string;
  private readonly UNIVERSAL_SKILLS_DIR = 'library/skills';

  constructor() {
    // Claude Code stores skills, hooks, rules directly under ~/.claude/
    this.globalPath = join(homedir(), '.claude');
    this.themisPath = join(homedir(), '.themis');
  }

  getGlobalPath(): string {
    return this.globalPath;
  }

  getThemisPath(): string {
    return this.themisPath;
  }

  getUniversalLibraryPath(): string {
    return join(this.themisPath, this.UNIVERSAL_SKILLS_DIR);
  }

  ensureUniversalLibrary(): void {
    mkdirSync(this.getUniversalLibraryPath(), { recursive: true });
  }

  ensureDirectories(): void {
    // Ensure the standard Claude Code directories exist
    mkdirSync(join(this.globalPath, 'skills'), { recursive: true });
    mkdirSync(join(this.globalPath, 'hooks'), { recursive: true });
    mkdirSync(join(this.globalPath, 'rules'), { recursive: true });
  }

  // Skills
  listSkills(): GlobalSkill[] {
    const skills: GlobalSkill[] = [];

    // List Claude Code skills
    const ccSkillsDir = join(this.globalPath, 'skills');
    if (existsSync(ccSkillsDir)) {
      const ccEntries = readdirSync(ccSkillsDir);
      for (const entry of ccEntries) {
        const entryPath = join(ccSkillsDir, entry);
        const stat = statSync(entryPath);

        if (stat.isDirectory()) {
          const skillMdPath = join(entryPath, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const skill = this.parseSkillMd(skillMdPath, entry, 'claude');
            if (skill) skills.push(skill);
          }
        } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
          const skill = this.parseSkillYaml(join(ccSkillsDir, entry), 'claude');
          if (skill) skills.push(skill);
        }
      }
    }

    // List Universal skills from ~/.themis/library/skills/
    const universalSkillsDir = this.getUniversalLibraryPath();
    if (existsSync(universalSkillsDir)) {
      const universalEntries = readdirSync(universalSkillsDir);
      for (const entry of universalEntries) {
        const entryPath = join(universalSkillsDir, entry);
        const stat = statSync(entryPath);

        if (stat.isDirectory()) {
          const skillMdPath = join(entryPath, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const skill = this.parseSkillMd(skillMdPath, entry, 'universal');
            if (skill) skills.push(skill);
          }
        } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
          const skill = this.parseSkillYaml(join(universalSkillsDir, entry), 'universal');
          if (skill) skills.push(skill);
        }
      }
    }

    return skills;
  }

  private parseSkillMd(filePath: string, id: string, provider: 'claude' | 'codex' | 'universal' = 'claude'): GlobalSkill | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const skill = this.parseSkillFromContent(content, id, provider);
      return skill;
    } catch {
      return null;
    }
  }

  private parseSkillFromContent(content: string, id: string, provider: 'claude' | 'codex' | 'universal' = 'claude'): GlobalSkill | null {
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

    // Provider from frontmatter overrides the default
    const frontmatterProvider = metadata.provider as 'claude' | 'codex' | 'universal' | undefined;
    const finalProvider = frontmatterProvider || provider;

    return {
      id,
      name,
      description,
      category,
      provider: finalProvider,
      content: content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private parseSkillYaml(filePath: string, provider: 'claude' | 'codex' | 'universal' = 'claude'): GlobalSkill | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = YAML.parse(content);
      const frontmatterProvider = parsed.provider as 'claude' | 'codex' | 'universal' | undefined;
      return {
        id: parsed.id || basename(filePath, '.yaml'),
        name: parsed.name || parsed.id || basename(filePath, '.yaml'),
        description: parsed.description || '',
        category: parsed.category || 'uncategorized',
        provider: frontmatterProvider || provider,
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

    // Check directory format in Claude Code skills
    const dirPath = join(skillsDir, id, 'SKILL.md');
    if (existsSync(dirPath)) {
      return this.parseSkillMd(dirPath, id, 'claude');
    }

    // Check YAML format in Claude Code skills
    const yamlPath = join(skillsDir, `${id}.yaml`);
    if (existsSync(yamlPath)) {
      return this.parseSkillYaml(yamlPath, 'claude');
    }

    // Check universal library
    const universalDir = join(this.getUniversalLibraryPath(), id, 'SKILL.md');
    if (existsSync(universalDir)) {
      return this.parseSkillMd(universalDir, id, 'universal');
    }

    const universalYaml = join(this.getUniversalLibraryPath(), `${id}.yaml`);
    if (existsSync(universalYaml)) {
      return this.parseSkillYaml(universalYaml, 'universal');
    }

    return null;
  }

  // Universal skill methods
  getUniversalSkillPath(id: string): string | null {
    const universalDir = join(this.getUniversalLibraryPath(), id);
    if (existsSync(universalDir)) {
      return universalDir;
    }
    const universalYaml = join(this.getUniversalLibraryPath(), `${id}.yaml`);
    if (existsSync(universalYaml)) {
      return universalYaml;
    }
    return null;
  }

  installUniversalSkill(sourcePath: string, name?: string): GlobalSkill {
    this.ensureUniversalLibrary();
    const universalDir = join(this.getUniversalLibraryPath());
    const id = name || basename(sourcePath);
    const destDir = join(universalDir, id);

    const stat = statSync(sourcePath);
    if (stat.isDirectory()) {
      mkdirSync(destDir, { recursive: true });
      const entries = readdirSync(sourcePath);
      for (const entry of entries) {
        copyFileSync(join(sourcePath, entry), join(destDir, entry));
      }
    } else if (sourcePath.endsWith('.md') || sourcePath.endsWith('.yaml')) {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(sourcePath, join(destDir, 'SKILL.md'));
    }

    return this.getSkill(id)!;
  }

  removeUniversalSkill(id: string): boolean {
    const dirPath = join(this.getUniversalLibraryPath(), id);
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
    const yamlPath = join(this.getUniversalLibraryPath(), `${id}.yaml`);
    if (existsSync(yamlPath)) {
      rmSync(yamlPath, { force: true });
      return true;
    }
    return false;
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

  // Hooks - stored in hooks.json
  listHooks(): GlobalHook[] {
    const hooksPath = join(this.globalPath, 'hooks', 'hooks.json');
    if (!existsSync(hooksPath)) return [];

    try {
      const content = readFileSync(hooksPath, 'utf-8');
      const parsed = JSON.parse(content);
      const hooks: GlobalHook[] = [];

      // hooks.json has structure: { hooks: { PreToolUse: [...], PostToolUse: [...], Stop: [...] } }
      const hookTypes = ['PreToolUse', 'PostToolUse', 'Stop', 'SessionStart', 'SessionEnd', 'PreCompact'] as const;

      for (const hookType of hookTypes) {
        const hooksList = parsed.hooks?.[hookType] || [];
        for (const hook of hooksList) {
          if (hook.id) {
            hooks.push({
              id: hook.id,
              name: hook.description || hook.id,
              type: hookType,
              command: hook.hooks?.[0]?.command || '',
              matcher: hook.matcher,
              description: hook.description,
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      return hooks;
    } catch {
      return [];
    }
  }

  listHooksByType(): Record<string, GlobalHook[]> {
    const hooks = this.listHooks();
    const byType: Record<string, GlobalHook[]> = {};

    for (const hook of hooks) {
      if (!byType[hook.type]) {
        byType[hook.type] = [];
      }
      byType[hook.type].push(hook);
    }

    return byType;
  }

  getHook(id: string): GlobalHook | null {
    const hooks = this.listHooks();
    return hooks.find(h => h.id === id) || null;
  }

  installHook(sourcePath: string, id: string, type: string = 'PostToolUse', matcher?: string, description?: string): GlobalHook {
    const hooksPath = join(this.globalPath, 'hooks', 'hooks.json');
    let parsed = { hooks: {} as Record<string, unknown[]> };

    if (existsSync(hooksPath)) {
      try {
        const content = readFileSync(hooksPath, 'utf-8');
        parsed = JSON.parse(content);
      } catch {}
    }

    // Ensure hooks array exists for this type
    if (!parsed.hooks[type]) {
      parsed.hooks[type] = [];
    }

    // Create new hook entry
    const newHook = {
      id,
      matcher: matcher || 'Bash',
      hooks: [{ type: 'command', command: sourcePath }],
      description: description || id,
    };

    parsed.hooks[type].push(newHook);

    // Write back to hooks.json
    writeFileSync(hooksPath, JSON.stringify(parsed, null, 2));

    return {
      id,
      name: description || id,
      type: type as GlobalHook['type'],
      command: sourcePath,
      matcher,
      description,
      created_at: new Date().toISOString(),
    };
  }

  removeHook(id: string): boolean {
    const hooksPath = join(this.globalPath, 'hooks', 'hooks.json');
    if (!existsSync(hooksPath)) return false;

    try {
      const content = readFileSync(hooksPath, 'utf-8');
      const parsed = JSON.parse(content);

      let found = false;
      const hookTypes = ['PreToolUse', 'PostToolUse', 'Stop', 'SessionStart', 'SessionEnd', 'PreCompact'] as const;

      for (const hookType of hookTypes) {
        const hooksList = parsed.hooks?.[hookType] || [];
        const index = hooksList.findIndex((h: { id?: string }) => h.id === id);
        if (index !== -1) {
          hooksList.splice(index, 1);
          parsed.hooks[hookType] = hooksList;
          found = true;
          break;
        }
      }

      if (found) {
        writeFileSync(hooksPath, JSON.stringify(parsed, null, 2));
        return true;
      }

      return false;
    } catch {
      return false;
    }
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

  // Get full path to a skill directory or file
  getSkillPath(id: string): string | null {
    // Check universal library first (higher priority)
    const universalPath = this.getUniversalSkillPath(id);
    if (universalPath) {
      return universalPath;
    }

    const skillsDir = join(this.globalPath, 'skills');

    // Check directory format first
    const dirPath = join(skillsDir, id);
    if (existsSync(dirPath)) {
      return dirPath;
    }

    // Check YAML format
    const yamlPath = join(skillsDir, `${id}.yaml`);
    if (existsSync(yamlPath)) {
      return yamlPath;
    }

    return null;
  }

  // Get full path to a hook script
  getHookPath(id: string): string | null {
    const hooks = this.listHooks();
    const hook = hooks.find(h => h.id === id);
    if (hook) {
      // The command is the path to the hook script
      return hook.command;
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

  listSkillsByCategory(
    category: string,
    options?: {
      search?: string;
      page?: number;
      pageSize?: number;
    }
  ): {
    skills: GlobalSkill[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    const pageSize = options?.pageSize || 10;
    const page = options?.page || 1;
    let skills = this.listSkills();

    // Filter by category
    if (category && category !== 'all') {
      skills = skills.filter((s) => s.category === category);
    }

    // Filter by search query
    if (options?.search) {
      const query = options.search.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query)
      );
    }

    const total = skills.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedSkills = skills.slice(start, start + pageSize);

    return {
      skills: paginatedSkills,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  listHooksByTypePaginated(
    type?: string,
    options?: {
      search?: string;
      page?: number;
      pageSize?: number;
    }
  ): {
    hooks: GlobalHook[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    const pageSize = options?.pageSize || 10;
    const page = options?.page || 1;
    let hooks = this.listHooks();

    // Filter by type
    if (type && type !== 'all') {
      hooks = hooks.filter((h) => h.type === type);
    }

    // Filter by search query
    if (options?.search) {
      const query = options.search.toLowerCase();
      hooks = hooks.filter(
        (h) =>
          h.name.toLowerCase().includes(query) ||
          h.description?.toLowerCase().includes(query)
      );
    }

    const total = hooks.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedHooks = hooks.slice(start, start + pageSize);

    return {
      hooks: paginatedHooks,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
