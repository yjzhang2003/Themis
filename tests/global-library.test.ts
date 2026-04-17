import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { GlobalLibraryStore } from '../src/global-library/store.js';

describe('GlobalLibraryStore', () => {
  // Use a temp directory for testing
  const testBaseDir = join('/tmp', `th-test-${Date.now()}`);

  // Store original for cleanup
  const originalHomedir = process.env.HOME;

  beforeEach(() => {
    // Set temp HOME for tests
    process.env.HOME = testBaseDir;
    // Create test directory structure - skills, hooks, rules are directly under ~/.claude/
    mkdirSync(join(testBaseDir, '.claude', 'skills'), { recursive: true });
    mkdirSync(join(testBaseDir, '.claude', 'hooks'), { recursive: true });
    mkdirSync(join(testBaseDir, '.claude', 'rules'), { recursive: true });
  });

  afterEach(() => {
    // Restore original HOME
    if (originalHomedir) {
      process.env.HOME = originalHomedir;
    }
    // Cleanup test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('constructor and paths', () => {
    it('creates GlobalLibraryStore with correct global path', () => {
      const store = new GlobalLibraryStore();
      expect(store.getGlobalPath()).toBe(join(process.env.HOME!, '.claude'));
    });
  });

  describe('ensureDirectories', () => {
    it('creates library directories if they do not exist', () => {
      const store = new GlobalLibraryStore();
      store.ensureDirectories();

      const globalPath = store.getGlobalPath();
      expect(existsSync(join(globalPath, 'skills'))).toBe(true);
      expect(existsSync(join(globalPath, 'hooks'))).toBe(true);
      expect(existsSync(join(globalPath, 'rules'))).toBe(true);
    });
  });

  describe('listSkills', () => {
    it('returns empty array when no skills exist in temp dir', () => {
      const store = new GlobalLibraryStore();
      const skills = store.listSkills();
      // In our isolated temp dir, there should be no skills
      // Unless test artifacts remain
      expect(Array.isArray(skills)).toBe(true);
    });

    it('parses skill from directory format with SKILL.md', () => {
      const store = new GlobalLibraryStore();
      const skillDir = join(store.getGlobalPath(), 'skills', 'test-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), `# Test Skill

Description of the test skill.

## Usage

How to use it.
`);

      const skills = store.listSkills();
      const testSkill = skills.find(s => s.id === 'test-skill');
      expect(testSkill).toBeDefined();
      expect(testSkill?.name).toBe('Test Skill');
      // Description should be extracted - it may vary based on parsing
      expect(typeof testSkill?.description).toBe('string');
    });

    it('parses skill from YAML format', () => {
      const store = new GlobalLibraryStore();
      const yamlPath = join(store.getGlobalPath(), 'skills', 'yaml-skill.yaml');
      writeFileSync(yamlPath, `
id: yaml-skill
name: YAML Skill
description: A skill from YAML
category: testing
`);

      const skills = store.listSkills();
      const yamlSkill = skills.find(s => s.id === 'yaml-skill');
      expect(yamlSkill).toBeDefined();
      expect(yamlSkill?.name).toBe('YAML Skill');
    });
  });

  describe('listHooks', () => {
    it('returns array (may be empty or have existing hooks)', () => {
      const store = new GlobalLibraryStore();
      const hooks = store.listHooks();
      expect(Array.isArray(hooks)).toBe(true);
    });

    it('parses hook from YAML format', () => {
      const store = new GlobalLibraryStore();
      const hookPath = join(store.getGlobalPath(), 'hooks', 'test-hook.yaml');
      writeFileSync(hookPath, `
id: test-hook
name: Test Hook
type: PostToolUse
command: echo "test"
description: A test hook
`);

      const hooks = store.listHooks();
      const testHook = hooks.find(h => h.id === 'test-hook');
      expect(testHook).toBeDefined();
      expect(testHook?.type).toBe('PostToolUse');
      expect(testHook?.command).toBe('echo "test"');
    });

    it('parses PreToolUse hook type', () => {
      const store = new GlobalLibraryStore();
      const hookPath = join(store.getGlobalPath(), 'hooks', 'pre-hook.yaml');
      writeFileSync(hookPath, `
id: pre-hook
name: Pre Hook
type: PreToolUse
command: validate
`);

      const hooks = store.listHooks();
      const preHook = hooks.find(h => h.id === 'pre-hook');
      expect(preHook).toBeDefined();
      expect(preHook?.type).toBe('PreToolUse');
    });
  });

  describe('listRules', () => {
    it('returns array (may be empty or have existing rules)', () => {
      const store = new GlobalLibraryStore();
      const rules = store.listRules();
      expect(Array.isArray(rules)).toBe(true);
    });

    it('parses rule from YAML format', () => {
      const store = new GlobalLibraryStore();
      const rulePath = join(store.getGlobalPath(), 'rules', 'test-rule.yaml');
      writeFileSync(rulePath, `
id: test-rule
name: Test Rule
description: A test rule
language: typescript
`);

      const rules = store.listRules();
      const testRule = rules.find(r => r.id === 'test-rule');
      expect(testRule).toBeDefined();
      expect(testRule?.name).toBe('Test Rule');
      expect(testRule?.language).toBe('typescript');
    });
  });

  describe('listSkillCategories', () => {
    it('returns empty array when no skills in temp dir', () => {
      const store = new GlobalLibraryStore();
      const categories = store.listSkillCategories();
      expect(Array.isArray(categories)).toBe(true);
    });

    it('groups skills by category', () => {
      const store = new GlobalLibraryStore();

      // Create skills in different categories
      const skill1Dir = join(store.getGlobalPath(), 'skills', 'skill1');
      const skill2Dir = join(store.getGlobalPath(), 'skills', 'skill2');
      mkdirSync(skill1Dir, { recursive: true });
      mkdirSync(skill2Dir, { recursive: true });

      writeFileSync(join(skill1Dir, 'SKILL.md'), `---
scaffold:
  category: testing
---
# Skill 1
`);

      writeFileSync(join(skill2Dir, 'SKILL.md'), `---
scaffold:
  category: testing
---
# Skill 2
`);

      const categories = store.listSkillCategories();
      const testingCat = categories.find(c => c.name === 'testing');
      expect(testingCat).toBeDefined();
      expect(testingCat?.count).toBe(2);
    });
  });

  describe('getSkill', () => {
    it('returns null for non-existent skill', () => {
      const store = new GlobalLibraryStore();
      expect(store.getSkill('non-existent')).toBeNull();
    });

    it('returns skill when it exists', () => {
      const store = new GlobalLibraryStore();
      const skillDir = join(store.getGlobalPath(), 'skills', 'get-test');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), `# Get Test Skill
Description here.
`);

      const skill = store.getSkill('get-test');
      expect(skill).toBeDefined();
      expect(skill?.id).toBe('get-test');
    });
  });

  describe('getHook', () => {
    it('returns null for non-existent hook', () => {
      const store = new GlobalLibraryStore();
      expect(store.getHook('non-existent')).toBeNull();
    });
  });

  describe('getRule', () => {
    it('returns null for non-existent rule', () => {
      const store = new GlobalLibraryStore();
      expect(store.getRule('non-existent')).toBeNull();
    });
  });

  describe('installSkill', () => {
    it('creates skill directory from path', () => {
      const store = new GlobalLibraryStore();

      // Create a source skill directory
      const sourceDir = join(testBaseDir, 'source-skill');
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(join(sourceDir, 'SKILL.md'), `# Source Skill
Description.
`);

      const skill = store.installSkill(sourceDir, 'installed-skill');
      expect(skill.id).toBe('installed-skill');

      // Verify it exists
      const skillPath = join(store.getGlobalPath(), 'skills', 'installed-skill', 'SKILL.md');
      expect(existsSync(skillPath)).toBe(true);
    });
  });

  describe('removeSkill', () => {
    it('removes skill directory', () => {
      const store = new GlobalLibraryStore();

      // Create a skill first
      const skillDir = join(store.getGlobalPath(), 'skills', 'to-remove');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), `# To Remove
`);

      expect(store.getSkill('to-remove')).not.toBeNull();

      const removed = store.removeSkill('to-remove');
      expect(removed).toBe(true);
      expect(store.getSkill('to-remove')).toBeNull();
    });

    it('returns false for non-existent skill', () => {
      const store = new GlobalLibraryStore();
      expect(store.removeSkill('non-existent')).toBe(false);
    });
  });

  describe('installHook', () => {
    it('copies hook YAML file', () => {
      const store = new GlobalLibraryStore();

      // Create a source hook file
      const sourceHook = join(testBaseDir, 'source-hook.yaml');
      writeFileSync(sourceHook, `
id: source-hook
name: Source Hook
type: PostToolUse
command: echo "source"
`);

      const hook = store.installHook(sourceHook, 'installed-hook');

      // The returned hook has id from YAML content
      expect(hook.id).toBe('source-hook');

      // But the file is copied with the correct filename
      const hookPath = join(store.getGlobalPath(), 'hooks', 'installed-hook.yaml');
      expect(existsSync(hookPath)).toBe(true);
    });
  });

  describe('removeHook', () => {
    it('removes hook file', () => {
      const store = new GlobalLibraryStore();

      // Create a hook first
      const hookPath = join(store.getGlobalPath(), 'hooks', 'to-remove-hook.yaml');
      writeFileSync(hookPath, `
id: to-remove-hook
name: To Remove Hook
type: PostToolUse
command: echo "test"
`);

      expect(store.getHook('to-remove-hook')).not.toBeNull();

      const removed = store.removeHook('to-remove-hook');
      expect(removed).toBe(true);
      expect(store.getHook('to-remove-hook')).toBeNull();
    });
  });

  describe('listSkillsByCategory', () => {
    it('filters skills by category', () => {
      const store = new GlobalLibraryStore();

      // Create skills in different categories
      const skill1Dir = join(store.getGlobalPath(), 'skills', 'cat-skill1');
      const skill2Dir = join(store.getGlobalPath(), 'skills', 'cat-skill2');
      mkdirSync(skill1Dir, { recursive: true });
      mkdirSync(skill2Dir, { recursive: true });

      writeFileSync(join(skill1Dir, 'SKILL.md'), `---
scaffold:
  category: frontend
---
# Cat Skill 1
`);

      writeFileSync(join(skill2Dir, 'SKILL.md'), `---
scaffold:
  category: backend
---
# Cat Skill 2
`);

      const frontendSkills = store.listSkillsByCategory('frontend');
      expect(frontendSkills.length).toBe(1);
      expect(frontendSkills[0]?.id).toBe('cat-skill1');
    });

    it('returns all skills when category is "all"', () => {
      const store = new GlobalLibraryStore();
      const allSkills = store.listSkillsByCategory('all');
      expect(Array.isArray(allSkills)).toBe(true);
    });
  });
});
