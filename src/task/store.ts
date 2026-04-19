import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Task, TasksIndex, TasksIndexSchema } from './types.js';
import { GlobalLibraryStore } from '../global-library/index.js';
import { SuiteStore } from '../suite/index.js';

const MAIN_DIR = '.themis';
const TASKS_FILE = 'tasks.json';
const TASK_MARKER = '.themis';

function getMainPath(): string {
  return join(homedir(), MAIN_DIR);
}

function getTasksFilePath(): string {
  return join(getMainPath(), TASKS_FILE);
}

function getTaskMarkerPath(taskPath: string): string {
  return join(taskPath, TASK_MARKER);
}

export class TaskStore {
  private index: TasksIndex;

  constructor() {
    this.index = this.loadIndex();
  }

  private loadIndex(): TasksIndex {
    const path = getTasksFilePath();
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(content);
        // Back-fill provider field for existing tasks
        if (parsed.tasks) {
          parsed.tasks = parsed.tasks.map((t: Record<string, unknown>) => ({
            ...t,
            provider: t.provider ?? 'claude',
          }));
        }
        return TasksIndexSchema.parse(parsed);
      } catch (e) {
        console.error(`[TaskStore] Failed to parse ${path}:`, e instanceof Error ? e.message : e);
      }
    }
    return { version: '1.0', tasks: [] };
  }

  private saveIndex(): void {
    const path = getTasksFilePath();
    const dir = getMainPath();
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  ensureDirectories(): void {
    mkdirSync(getMainPath(), { recursive: true });
  }

  listTasks(): Task[] {
    // Filter out tasks whose directories no longer exist
    this.index.tasks = this.index.tasks.filter((t) => existsSync(getTaskMarkerPath(t.path)));
    this.saveIndex();
    return [...this.index.tasks];
  }

  getTask(name: string): Task | null {
    const task = this.index.tasks.find((t) => t.name === name);
    if (!task) return null;
    // Verify directory still exists
    if (!existsSync(getTaskMarkerPath(task.path))) {
      this.deleteTask(name);
      return null;
    }
    return { ...task };
  }

  getTaskByPath(path: string): Task | null {
    const task = this.index.tasks.find((t) => t.path === path);
    if (!task) return null;
    // Verify directory still exists
    if (!existsSync(getTaskMarkerPath(task.path))) {
      this.deleteTask(task.name);
      return null;
    }
    return { ...task };
  }
  getActiveTask(): Task | null {
    const active = this.index.tasks.find((t) => t.status === 'in_progress');
    if (!active) return null;
    if (!existsSync(getTaskMarkerPath(active.path))) {
      this.deleteTask(active.name);
      return null;
    }
    return { ...active };
  }

  createTask(name: string, taskPath?: string, description?: string, provider: 'claude' | 'codex' = 'claude', suiteId?: string): Task {
    const now = new Date().toISOString();
    const absPath = taskPath ? (existsSync(taskPath) ? taskPath : join(process.cwd(), taskPath)) : join(process.cwd(), name);

    const task: Task = {
      name,
      id: name,
      path: absPath,
      created_at: now,
      updated_at: now,
      status: 'paused',
      description,
      skills: [],
      hooks: {},
      provider,
      suite_id: suiteId,
    };

    // Create .themis/ marker directory (CLI识别用)
    mkdirSync(getTaskMarkerPath(absPath), { recursive: true });

    // Create provider-specific config directory
    const configDir = provider === 'codex' ? '.codex' : '.claude';
    const settingsFile = provider === 'codex' ? 'config.json' : 'settings.json';
    const configPath = join(absPath, configDir);
    mkdirSync(configPath, { recursive: true });
    writeFileSync(
      join(configPath, settingsFile),
      JSON.stringify({ skills: [], hooks: {} }, null, 2),
      'utf-8'
    );

    // Also create scaffold for the other provider (for future switching)
    const otherDir = provider === 'codex' ? '.claude' : '.codex';
    const otherSettingsFile = provider === 'codex' ? 'settings.json' : 'config.json';
    const otherPath = join(absPath, otherDir);
    if (!existsSync(otherPath)) {
      mkdirSync(otherPath, { recursive: true });
      writeFileSync(
        join(otherPath, otherSettingsFile),
        JSON.stringify({ skills: [], hooks: {} }, null, 2),
        'utf-8'
      );
    }

    // Apply suite if provided
    if (suiteId) {
      const suiteStore = new SuiteStore();
      suiteStore.applySuiteToTask(suiteId, name, absPath, provider);
    }

    // Add to index
    this.index.tasks.push(task);
    this.saveIndex();

    return { ...task };
  }

  updateTask(name: string, updates: Partial<Task>): Task | null {
    const idx = this.index.tasks.findIndex((t) => t.name === name);
    if (idx === -1) return null;

    const task = this.index.tasks[idx];
    const updated: Task = {
      ...task,
      ...updates,
      name: task.name, // Don't allow renaming
      updated_at: new Date().toISOString(),
    };

    this.index.tasks[idx] = updated;
    this.saveIndex();
    return { ...updated };
  }

  /**
   * Apply a suite to an existing task
   */
  bindSuite(taskName: string, suiteId: string): Task | null {
    const task = this.getTask(taskName);
    if (!task) return null;

    const suiteStore = new SuiteStore();
    const success = suiteStore.applySuiteToTask(suiteId, taskName, task.path, task.provider);
    if (!success) return null;

    return this.updateTask(taskName, { suite_id: suiteId });
  }

  /**
   * Sync task skills and hooks to .claude/settings.json or .codex/config.json
   * Called when activating a task so the AI CLI picks up the correct configuration
   */
  syncTaskResources(name: string): Task | null {
    const task = this.getTask(name);
    if (!task) return null;

    const provider = task.provider ?? 'claude';
    const configDir = provider === 'codex' ? '.codex' : '.claude';
    const settingsFile = provider === 'codex' ? 'config.json' : 'settings.json';
    const settingsPath = join(task.path, configDir, settingsFile);

    // Get skill paths from global library
    const globalLib = new GlobalLibraryStore();
    const skillPaths = task.skills
      .filter((s) => s.enabled)
      .map((s) => globalLib.getSkillPath(s.skill))
      .filter((p): p is string => p !== null);

    // Build hooks object
    const hooks: Record<string, string[]> = {};
    for (const [type, hookIds] of Object.entries(task.hooks)) {
      const hookPaths = hookIds
        .map((id) => globalLib.getHookPath(id))
        .filter((p): p is string => p !== null);
      if (hookPaths.length > 0) {
        hooks[type] = hookPaths;
      }
    }

    const settings = {
      skills: skillPaths,
      hooks,
    };

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return task;
  }

  deleteTask(name: string): boolean {
    const idx = this.index.tasks.findIndex((t) => t.name === name);
    if (idx === -1) return false;

    const task = this.index.tasks[idx];

    // Remove .themis/ marker directory but NOT the user's source files
    const markerPath = getTaskMarkerPath(task.path);
    if (existsSync(markerPath)) {
      rmSync(markerPath, { recursive: true, force: true });
    }

    // Remove both .claude/ and .codex/ directories
    for (const dir of ['.claude', '.codex'] as const) {
      const configPath = join(task.path, dir);
      if (existsSync(configPath)) {
        rmSync(configPath, { recursive: true, force: true });
      }
    }

    this.index.tasks.splice(idx, 1);
    this.saveIndex();
    return true;
  }

  taskExists(name: string): boolean {
    return this.index.tasks.some((t) => t.name === name);
  }

  taskPathExists(path: string): boolean {
    return this.index.tasks.some((t) => t.path === path);
  }

  isTaskDirectory(dir: string): boolean {
    return existsSync(getTaskMarkerPath(dir));
  }

  getMainPath(): string {
    return getMainPath();
  }
}
