import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import { join } from 'path';
import { exec, execSync } from 'child_process';
import { TaskStore } from '../../task/store.js';
import { GlobalLibraryStore } from '../../global-library/index.js';
import { TaskLauncher } from '../../supervisor/launcher.js';
import { TaskStatusMonitor } from '../../supervisor/status-monitor.js';
import { TmuxManager } from '../../supervisor/tmux.js';
import { SessionMonitor } from '../../supervisor/monitor.js';
import { SupervisorConfigManager } from '../../supervisor/config.js';
import { SupervisorLoop } from '../../supervisor/supervisor-loop.js';
import { ListBox } from './listbox.js';
import { useCLI } from '../context.js';

type View =
  | 'main'
  | 'global-resources'
  | 'global-skills'
  | 'global-skills-category'
  | 'global-hooks'
  | 'global-hooks-type'
  | 'global-rules'
  | 'tasks'
  | 'task-detail'
  | 'task-create'
  | 'task-create-current-dir'
  | 'task-delete-confirm'
  | 'skills'
  | 'skill-categories'
  | 'skill-list'
  | 'skill-create'
  | 'skill-select'
  | 'skill-select-category'
  | 'hooks'
  | 'hook-create'
  | 'hook-select'
  | 'hook-select-type'
  | 'sessions'
  | 'supervisor'
  | 'supervisor-reviews'
  | 'supervisor-review'
  | 'back-confirm';

interface InteractiveAppProps {
  store: TaskStore;
  onQuit: () => void;
}

// Shell escape for single-quote context
function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

