import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Task, TasksIndexSchema } from './types.js';
import { GlobalLibraryStore } from '../global-library/index.js';

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
  private index: TasksIndexSchema;

  constructor() {
    this.index = this.loadIndex();
  }

  private loadIndex(): TasksIndexSchema {
    const path = getTasksFilePath();
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        return TasksIndexSchema.parse(JSON.parse(content));
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

  createTask(name: string, taskPath: string, description?: string): Task {
    const now = new Date().toISOString();
    const absPath = existsSync(taskPath) ? taskPath : join(process.cwd(), taskPath);

    const task: Task = {
      name,
      path: absPath,
      created_at: now,
      status: 'paused',
      description,
      skills: [],
      hooks: {},
    };

    // Create .themis/ marker directory (CLI识别用)
    mkdirSync(getTaskMarkerPath(absPath), { recursive: true });

    // Create .claude/ directory for Claude Code配置
    const claudeDir = join(absPath, '.claude');
    mkdirSync(claudeDir, { recursive: true });

    // Write initial settings.json for Claude Code
    const settingsPath = join(claudeDir, 'settings.json');
    writeFileSync(
      settingsPath,
      JSON.stringify({ skills: [], hooks: {} }, null, 2),
      'utf-8'
    );

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
    };

    this.index.tasks[idx] = updated;
    this.saveIndex();
    return { ...updated };
  }

  /**
   * Sync task skills and hooks to .claude/settings.json
   * Called when activating a task so Claude Code picks up the correct configuration
   */
  syncTaskResources(name: string): Task | null {
    const task = this.getTask(name);
    if (!task) return null;

    const settingsPath = join(task.path, '.claude', 'settings.json');

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

    // Remove .claude/ directory (Claude Code配置)
    const claudePath = join(task.path, '.claude');
    if (existsSync(claudePath)) {
      rmSync(claudePath, { recursive: true, force: true });
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
