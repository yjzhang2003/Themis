import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import { join } from 'path';
import { exec } from 'child_process';
import { TaskStore } from '../../task/store.js';
import { GlobalLibraryStore } from '../../global-library/index.js';
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
  | 'back-confirm';

interface InteractiveAppProps {
  store: TaskStore;
  onQuit: () => void;
}

// Shell escape for single-quote context
function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

// Helper: Launch Claude Code in tmux for a task
function launchTaskSession(taskName: string, taskPath: string): Promise<void> {
  return new Promise((resolve) => {
    const sessionName = `th-task-${taskName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const safePath = shellEscape(taskPath);

    // Kill existing session if it exists
    exec(`tmux kill-session -t "${sessionName}" 2>/dev/null || true`, () => {
      // Create new tmux session and launch Claude Code
      const cmd = `tmux new-session -d -s "${sessionName}" -c '${safePath}' 'claude --work-dir '${safePath}'' 2>&1`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`Failed to launch task session: ${error.message}`);
          resolve();
          return;
        }
        if (stderr) {
          console.error(`tmux stderr: ${stderr}`);
        }
        console.log(`Task session "${taskName}" started in tmux session: ${sessionName}`);
        resolve();
      });
    });
  });
}

// Helper: Stop a task session
function stopTaskSession(taskName: string): Promise<void> {
  return new Promise((resolve) => {
    const sessionName = `th-task-${taskName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    exec(`tmux kill-session -t "${sessionName}" 2>/dev/null || true`, (error) => {
      if (error) {
        console.error(`Failed to stop task session: ${error.message}`);
      }
      resolve();
    });
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
          <Text bold>TASK HARNESS</Text>
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
          ]}
          onBack={onQuit}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Commands: tharness new</Text>
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
    const result = globalLibrary.listSkillsByCategory(skillCategory);

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
          onBack={() => setView('global-skills')}
        />

        <Box marginTop={1} flexDirection="column">
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
              description: 'Run: tharness new [name]',
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
              description: 'Create .tharness/ marker in current directory',
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
                  launchTaskSession(task.name, task.path).then(() => {
                    store.updateTask(selectedTaskName, { status: 'in_progress' });
                    refresh();
                  });
                }
              },
            },
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

    return (
      <Box key="skill-select-category" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>ADD SKILL</Text>
          <Text dimColor> - {skillCategory}</Text>
          {selectSkillSearch && <Text dimColor> (search: "{selectSkillSearch}")</Text>}
        </Box>
        <Text dimColor paddingX={1}>Select a skill to link:</Text>

        <ListBox
          key={`skill-select-category-${refreshKey}`}
          items={result.skills
            .filter((s) => !linkedSkillIds.includes(s.id))
            .map((s) => ({
              id: s.id,
              label: s.name,
              description: s.description?.substring(0, 50) || '(no description)',
              onSelect: () => {
                if (!task) return;
                const updatedSkills = [
                  ...task.skills,
                  { skill: s.id, version: '1.0', enabled: true },
                ];
                store.updateTask(selectedTaskName, { skills: updatedSkills });
                refresh();
                setView('task-detail');
              },
            }))}
          onBack={() => {
            setSelectSkillPage(1);
            setView('skill-select');
          }}
          onNextPage={() => setSelectSkillPage((p) => Math.min(result.totalPages, p + 1))}
          onPrevPage={() => setSelectSkillPage((p) => Math.max(1, p - 1))}
        />

        <Box marginTop={1} flexDirection="column">
          {result.totalPages > 1 && (
            <Text dimColor>
              Page {result.page}/{result.totalPages} ({result.total} skills) [n/p] page
            </Text>
          )}
          <Text dimColor>[b] Back to categories</Text>
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

    return (
      <Box key="hook-select-type" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>ADD HOOK</Text>
          <Text dimColor> - {selectedHookType}</Text>
          {selectHookSearch && <Text dimColor> (search: "{selectHookSearch}")</Text>}
        </Box>
        <Text dimColor paddingX={1}>Select a hook to link:</Text>

        <ListBox
          key={`hook-select-type-${refreshKey}`}
          items={result.hooks
            .filter((h) => !linkedHookIds.includes(h.id))
            .map((h) => ({
              id: h.id,
              label: h.name,
              description: h.description?.substring(0, 50) || `[${h.type}] ${h.command}`,
              onSelect: () => {
                if (!task) return;
                const updatedHooks = { ...task.hooks };
                if (!updatedHooks[h.type]) {
                  updatedHooks[h.type] = [];
                }
                if (!updatedHooks[h.type]!.includes(h.id)) {
                  updatedHooks[h.type]!.push(h.id);
                }
                store.updateTask(selectedTaskName, { hooks: updatedHooks });
                refresh();
                setView('task-detail');
              },
            }))}
          onBack={() => {
            setSelectHookPage(1);
            setView('hook-select');
          }}
          onNextPage={() => setSelectHookPage((p) => Math.min(result.totalPages, p + 1))}
          onPrevPage={() => setSelectHookPage((p) => Math.max(1, p - 1))}
        />

        <Box marginTop={1} flexDirection="column">
          {result.totalPages > 1 && (
            <Text dimColor>
              Page {result.page}/{result.totalPages} ({result.total} hooks) [n/p] page
            </Text>
          )}
          <Text dimColor>[b] Back to types</Text>
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

