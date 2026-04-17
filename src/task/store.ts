import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { Task, WorkspaceConfig, TaskSchema, WorkspaceConfigSchema } from './types.js';
import { TmuxManager } from '../supervisor/tmux.js';

const WORKSPACE_CONFIG_NAME = 'harness.yaml';

export class TaskStore {
  private workspaceRoot: string;
  private config: WorkspaceConfig;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.config = this.loadConfig();
  }

  private loadConfig(): WorkspaceConfig {
    const configPath = join(this.workspaceRoot, WORKSPACE_CONFIG_NAME);
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const parsed = YAML.parse(content);
        return WorkspaceConfigSchema.parse({ ...parsed, workspace_root: this.workspaceRoot });
      } catch (e) {
        console.error(`[TaskStore] Failed to parse ${configPath}:`, e instanceof Error ? e.message : e);
      }
    }
    return this.createDefaultConfig();
  }

  private createDefaultConfig(): WorkspaceConfig {
    const config: WorkspaceConfig = {
      version: '1.0',
      workspace_root: this.workspaceRoot,
      library_path: './library',
      tasks_path: './tasks',
      open_spec_path: undefined,
      active_task: undefined,
    };
    this.saveConfig(config);
    return config;
  }

  private saveConfig(config: WorkspaceConfig): void {
    const configPath = join(this.workspaceRoot, WORKSPACE_CONFIG_NAME);
    const yaml = YAML.stringify(config);
    writeFileSync(configPath, yaml, 'utf-8');
  }

  private getTasksPath(): string {
    return join(this.workspaceRoot, this.config.tasks_path);
  }

  private getTaskDir(taskId: string): string {
    return join(this.getTasksPath(), taskId);
  }

  private getTaskFilePath(taskId: string): string {
    return join(this.getTaskDir(taskId), 'task.yaml');
  }

  private getTaskClaudeDir(taskId: string): string {
    return join(this.getTaskDir(taskId), '.claude');
  }

  ensureDirectories(): void {
    mkdirSync(this.getTasksPath(), { recursive: true });
    mkdirSync(join(this.workspaceRoot, this.config.library_path), { recursive: true });
    mkdirSync(join(this.workspaceRoot, this.config.library_path, 'skills'), { recursive: true });
    mkdirSync(join(this.workspaceRoot, this.config.library_path, 'hooks'), { recursive: true });
    mkdirSync(join(this.workspaceRoot, this.config.library_path, 'rules'), { recursive: true });
  }

  listTasks(): Task[] {
    const tasksPath = this.getTasksPath();
    if (!existsSync(tasksPath)) return [];

    const taskDirs = readdirSync(tasksPath).filter((d) =>
      existsSync(join(tasksPath, d, 'task.yaml'))
    );

    return taskDirs.map((dir) => this.getTask(dir)).filter((t): t is Task => t !== null);
  }

  getTask(taskId: string): Task | null {
    const taskFile = this.getTaskFilePath(taskId);
    if (!existsSync(taskFile)) return null;

    try {
      const content = readFileSync(taskFile, 'utf-8');
      const parsed = YAML.parse(content);
      return TaskSchema.parse({ ...parsed, id: taskId });
    } catch (e) {
      console.error(`[TaskStore] Failed to parse ${taskFile}:`, e instanceof Error ? e.message : e);
      return null;
    }
  }

  createTask(name: string, description?: string): Task {
    const id = this.generateTaskId();
    const now = new Date().toISOString();

    const task: Task = {
      id,
      name,
      description,
      status: 'paused',
      created_at: now,
      updated_at: now,
      skills: [],
      hooks: {},
      rules: [],
      directory: `./tasks/${id}`,
    };

    const taskDir = this.getTaskDir(id);
    mkdirSync(taskDir, { recursive: true });
    mkdirSync(this.getTaskClaudeDir(id), { recursive: true });
    mkdirSync(join(taskDir, 'src'), { recursive: true });

    this.saveTask(task);
    return task;
  }

  saveTask(task: Task): void {
    const taskFile = this.getTaskFilePath(task.id);
    const taskData = { ...task };
    delete (taskData as Record<string, unknown>).directory;
    try {
      const yaml = YAML.stringify(taskData);
      writeFileSync(taskFile, yaml, 'utf-8');
    } catch (e) {
      console.error(`[TaskStore] Failed to save task ${task.id}:`, e instanceof Error ? e.message : e);
      throw new Error(`Failed to save task ${task.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  updateTask(taskId: string, updates: Partial<Task>): Task | null {
    const task = this.getTask(taskId);
    if (!task) return null;

    const updated: Task = {
      ...task,
      ...updates,
      id: task.id,
      updated_at: new Date().toISOString(),
    };

    this.saveTask(updated);
    return updated;
  }

  deleteTask(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task) return false;

    // Kill associated tmux session if exists
    if (task.session?.tmux_session) {
      const tmux = new TmuxManager();
      tmux.killSession(task.session.tmux_session);
    }

    rmSync(this.getTaskDir(taskId), { recursive: true, force: true });
    return true;
  }

  getActiveTask(): Task | null {
    if (!this.config.active_task) return null;
    return this.getTask(this.config.active_task);
  }

  setActiveTask(taskId: string | null): void {
    this.config.active_task = taskId ?? undefined;
    this.saveConfig(this.config);
  }

  getConfig(): WorkspaceConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<WorkspaceConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  private generateTaskId(): string {
    const tasks = this.listTasks();
    const maxNum = tasks.reduce((max, t) => {
      const match = t.id.match(/task-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `task-${String(maxNum + 1).padStart(3, '0')}`;
  }

  isTaskDir(path: string): boolean {
    return existsSync(join(path, WORKSPACE_CONFIG_NAME));
  }

  findWorkspaceRoot(startPath: string): string | null {
    let current = startPath;
    const maxIterations = 20;
    let iterations = 0;

    while (iterations < maxIterations) {
      if (this.isTaskDir(current)) {
        return current;
      }
      const parent = join(current, '..');
      if (parent === current) break;
      current = parent;
      iterations++;
    }
    return null;
  }
}
