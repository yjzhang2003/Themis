import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Suite, SuitesIndexSchema, SuiteSkill } from './types.js';
import { GlobalLibraryStore } from '../global-library/index.js';

const MAIN_DIR = '.themis';
const SUITES_FILE = 'suites.json';
const LIBRARY_DIR = 'library';
const LIBRARY_SKILLS_DIR = 'library/skills';

function getMainPath(): string {
  return join(homedir(), MAIN_DIR);
}

function getSuitesFilePath(): string {
  return join(getMainPath(), SUITES_FILE);
}

function getLibraryPath(): string {
  return join(getMainPath(), LIBRARY_DIR);
}

export class SuiteStore {
  private index: { version: string; suites: Suite[] };

  constructor() {
    this.index = this.loadIndex();
  }

  private loadIndex(): { version: string; suites: Suite[] } {
    const path = getSuitesFilePath();
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        return SuitesIndexSchema.parse(JSON.parse(content));
      } catch (e) {
        console.error(`[SuiteStore] Failed to parse ${path}:`, e instanceof Error ? e.message : e);
      }
    }
    return { version: '1.0', suites: [] };
  }

  private saveIndex(): void {
    const path = getSuitesFilePath();
    const dir = getMainPath();
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  ensureDirectories(): void {
    const mainPath = getMainPath();
    mkdirSync(mainPath, { recursive: true });
    mkdirSync(join(mainPath, LIBRARY_SKILLS_DIR), { recursive: true });
  }

  // Queries
  listSuites(): Suite[] {
    return [...this.index.suites];
  }

  getSuite(id: string): Suite | null {
    const suite = this.index.suites.find(s => s.id === id);
    return suite ? { ...suite } : null;
  }

  suiteExists(id: string): boolean {
    return this.index.suites.some(s => s.id === id);
  }

  // Mutations
  createSuite(data: { name: string; description?: string; skills: SuiteSkill[] }): Suite {
    const now = new Date().toISOString();
    const id = this.generateId(data.name);

    const suite: Suite = {
      id,
      name: data.name,
      description: data.description,
      skills: data.skills,
      created_at: now,
      updated_at: now,
    };

    this.index.suites.push(suite);
    this.saveIndex();
    return { ...suite };
  }

  updateSuite(id: string, data: { name?: string; description?: string; skills?: SuiteSkill[] }): Suite | null {
    const idx = this.index.suites.findIndex(s => s.id === id);
    if (idx === -1) return null;

    const suite = this.index.suites[idx];
    const updated: Suite = {
      ...suite,
      name: data.name ?? suite.name,
      description: data.description ?? suite.description,
      skills: data.skills ?? suite.skills,
      updated_at: new Date().toISOString(),
    };

    this.index.suites[idx] = updated;
    this.saveIndex();
    return { ...updated };
  }

  deleteSuite(id: string): boolean {
    const idx = this.index.suites.findIndex(s => s.id === id);
    if (idx === -1) return false;

    this.index.suites.splice(idx, 1);
    this.saveIndex();
    return true;
  }

  /**
   * Apply a suite to a task - copies skills to the task's provider directory
   * and updates the task's skills array
   */
  applySuiteToTask(suiteId: string, taskName: string, taskPath: string, provider: 'claude' | 'codex'): boolean {
    const suite = this.getSuite(suiteId);
    if (!suite) {
      console.error(`[SuiteStore] Suite ${suiteId} not found`);
      return false;
    }

    const globalLib = new GlobalLibraryStore();

    // Filter skills by provider: universal + matching provider
    const applicableSkills = suite.skills.filter(
      s => s.provider === 'universal' || s.provider === provider
    );

    // Determine target directory based on provider
    const configDir = provider === 'codex' ? '.codex' : '.claude';
    const targetSkillsDir = join(taskPath, configDir, 'skills');

    // Copy universal skills to task's skills directory
    for (const skillRef of applicableSkills) {
      if (skillRef.provider === 'universal') {
        const sourcePath = globalLib.getUniversalSkillPath(skillRef.id);
        if (sourcePath && existsSync(sourcePath)) {
          const destPath = join(targetSkillsDir, skillRef.id);
          mkdirSync(targetSkillsDir, { recursive: true });
          this.copySkillRecursive(sourcePath, destPath);
        }
      }
    }

    return true;
  }

  private copySkillRecursive(src: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src);
    for (const entry of entries) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      const stat = statSync(srcPath);
      if (stat.isDirectory()) {
        this.copySkillRecursive(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  private generateId(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let id = base;
    let counter = 1;
    while (this.suiteExists(id)) {
      id = `${base}-${counter}`;
      counter++;
    }
    return id;
  }

  getMainPath(): string {
    return getMainPath();
  }

  getLibraryPath(): string {
    return getLibraryPath();
  }
}
