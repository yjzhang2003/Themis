import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import YAML from 'yaml';
import { SupervisorConfig, SupervisorConfigSchema } from './types.js';

const CONFIG_PATH = join(homedir(), '.claude', 'themis', 'supervisor.yaml');

export class SupervisorConfigManager {
  private config: SupervisorConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): SupervisorConfig {
    if (existsSync(CONFIG_PATH)) {
      try {
        const content = readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = YAML.parse(content);
        return SupervisorConfigSchema.parse(parsed);
      } catch {
        // Fall through to defaults
      }
    }
    return this.createDefaultConfig();
  }

  private createDefaultConfig(): SupervisorConfig {
    const config: SupervisorConfig = {
      version: '1.0',
      tmux_base_session: 'ths-supervisor',
      task_session_prefix: 'th-task-',
      check_interval_ms: 5000,
      auto_restart: false,
      max_restart_attempts: 3,
      restart_cooldown_ms: 30000,
      log_path: join(homedir(), '.claude', 'themis', 'supervisor.log'),
      notifications: {
        on_death: true,
        on_restart: false,
      },
    };
    this.saveConfig(config);
    return config;
  }

  private saveConfig(config: SupervisorConfig): void {
    const dir = join(homedir(), '.claude', 'themis');
    mkdirSync(dir, { recursive: true });
    const yaml = YAML.stringify(config);
    writeFileSync(CONFIG_PATH, yaml, 'utf-8');
  }

  getConfig(): SupervisorConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SupervisorConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  getSessionsDir(): string {
    return join(homedir(), '.claude', 'themis', 'sessions');
  }

  ensureDirectories(): void {
    const dir = join(homedir(), '.claude', 'themis', 'sessions');
    mkdirSync(dir, { recursive: true });
  }

  getLogPath(): string {
    return this.config.log_path;
  }

  getCheckInterval(): number {
    return this.config.check_interval_ms;
  }

  getTaskSessionPrefix(): string {
    return this.config.task_session_prefix;
  }
}