// Helper: Launch Claude Code in tmux for a task and attach
function launchTaskSession(taskName: string, taskPath: string, skills: string[] = [], hooks: string[] = []): void {
  const launcher = new TaskLauncher();
  const globalLib = new GlobalLibraryStore();
  const sessionName = `th-task-${taskName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  // Initialize status file
  const statusMonitor = new TaskStatusMonitor();
  statusMonitor.initStatus(taskName, taskPath);

  // Build launch config
  const launchConfig = {
    taskId: taskName,
    taskDir: taskPath,
    skills,
    hooks,
    rules: [],
    globalLibraryPath: globalLib.getGlobalPath(),
  };

  try {
    launcher.launch(launchConfig);
  } catch {
    // Ignore launch errors silently
    return;
  }

  // Attach to the tmux session (takes over terminal)
  // User can press Ctrl+B, D to detach and return
  // Clear screen before attach to avoid tmux output mixing with CLI
  execSync(`clear && tmux attach-session -t "${sessionName}"`, { stdio: 'inherit' });
  // Clear screen after detach
  execSync(`clear`, { stdio: 'ignore' });
}

// Helper: Stop a task session
function stopTaskSession(taskName: string): Promise<void> {
  return new Promise((resolve) => {
    const launcher = new TaskLauncher();
    try {
      launcher.stop(taskName);
    } catch {
      // Ignore errors
    }
    resolve();
  });
}

export function InteractiveApp({ store, onQuit }: InteractiveAppProps) {
  const [view, setView] = useState<View>('main');
  const [selectedTaskName, setSelectedTaskName] = useState<string | null>(null);
  const [selectedHookType, setSelectedHookType] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [skillCategory, setSkillCategory] = useState<string>('all');
  const [selectSkillSearch, setSelectSkillSearch] = useState('');
  const [selectSkillPage, setSelectSkillPage] = useState(1);
  const [selectHookSearch, setSelectHookSearch] = useState('');
  const [selectHookPage, setSelectHookPage] = useState(1);
  const [supervisorReviewTaskId, setSupervisorReviewTaskId] = useState<string | null>(null);
  const [browseSkillPage, setBrowseSkillPage] = useState(1);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedHookIds, setSelectedHookIds] = useState<string[]>([]);

  // CLI context
  const { workspaceRoot } = useCLI();

  // Global library store
  const globalLibrary = new GlobalLibraryStore();
  globalLibrary.ensureDirectories();

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const goBack = useCallback(() => {
    setView('main');
    setSelectedTaskName(null);
    setSkillCategory('all');
    setSelectSkillSearch('');
    setSelectSkillPage(1);
    setSelectHookSearch('');
    setSelectHookPage(1);
    setBrowseSkillPage(1);
    setSelectedSkillIds([]);
    setSelectedHookIds([]);
  }, []);

  // Main Menu
  if (view === 'main') {
    const tasks = store.listTasks();
    const globalSkills = globalLibrary.listSkills();
    const globalHooks = globalLibrary.listHooks();
    const globalRules = globalLibrary.listRules();

    return (
      <Box key="main" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>THEMIS</Text>
          <Text dimColor> {process.env.ORIGINAL_PWD || process.cwd()}</Text>
        </Box>

        <ListBox
          key={`main-${refreshKey}`}
          items={[
            {
              id: 'global-resources',
              label: 'Global Resources',
              description: `${globalSkills.length} skills, ${globalHooks.length} hooks, ${globalRules.length} rules`,
              onSelect: () => setView('global-resources'),
            },
            {
              id: 'tasks',
              label: 'Tasks',
              description: `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`,
              onSelect: () => setView('tasks'),
            },
            {
              id: 'sessions',
              label: 'Sessions',
              description: 'Manage running task sessions',
              onSelect: () => setView('sessions'),
            },
            {
              id: 'supervisor',
              label: 'Supervisor',
              description: 'Monitor tasks and review queue',
              onSelect: () => setView('supervisor'),
            },
          ]}
          onBack={onQuit}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Commands: themis new</Text>
          <Text dimColor>[q] Quit</Text>
        </Box>
      </Box>
    );
  }

  // Global Resources - Browse First
  if (view === 'global-resources') {
    const globalSkills = globalLibrary.listSkills();
    const globalHooks = globalLibrary.listHooks();
    const globalRules = globalLibrary.listRules();

    return (
      <Box key="global-resources" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>GLOBAL RESOURCES</Text>
          <Text dimColor> - ~/.claude/library/</Text>
        </Box>

        <ListBox
          key={`global-resources-${refreshKey}`}
          items={[
            {
              id: 'global-skills',
              label: 'Skills',
              description: `${globalSkills.length} skills`,
              onSelect: () => setView('global-skills'),
            },
            {
              id: 'global-hooks',
              label: 'Hooks',
              description: `${globalHooks.length} hooks`,
              onSelect: () => setView('global-hooks'),
            },
            {
              id: 'global-rules',
              label: 'Rules',
              description: `${globalRules.length} rules`,
              onSelect: () => setView('global-rules'),
            },
          ]}
          onBack={goBack}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Browse system-wide resources</Text>
          <Text dimColor>[Esc] Back to main menu</Text>
        </Box>
      </Box>
    );
  }

  // Global Skills List
  if (view === 'global-skills') {
    const categories = globalLibrary.listSkillCategories();

    return (
      <Box key="global-skills" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>GLOBAL SKILLS</Text>
        </Box>

        <ListBox
          key={`global-skills-${refreshKey}`}
          items={categories.map((cat) => ({
            id: cat.name,
            label: cat.name,
            description: `${cat.count} skills`,
            onSelect: () => {
              setSkillCategory(cat.name);
              setView('global-skills-category');
            },
          }))}
          onBack={() => setView('global-resources')}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>[Esc] Back to Global Resources</Text>
        </Box>
      </Box>
    );
  }

  // Global Skills by Category
  if (view === 'global-skills-category') {
    const result = globalLibrary.listSkillsByCategory(skillCategory, {
      page: browseSkillPage,
      pageSize: 8,
    });

    return (
      <Box key="global-skills-category" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>GLOBAL SKILLS</Text>
          <Text dimColor> - {skillCategory}</Text>
        </Box>

        <ListBox
          key={`global-skills-category-${refreshKey}`}
          items={result.skills.map((s) => ({
            id: s.id,
            label: s.name,
            description: s.description?.substring(0, 50) || '(no description)',
            onSelect: () => {
              // Browsing only - no action on select
            },
          }))}
          onBack={() => {
            setBrowseSkillPage(1);
            setView('global-skills');
          }}
          onNextPage={() => setBrowseSkillPage((p) => Math.min(result.totalPages, p + 1))}
          onPrevPage={() => setBrowseSkillPage((p) => Math.max(1, p - 1))}
        />

        <Box marginTop={1} flexDirection="column">
          {result.totalPages > 1 && (
            <Text dimColor>
              Page {result.page}/{result.totalPages} ({result.total} skills) [←/→] page
            </Text>
          )}
          <Text dimColor>[Esc] Back to categories</Text>
        </Box>
      </Box>
    );
  }

  // Global Hooks List - show by type
  if (view === 'global-hooks') {
    const hooksByType = globalLibrary.listHooksByType();
    const hookTypes = Object.keys(hooksByType).filter(t => hooksByType[t].length > 0);

    return (
      <Box key="global-hooks" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>GLOBAL HOOKS</Text>
          <Text dimColor> - by type</Text>
        </Box>

        <ListBox
          key={`global-hooks-${refreshKey}`}
          items={hookTypes.map((type) => ({
            id: type,
            label: type,
            description: `${hooksByType[type].length} hook${hooksByType[type].length !== 1 ? 's' : ''}`,
            onSelect: () => {
              setSelectedHookType(type);
              setView('global-hooks-type');
            },
          }))}
          onBack={() => setView('global-resources')}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>[Esc] Back to Global Resources</Text>
        </Box>
      </Box>
    );
  }

  // Global Hooks by Type
  if (view === 'global-hooks-type') {
    const hooksByType = globalLibrary.listHooksByType();
    const hooks = selectedHookType ? (hooksByType[selectedHookType] || []) : [];

    return (
      <Box key="global-hooks-type" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>GLOBAL HOOKS</Text>
          <Text dimColor> - {selectedHookType}</Text>
        </Box>

        <ListBox
          key={`global-hooks-type-${refreshKey}`}
          items={hooks.map((h) => ({
            id: h.id,
            label: h.name,
            description: h.matcher ? `Matcher: ${h.matcher}` : h.command.substring(0, 50),
            onSelect: () => {
              // Could show hook detail or confirm remove
            },
          }))}
          onBack={() => setView('global-hooks')}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>[Esc] Back to Hook Types</Text>
        </Box>
      </Box>
    );
  }

  // Global Rules List
  if (view === 'global-rules') {
    const rules = globalLibrary.listRules();

    return (
      <Box key="global-rules" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>GLOBAL RULES</Text>
        </Box>

        <ListBox
          key={`global-rules-${refreshKey}`}
          items={rules.map((r) => ({
            id: r.id,
            label: r.name,
            description: r.description?.substring(0, 50) || '(no description)',
            onSelect: () => {},
          }))}
          onBack={() => setView('global-resources')}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>[Esc] Back to Global Resources</Text>
        </Box>
      </Box>
    );
  }

  // Sessions List
  if (view === 'sessions') {
    return (
      <Box key="sessions" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>SESSIONS</Text>
        </Box>

        <Box padding={1}>
          <Text dimColor>Session management requires tmux.</Text>
          <Text dimColor>Commands: th session list, th session attach &lt;id&gt;</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>[Esc] Back to main menu</Text>
        </Box>
      </Box>
    );
  }

  // Supervisor Main View
  if (view === 'supervisor') {
    const tmux = new TmuxManager();
    const config = new SupervisorConfigManager();
    const monitor = new SessionMonitor(config.getSessionsDir(), config.getTaskSessionPrefix());
    const supervisorRunning = tmux.sessionExists('ths-supervisor');
    const states = monitor.checkAllSessions();
    const alive = states.filter(s => s.status === 'alive').length;
    const dead = states.filter(s => s.status === 'dead').length;

    // Check for tasks needing review
    const statusMonitor = new TaskStatusMonitor();
    const tasks = store.listTasks();
    const reviews: string[] = [];
    for (const task of tasks) {
      const status = statusMonitor.readStatus(task.path);
      if (status && status.needs_review) {
        reviews.push(task.name);
      }
    }

    return (
      <Box key="supervisor" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>SUPERVISOR</Text>
        </Box>

        <Box paddingX={1} flexDirection="column">
          <Text>Supervisor: <Text color={supervisorRunning ? 'green' : 'red'}>{supervisorRunning ? 'RUNNING' : 'STOPPED'}</Text></Text>
          <Text>Task Sessions: {states.length} total ({alive} alive, {dead} dead)</Text>
          <Text>Pending Reviews: <Text color={reviews.length > 0 ? 'yellow' : 'green'}>{reviews.length}</Text></Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Actions:</Text>
        </Box>

        <ListBox
          key={`supervisor-${refreshKey}`}
          items={[
            {
              id: 'start',
              label: supervisorRunning ? 'Stop Supervisor' : 'Start Supervisor',
              description: supervisorRunning ? 'Stop the supervisor daemon' : 'Start the supervisor daemon',
              onSelect: () => {
                if (supervisorRunning) {
                  tmux.killSession('ths-supervisor');
                } else {
                  // Use the session command to start supervisor
                  exec(`"${join(process.cwd(), 'dist', 'cli', 'index.js')}" supervisor start`, (err) => {
                    if (err) console.error('Failed to start supervisor:', err.message);
                    refresh();
                  });
                }
                refresh();
              },
            },
            {
              id: 'reviews',
              label: 'View Reviews',
              description: `Tasks pending review (${reviews.length})`,
              onSelect: () => setView('supervisor-reviews'),
            },
            {
              id: 'status',
              label: 'Task Status',
              description: 'View all task session statuses',
              onSelect: () => {
                const states = monitor.checkAllSessions();
                let msg = `STATUS     TASK_ID             SESSION\n`;
                for (const s of states) {
                  const indicator = s.status === 'alive' ? 'RUNNING' : 'DEAD';
                  msg += `${indicator.padEnd(8)} ${s.task_id.padEnd(20)} ${s.tmux_session}\n`;
                }
                // For now just show in a simple alert
              },
            },
          ]}
          onBack={goBack}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>[Esc] Back to main menu</Text>
        </Box>
      </Box>
    );
  }

  // Supervisor Reviews List
  if (view === 'supervisor-reviews') {
    const statusMonitor = new TaskStatusMonitor();
    const tasks = store.listTasks();
    const reviewTasks: Array<{ taskName: string; reason: string; progress: number; path: string }> = [];
    for (const task of tasks) {
      const status = statusMonitor.readStatus(task.path);
      if (status && status.needs_review) {
        reviewTasks.push({
          taskName: task.name,
          reason: status.review_reason || 'needs_review',
          progress: status.progress_percent,
          path: task.path,
        });
      }
    }

    return (
      <Box key="supervisor-reviews" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>REVIEW QUEUE</Text>
        </Box>

        {reviewTasks.length === 0 ? (
          <Box paddingX={1}>
            <Text>No tasks pending review</Text>
          </Box>
        ) : (
          <ListBox
            key={`supervisor-reviews-${refreshKey}`}
            items={reviewTasks.map((r) => ({
              id: r.taskName,
              label: r.taskName,
              description: `${r.reason} (${r.progress}%)`,
              onSelect: () => {
                setSupervisorReviewTaskId(r.taskName);
                setView('supervisor-review');
              },
            }))}
            onBack={() => setView('supervisor')}
          />
        )}

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>[Esc] Back to Supervisor</Text>
        </Box>
      </Box>
    );
  }

  // Supervisor Review Detail
  if (view === 'supervisor-review' && supervisorReviewTaskId) {
    const task = store.getTask(supervisorReviewTaskId);
    if (!task) {
      setView('supervisor-reviews');
      return null;
    }

    const statusMonitor = new TaskStatusMonitor();
    const status = statusMonitor.readStatus(task.path);

    return (
      <Box key="supervisor-review" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>REVIEW: </Text>
          <Text>{supervisorReviewTaskId}</Text>
        </Box>

        <Box paddingX={1} flexDirection="column">
          <Text>Phase: <Text color="cyan">{status?.phase || 'unknown'}</Text></Text>
          <Text>Progress: <Text color="cyan">{status?.progress_percent || 0}%</Text></Text>
          <Text>Reason: <Text color="yellow">{status?.review_reason || 'unknown'}</Text></Text>
          <Text>Errors: {status?.errors.length || 0}</Text>
          {status && status.errors.length > 0 && (
            <Text dimColor>Last error: {status.errors[status.errors.length - 1]?.substring(0, 80)}</Text>
          )}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Actions:</Text>
        </Box>

        <ListBox
          key={`supervisor-review-${refreshKey}`}
          items={[
            {
              id: 'approve',
              label: 'Approve',
              description: 'Continue the task',
              onSelect: () => {
                statusMonitor.clearNeedsReview(task.path);
                refresh();
                setSupervisorReviewTaskId(null);
                setView('supervisor-reviews');
              },
            },
            {
              id: 'reject',
              label: 'Reject',
              description: 'Stop the task',
              onSelect: () => {
                const launcher = new TaskLauncher();
                launcher.stop(supervisorReviewTaskId);
                refresh();
                setSupervisorReviewTaskId(null);
                setView('supervisor-reviews');
              },
            },
          ]}
          onBack={() => setView('supervisor-reviews')}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>[Esc] Back to reviews</Text>
        </Box>
      </Box>
    );
  }

  // Tasks List
  if (view === 'tasks') {
    const tasks = store.listTasks();

    return (
      <Box key="tasks" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>TASKS</Text>
          <Text dimColor> - {tasks.length} task{tasks.length !== 1 ? 's' : ''}</Text>
        </Box>

        <ListBox
          key={`tasks-${refreshKey}`}
          items={[
            {
              id: 'new',
              label: '+ Create New Task',
              description: 'Run: themis new [name]',
              onSelect: () => {
                setView('task-create');
              },
            },
            ...tasks.map((t) => ({
              id: t.name,
              label: t.name,
              description: `[${t.status}] ${t.skills.length} skills, ${Object.values(t.hooks).flat().length} hooks`,
              onSelect: () => {
                setSelectedTaskName(t.name);
                setView('task-detail');
              },
            })),
          ]}
          initialIndex={0}
          onBack={goBack}
        />

        <Box marginTop={1}>
          <Text dimColor>[Esc] Back to main menu</Text>
        </Box>
      </Box>
    );
  }

  // Task Create - Step 1: Enter name
  if (view === 'task-create') {
    return (
      <TaskCreateView
        onSubmit={(name) => {
          setSelectedTaskName(name);
          setView('task-create-current-dir');
        }}
        onCancel={() => setView('tasks')}
      />
    );
  }

  // Task Create - Step 2: Ask about current directory
  if (view === 'task-create-current-dir' && selectedTaskName) {
    return (
      <Box key="task-create-current-dir" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>CREATE TASK</Text>
        </Box>
        <Box paddingX={1} flexDirection="column">
          <Text>Task name: <Text color="cyan">{selectedTaskName}</Text></Text>
          <Text dimColor>Current directory: {workspaceRoot}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text>Create task in current directory?</Text>
        </Box>

        <ListBox
          key={`task-create-current-dir-${refreshKey}`}
          items={[
            {
              id: 'yes',
              label: 'Yes, create here',
              description: 'Create .themis/ marker in current directory',
              onSelect: () => {
                if (store.taskExists(selectedTaskName)) {
                  // Task with this name already exists, error
                  return;
                }
                store.createTask(selectedTaskName, workspaceRoot);
                refresh();
                setSelectedTaskName(null);
                setView('tasks');
              },
            },
            {
              id: 'no',
              label: 'No, choose another location',
              description: 'Exit and cd to desired directory first',
              onSelect: () => {
                setSelectedTaskName(null);
                setView('tasks');
              },
            },
          ]}
        />

        <Box marginTop={1}>
          <Text dimColor>[Esc] Cancel and go back</Text>
        </Box>
      </Box>
    );
  }

  // Task Detail
  if (view === 'task-detail' && selectedTaskName) {
    const task = store.getTask(selectedTaskName);
    if (!task) {
      setView('tasks');
      return null;
    }

    return (
      <Box key="task-detail" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>TASK: </Text>
          <Text>{task.name}</Text>
        </Box>

        <Box paddingX={1} flexDirection="column">
          <Text>Path: <Text dimColor>{task.path}</Text></Text>
          <Text>Status: <Text color="cyan">{task.status}</Text></Text>
          <Text>Skills: {task.skills.length} linked</Text>
          <Text>Hooks: {Object.values(task.hooks).flat().length} linked</Text>
          <Text>Created: {new Date(task.created_at).toLocaleDateString()}</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Actions:</Text>
        </Box>

        <ListBox
          key={`task-detail-${refreshKey}`}
          items={[
            {
              id: 'activate',
              label: task.status === 'in_progress' ? 'Deactivate' : 'Activate',
              description: task.status === 'in_progress' ? 'Stop working' : 'Start working',
              onSelect: () => {
                if (task.status === 'in_progress') {
                  // Deactivate: stop tmux session and update status
                  stopTaskSession(task.name).then(() => {
                    store.updateTask(selectedTaskName, { status: 'paused' });
                    refresh();
                  });
                } else {
                  // Activate: sync resources and launch tmux session
                  store.syncTaskResources(selectedTaskName);
                  // Extract skill and hook IDs from task
                  const skillIds = task.skills.map(s => s.skill);
                  const hookIds = Object.values(task.hooks).flat();
                  // Note: launchTaskSession takes over terminal, status update happens on detach
                  launchTaskSession(task.name, task.path, skillIds, hookIds);
                  // This line is reached after user detaches (Ctrl+B, D)
                  store.updateTask(selectedTaskName, { status: 'in_progress' });
                  refresh();
                }
              },
            },
            ...(task.status === 'in_progress' ? [{
              id: 'attach',
              label: 'Attach',
              description: 'Connect to Claude Code session',
              onSelect: () => {
                const sessionName = `th-task-${task.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                execSync(`tmux attach-session -t "${sessionName}"`, { stdio: 'inherit' });
                refresh();
              },
            }] : []),
            {
              id: 'add-skill',
              label: 'Add Skill',
              description: 'Link a skill to this task',
              onSelect: () => setView('skill-select'),
            },
            {
              id: 'add-hook',
              label: 'Add Hook',
              description: 'Link a hook to this task',
              onSelect: () => setView('hook-select'),
            },
            {
              id: 'delete',
              label: 'Delete Task',
              description: 'This action cannot be undone',
              onSelect: () => setView('task-delete-confirm'),
            },
          ]}
          onBack={() => setView('tasks')}
        />

        <Box marginTop={1}>
          <Text dimColor>[Esc] Back to tasks</Text>
        </Box>
      </Box>
    );
  }

  // Task Delete Confirm
  if (view === 'task-delete-confirm' && selectedTaskName) {
    const task = store.getTask(selectedTaskName);
    if (!task) {
      setView('tasks');
      return null;
    }

    return (
      <ConfirmView
        title="DELETE TASK"
        message={`Delete "${task.name}"? This cannot be undone.`}
        onConfirm={() => {
          store.deleteTask(selectedTaskName);
          refresh();
          setView('tasks');
          setSelectedTaskName(null);
        }}
        onCancel={() => setView('task-detail')}
      />
    );
  }

  // Skill Select - Category Selection (for linking to task)
  if (view === 'skill-select' && selectedTaskName) {
    const categories = globalLibrary.listSkillCategories();

    return (
      <Box key="skill-select" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>ADD SKILL TO TASK</Text>
        </Box>
        <Text dimColor paddingX={1}>Select a category:</Text>

        <ListBox
          key={`skill-select-${refreshKey}`}
          items={categories.map((cat) => ({
            id: cat.name,
            label: cat.name,
            description: `${cat.count} skills`,
            onSelect: () => {
              setSkillCategory(cat.name);
              setSelectSkillSearch('');
              setView('skill-select-category');
            },
          }))}
          onBack={() => setView('task-detail')}
        />

        <Box marginTop={1}>
          <Text dimColor>[Esc] Back to task</Text>
        </Box>
      </Box>
    );
  }

  // Skill Select - Skills in Category
  if (view === 'skill-select-category' && selectedTaskName) {
    const result = globalLibrary.listSkillsByCategory(skillCategory, {
      search: selectSkillSearch || undefined,
      page: selectSkillPage,
      pageSize: 8,
    });
    const task = store.getTask(selectedTaskName);
    const linkedSkillIds = task?.skills.map((s) => s.skill) || [];
    const availableSkills = result.skills.filter((s) => !linkedSkillIds.includes(s.id));

    const handleConfirmAdd = () => {
      if (!task || selectedSkillIds.length === 0) return;
      const updatedSkills = [
        ...task.skills,
        ...selectedSkillIds.map((id) => ({ skill: id, version: '1.0', enabled: true })),
      ];
      store.updateTask(selectedTaskName, { skills: updatedSkills });
      store.syncTaskResources(selectedTaskName);
      setSelectedSkillIds([]);
      refresh();
      setView('task-detail');
    };

    return (
      <Box key="skill-select-category" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>ADD SKILL</Text>
          <Text dimColor> - {skillCategory}</Text>
          {selectSkillSearch && <Text dimColor> (search: "{selectSkillSearch}")</Text>}
        </Box>
        <Text dimColor paddingX={1}>
          {selectedSkillIds.length > 0
            ? `${selectedSkillIds.length} selected - press [Enter] to add`
            : 'Press [Space] to select, [←/→] to page'}
        </Text>

        <ListBox
          key={`skill-select-category-${refreshKey}`}
          items={availableSkills.map((s) => ({
            id: s.id,
            label: s.name,
            description: s.description?.substring(0, 50) || '(no description)',
            onSelect: () => {
              // Single click/tap - just navigate, multi-select handled by space
            },
          }))}
          multiSelect={true}
          selectedIds={selectedSkillIds}
          onToggleSelect={(id) => {
            setSelectedSkillIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            );
          }}
          onConfirm={handleConfirmAdd}
          onBack={() => {
            setSelectSkillPage(1);
            setSelectedSkillIds([]);
            setView('skill-select');
          }}
          onNextPage={() => setSelectSkillPage((p) => Math.min(result.totalPages, p + 1))}
          onPrevPage={() => setSelectSkillPage((p) => Math.max(1, p - 1))}
        />

        <Box marginTop={1} flexDirection="column">
          {result.totalPages > 1 && (
            <Text dimColor>
              Page {result.page}/{result.totalPages} ({result.total} skills) [←/→] page
            </Text>
          )}
          {selectedSkillIds.length > 0 && (
            <Text color="cyan">[Enter] Add selected ({selectedSkillIds.length})</Text>
          )}
          <Text dimColor>[Esc] Back to categories</Text>
        </Box>
      </Box>
    );
  }

  // Hook Select - Type Selection (for linking to task)
  if (view === 'hook-select' && selectedTaskName) {
    const hooksByType = globalLibrary.listHooksByType();
    const hookTypes = Object.keys(hooksByType);

    return (
      <Box key="hook-select" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>ADD HOOK TO TASK</Text>
        </Box>
        <Text dimColor paddingX={1}>Select a hook type:</Text>

        <ListBox
          key={`hook-select-${refreshKey}`}
          items={hookTypes.map((type) => ({
            id: type,
            label: type,
            description: `${hooksByType[type].length} hooks`,
            onSelect: () => {
              setSelectedHookType(type);
              setSelectHookSearch('');
              setView('hook-select-type');
            },
          }))}
          onBack={() => setView('task-detail')}
        />

        <Box marginTop={1}>
          <Text dimColor>[Esc] Back to task</Text>
        </Box>
      </Box>
    );
  }

  // Hook Select - Hooks in Type
  if (view === 'hook-select-type' && selectedTaskName) {
    const result = globalLibrary.listHooksByTypePaginated(selectedHookType, {
      search: selectHookSearch || undefined,
      page: selectHookPage,
      pageSize: 8,
    });
    const task = store.getTask(selectedTaskName);
    const linkedHookIds = Object.values(task?.hooks || {}).flat();
    const availableHooks = result.hooks.filter((h) => !linkedHookIds.includes(h.id));

    const handleConfirmAddHooks = () => {
      if (!task || selectedHookIds.length === 0) return;
      const updatedHooks = { ...task.hooks };
      for (const hookId of selectedHookIds) {
        const hook = availableHooks.find((h) => h.id === hookId);
        if (!hook) continue;
        if (!updatedHooks[hook.type]) {
          updatedHooks[hook.type] = [];
        }
        if (!updatedHooks[hook.type]!.includes(hookId)) {
          updatedHooks[hook.type]!.push(hookId);
        }
      }
      store.updateTask(selectedTaskName, { hooks: updatedHooks });
      store.syncTaskResources(selectedTaskName);
      setSelectedHookIds([]);
      refresh();
      setView('task-detail');
    };

    return (
      <Box key="hook-select-type" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>ADD HOOK</Text>
          <Text dimColor> - {selectedHookType}</Text>
          {selectHookSearch && <Text dimColor> (search: "{selectHookSearch}")</Text>}
        </Box>
        <Text dimColor paddingX={1}>
          {selectedHookIds.length > 0
            ? `${selectedHookIds.length} selected - press [Enter] to add`
            : 'Press [Space] to select, [←/→] to page'}
        </Text>

        <ListBox
          key={`hook-select-type-${refreshKey}`}
          items={availableHooks.map((h) => ({
            id: h.id,
            label: h.name,
            description: h.description?.substring(0, 50) || `[${h.type}] ${h.command}`,
            onSelect: () => {
              // Single click/tap - just navigate, multi-select handled by space
            },
          }))}
          multiSelect={true}
          selectedIds={selectedHookIds}
          onToggleSelect={(id) => {
            setSelectedHookIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            );
          }}
          onConfirm={handleConfirmAddHooks}
          onBack={() => {
            setSelectHookPage(1);
            setSelectedHookIds([]);
            setView('hook-select');
          }}
          onNextPage={() => setSelectHookPage((p) => Math.min(result.totalPages, p + 1))}
          onPrevPage={() => setSelectHookPage((p) => Math.max(1, p - 1))}
        />

        <Box marginTop={1} flexDirection="column">
          {result.totalPages > 1 && (
            <Text dimColor>
              Page {result.page}/{result.totalPages} ({result.total} hooks) [←/→] page
            </Text>
          )}
          {selectedHookIds.length > 0 && (
            <Text color="cyan">[Enter] Add selected ({selectedHookIds.length})</Text>
          )}
          <Text dimColor>[Esc] Back to types</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text>Loading...</Text>
    </Box>
  );
}

// Confirm Dialog Component - uses ListBox
function ConfirmView({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="bold" padding={1} marginBottom={1}>
        <Text bold color="red">{title}</Text>
      </Box>
      <Box padding={1}>
        <Text>{message}</Text>
      </Box>

      <ListBox
        items={[
          {
            id: 'cancel',
            label: 'Cancel',
            description: 'Go back without changes',
            onSelect: onCancel,
          },
          {
            id: 'confirm',
            label: 'Confirm',
            description: 'Proceed with action',
            onSelect: onConfirm,
          },
        ]}
        onBack={onCancel}
      />

      <Box marginTop={1} paddingX={1}>
        <Text dimColor>[↑↓] Navigate  [Enter] Select  [Esc] Cancel</Text>
      </Box>
    </Box>
  );
}

// Task Create Form Component
function TaskCreateView({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    const handleData = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      if (data === '\u0003') {
        onCancel();
        return;
      }
      if (data === '\u001b' || data === 'q' || data === 'Q') {
        onCancel();
      } else if (data === '\r' || data === '\n') {
        if (name.trim()) {
          onSubmit(name.trim());
        }
      } else if (data === '\b' || data === '\u007f') {
        setName((n) => n.slice(0, -1));
      } else if (data.length === 1 && !data.match(/\s/)) {
        setName((n) => n + data);
      }
    };

    try {
      process.stdin.setRawMode?.(true);
      process.stdin.resume?.();
      process.stdin.on?.('data', handleData);
    } catch {
      // Raw mode not supported
    }

    return () => {
      try {
        process.stdin.removeListener?.('data', handleData);
        process.stdin.setRawMode?.(false);
      } catch {
        // Ignore
      }
    };
  }, [name, onSubmit, onCancel]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="bold" padding={1} marginBottom={1}>
        <Text bold>CREATE TASK</Text>
      </Box>
      <Box padding={1} flexDirection="column">
        <Text>Enter task name:</Text>
        <Box marginTop={1}>
          <Text color="cyan">{name}</Text>
          <Text color="cyan">_</Text>
        </Box>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>Type name and press [Enter] to create</Text>
        <Text dimColor>[q/Esc] cancel</Text>
      </Box>
    </Box>
  );
}

