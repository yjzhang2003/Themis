import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';
import { LibraryStore, Skill, Hook } from '../../library/store.js';
import { ListBox } from './listbox.js';
import { Menu, MenuItem } from './menu.js';

type View =
  | 'main'
  | 'tasks'
  | 'task-detail'
  | 'task-create'
  | 'task-delete-confirm'
  | 'skills'
  | 'skill-categories'
  | 'skill-list'
  | 'skill-create'
  | 'skill-select'
  | 'hooks'
  | 'hook-create'
  | 'hook-select'
  | 'back-confirm';

interface InteractiveAppProps {
  store: TaskStore;
  library: LibraryStore;
  onQuit: () => void;
}

export function InteractiveApp({ store, library, onQuit }: InteractiveAppProps) {
  const [view, setView] = useState<View>('main');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [skillCategory, setSkillCategory] = useState<string>('all');
  const [skillPage, setSkillPage] = useState(1);
  const [skillSearch, setSkillSearch] = useState('');

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Clear terminal on view change to prevent stacking
  useEffect(() => {
    // Move cursor to top-left and clear from cursor to end of screen
    process.stdout.write('\x1b[H\x1b[J');
  }, [view]);

  const goBack = useCallback(() => {
    setView('main');
    setSelectedTaskId(null);
    setSelectedSkillId(null);
    setSelectedHookId(null);
    setSkillCategory('all');
    setSkillPage(1);
    setSkillSearch('');
  }, []);

  // Main Menu
  if (view === 'main') {
    const tasks = store.listTasks();
    const skillCategories = library.listCategories();
    const totalSkills = skillCategories.reduce((sum, c) => sum + c.count, 0);
    const hooks = library.listHooks();

    return (
      <Box key="main" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>TASK HARNESS</Text>
        </Box>

        <ListBox
          key={`main-${refreshKey}`}
          items={[
            {
              id: 'tasks',
              label: 'Tasks',
              description: `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`,
              onSelect: () => setView('tasks'),
            },
            {
              id: 'skills',
              label: 'Skills',
              description: `${skillCategories.length} categories, ${totalSkills} skills`,
              onSelect: () => setView('skills'),
            },
            {
              id: 'hooks',
              label: 'Hooks',
              description: `${hooks.length} hook${hooks.length !== 1 ? 's' : ''}`,
              onSelect: () => setView('hooks'),
            },
          ]}
          onBack={onQuit}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Commands: th new, th skill add, th hook add</Text>
          <Text dimColor>[q] Quit</Text>
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
              description: 'Run: th new [name]',
              onSelect: () => setView('task-create'),
            },
            ...tasks.map((t) => ({
              id: t.id,
              label: `${t.name}`,
              description: `[${t.status}] ${t.skills.length} skills, ${Object.values(t.hooks).flat().length} hooks`,
              onSelect: () => {
                setSelectedTaskId(t.id);
                setView('task-detail');
              },
            })),
          ]}
          onBack={goBack}
        />

        <Box marginTop={1}>
          <Text dimColor>[Esc] Back to main menu</Text>
        </Box>
      </Box>
    );
  }

  // Task Create
  if (view === 'task-create') {
    return (
      <TaskCreateView
        onSubmit={(name) => {
          store.createTask(name);
          refresh();
          setView('tasks');
        }}
        onCancel={() => setView('tasks')}
      />
    );
  }

  // Task Detail
  if (view === 'task-detail' && selectedTaskId) {
    const task = store.getTask(selectedTaskId);
    if (!task) {
      setView('tasks');
      return null;
    }

    return (
      <Box key="task-detail" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>{task.id.toUpperCase()}: </Text>
          <Text>{task.name}</Text>
        </Box>

        <Box paddingX={1} flexDirection="column">
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
                store.updateTask(selectedTaskId, {
                  status: task.status === 'in_progress' ? 'paused' : 'in_progress',
                });
                refresh();
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
  if (view === 'task-delete-confirm' && selectedTaskId) {
    const task = store.getTask(selectedTaskId);
    if (!task) {
      setView('tasks');
      return null;
    }

    return (
      <ConfirmView
        title="DELETE TASK"
        message={`Delete "${task.name}"? This cannot be undone.`}
        onConfirm={() => {
          store.deleteTask(selectedTaskId);
          refresh();
          setView('tasks');
          setSelectedTaskId(null);
        }}
        onCancel={() => setView('task-detail')}
      />
    );
  }

  // Skills - show categories first
  if (view === 'skills') {
    const categories = library.listCategories();
    const totalSkills = categories.reduce((sum, c) => sum + c.count, 0);

    return (
      <Box key="skills" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>SKILLS</Text>
          <Text dimColor> - {categories.length} categories, {totalSkills} skills</Text>
        </Box>

        <ListBox
          key={`skills-${refreshKey}`}
          items={[
            {
              id: 'new',
              label: '+ Create New Skill',
              description: 'Run: th skill add [name]',
              onSelect: () => setView('skill-create'),
            },
            ...categories.map((cat) => ({
              id: cat.name,
              label: cat.name,
              description: `${cat.count} skill${cat.count !== 1 ? 's' : ''}`,
              onSelect: () => {
                setSkillCategory(cat.name);
                setSkillPage(1);
                setSkillSearch('');
                setView('skill-list');
              },
            })),
          ]}
          onBack={goBack}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Skill files stored in: library/skills/</Text>
          <Text dimColor>[Esc] Back to main menu</Text>
        </Box>
      </Box>
    );
  }

  // Skill List - skills within a category
  if (view === 'skill-list') {
    const result = library.listSkillsByCategory(skillCategory, {
      search: skillSearch || undefined,
      page: skillPage,
      pageSize: 8,
    });

    return (
      <Box key="skill-list" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>SKILLS</Text>
          <Text dimColor> - {skillCategory}</Text>
          {skillSearch && <Text dimColor> (search: "{skillSearch}")</Text>}
        </Box>

        <ListBox
          key={`skill-list-${refreshKey}`}
          items={[
            ...result.skills.map((s) => ({
              id: s.id,
              label: s.name,
              description: s.description || '(no description)',
              onSelect: () => {
                setSelectedSkillId(s.id);
              },
            })),
          ]}
          onBack={() => setView('skills')}
          onNextPage={() => setSkillPage((p) => Math.min(result.totalPages, p + 1))}
          onPrevPage={() => setSkillPage((p) => Math.max(1, p - 1))}
        />

        <Box marginTop={1} flexDirection="column">
          {result.totalPages > 1 && (
            <Text dimColor>
              Page {result.page}/{result.totalPages} ({result.total} skills) [n/p] page
            </Text>
          )}
          <Text dimColor>[←] Back to categories [Esc] Main menu</Text>
        </Box>
      </Box>
    );
  }

  // Skill Create
  if (view === 'skill-create') {
    return (
      <SkillCreateView
        onSubmit={(name, description) => {
          library.createSkill({ name, description });
          refresh();
          setView('skills');
        }}
        onCancel={() => setView('skills')}
      />
    );
  }

  // Skill Select (for linking to task)
  if (view === 'skill-select' && selectedTaskId) {
    const skills = library.listSkills();
    const task = store.getTask(selectedTaskId);
    const linkedSkillIds = task?.skills.map((s) => s.skill) || [];

    return (
      <Box key="skill-select" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>ADD SKILL TO TASK</Text>
        </Box>
        <Text dimColor paddingX={1}>Select a skill to link:</Text>

        <ListBox
          key={`skill-select-${refreshKey}`}
          items={skills
            .filter((s) => !linkedSkillIds.includes(s.id))
            .map((s) => ({
              id: s.id,
              label: s.name,
              description: s.description || '(no description)',
              onSelect: () => {
                if (!task) return;
                const updatedSkills = [
                  ...task.skills,
                  { skill: s.id, version: '1.0', enabled: true },
                ];
                store.updateTask(selectedTaskId, { skills: updatedSkills });
                refresh();
                setView('task-detail');
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

  // Hooks List
  if (view === 'hooks') {
    const hooks = library.listHooks();

    return (
      <Box key="hooks" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>HOOKS</Text>
          <Text dimColor> - {hooks.length} hook{hooks.length !== 1 ? 's' : ''}</Text>
        </Box>

        <ListBox
          key={`hooks-${refreshKey}`}
          items={[
            {
              id: 'new',
              label: '+ Create New Hook',
              description: 'Run: th hook add [name] [type]',
              onSelect: () => setView('hook-create'),
            },
            ...hooks.map((h) => ({
              id: h.id,
              label: h.name,
              description: `[${h.type}] ${h.command}`,
              onSelect: () => {
                setSelectedHookId(h.id);
              },
            })),
          ]}
          onBack={goBack}
        />

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Hook files stored in: library/hooks/</Text>
          <Text dimColor>[Esc] Back to main menu</Text>
        </Box>
      </Box>
    );
  }

  // Hook Create
  if (view === 'hook-create') {
    return (
      <HookCreateView
        onSubmit={(name, type, command, matcher) => {
          library.createHook({ name, type, command, matcher });
          refresh();
          setView('hooks');
        }}
        onCancel={() => setView('hooks')}
      />
    );
  }

  // Hook Select (for linking to task)
  if (view === 'hook-select' && selectedTaskId) {
    const hooks = library.listHooks();
    const task = store.getTask(selectedTaskId);
    const linkedHookIds = Object.values(task?.hooks || {}).flat();

    return (
      <Box key="hook-select" flexDirection="column" flexGrow={1}>
        <Box borderStyle="bold" padding={1} marginBottom={1}>
          <Text bold>ADD HOOK TO TASK</Text>
        </Box>
        <Text dimColor paddingX={1}>Select a hook to link:</Text>

        <ListBox
          key={`hook-select-${refreshKey}`}
          items={hooks
            .filter((h) => !linkedHookIds.includes(h.id))
            .map((h) => ({
              id: h.id,
              label: h.name,
              description: `[${h.type}] ${h.command}`,
              onSelect: () => {
                if (!task) return;
                const updatedHooks = { ...task.hooks };
                if (!updatedHooks[h.type]) {
                  updatedHooks[h.type] = [];
                }
                if (!updatedHooks[h.type]!.includes(h.id)) {
                  updatedHooks[h.type]!.push(h.id);
                }
                store.updateTask(selectedTaskId, { hooks: updatedHooks });
                refresh();
                setView('task-detail');
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

  return (
    <Box flexDirection="column" padding={1}>
      <Text>Loading...</Text>
    </Box>
  );
}

// Confirm Dialog Component
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
  const [selected, setSelected] = useState(0); // 0 = Cancel, 1 = Confirm

  useEffect(() => {
    const handleData = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      const key = data.trim();
      if (key === '\u0003') {
        onCancel();
        return;
      }
      if (key === 'y' || key === 'Y' || key === '1') {
        setSelected(1);
      } else if (key === 'n' || key === 'N' || key === '0') {
        setSelected(0);
      } else if (key === '\r' || key === '\n') {
        if (selected === 1) {
          onConfirm();
        } else {
          onCancel();
        }
      } else if (key === '\u001b' || key === 'q' || key === 'Q') {
        onCancel();
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
  }, [selected, onConfirm, onCancel]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="bold" padding={1} marginBottom={1}>
        <Text bold color="red">{title}</Text>
      </Box>
      <Box padding={1}>
        <Text>{message}</Text>
      </Box>
      <Box padding={1}>
        <Text>
          <Text color={selected === 0 ? 'cyan' : undefined}>[{selected === 0 ? '●' : ' '}] No, cancel  </Text>
          <Text color={selected === 1 ? 'cyan' : undefined}>[{selected === 1 ? '●' : ' '}] Yes, delete</Text>
        </Text>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>[y/n] or [0/1] to select  [Enter] confirm  [q/Esc] cancel</Text>
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
      const key = data.trim();
      if (s === '\u0003') {
        onCancel();
        return;
      }
      if (key === '\u001b' || key === 'q' || key === 'Q') {
        onCancel();
      } else if (key === '\r' || key === '\n') {
        if (name.trim()) {
          onSubmit(name.trim());
        }
      } else if (key === '\b' || key === '\u007f') {
        setName((n) => n.slice(0, -1));
      } else if (key.length === 1) {
        setName((n) => n + key);
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

// Skill Create Form Component
function SkillCreateView({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0); // 0 = name, 1 = description
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const handleData = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      const key = data.trim();
      if (s === '\u0003') {
        onCancel();
        return;
      }
      if (key === '\u001b' || key === 'q' || key === 'Q') {
        if (step === 0) {
          onCancel();
        } else {
          setStep(0);
          setName('');
          setDescription('');
        }
      } else if (key === '\r' || key === '\n') {
        if (step === 0 && name.trim()) {
          setStep(1);
        } else if (step === 1) {
          onSubmit(name.trim(), description.trim());
        }
      } else if (key === '\b' || key === '\u007f') {
        if (step === 0) {
          setName((n) => n.slice(0, -1));
        } else {
          setDescription((d) => d.slice(0, -1));
        }
      } else if (key.length === 1) {
        if (step === 0) {
          setName((n) => n + key);
        } else {
          setDescription((d) => d + key);
        }
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
  }, [step, name, description, onSubmit, onCancel]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="bold" padding={1} marginBottom={1}>
        <Text bold>CREATE SKILL</Text>
      </Box>
      <Box padding={1} flexDirection="column">
        <Text>Enter skill name:</Text>
        <Box marginTop={1}>
          <Text color="cyan">{name}</Text>
          <Text color="cyan">_</Text>
        </Box>
        {step === 1 && (
          <>
            <Text marginTop={1}>Enter description (optional):</Text>
            <Box marginTop={1}>
              <Text color="cyan">{description}</Text>
              <Text color="cyan">_</Text>
            </Box>
          </>
        )}
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>
          {step === 0
            ? '[Enter] next  [q/Esc] cancel'
            : '[Enter] create  [Esc] back'}
        </Text>
      </Box>
    </Box>
  );
}

// Hook Create Form Component
function HookCreateView({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, type: string, command: string, matcher: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [type, setType] = useState('PostToolUse');
  const [command, setCommand] = useState('');
  const [matcher, setMatcher] = useState('.*');

  const types = ['PreToolUse', 'PostToolUse', 'Stop'];

  useEffect(() => {
    const handleData = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      const key = data.trim();
      if (s === '\u0003') {
        onCancel();
        return;
      }
      if (key === '\u001b' || key === 'q' || key === 'Q') {
        if (step === 0) {
          onCancel();
        } else {
          setStep((s) => s - 1);
        }
      } else if (key === '\r' || key === '\n') {
        if (step === 0 && name.trim()) {
          setStep(1);
        } else if (step === 1) {
          setStep(2);
        } else if (step === 2 && command.trim()) {
          setStep(3);
        } else if (step === 3) {
          onSubmit(name.trim(), type, command.trim(), matcher.trim() || '.*');
        }
      } else if (key === '\b' || key === '\u007f') {
        if (step === 0) setName((n) => n.slice(0, -1));
        else if (step === 2) setCommand((c) => c.slice(0, -1));
        else if (step === 3) setMatcher((m) => m.slice(0, -1));
      } else if (key.length === 1) {
        if (step === 0) setName((n) => n + key);
        else if (step === 2) setCommand((c) => c + key);
        else if (step === 3) setMatcher((m) => m + key);
      } else if (step === 1 && (key === '\u001b[C' || key === 'l')) {
        // Right arrow - cycle through types
        const idx = types.indexOf(type);
        setType(types[(idx + 1) % types.length]);
      } else if (step === 1 && (key === '\u001b[D' || key === 'h')) {
        // Left arrow - cycle backwards
        const idx = types.indexOf(type);
        setType(types[(idx - 1 + types.length) % types.length]);
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
  }, [step, name, type, command, matcher, onSubmit, onCancel]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="bold" padding={1} marginBottom={1}>
        <Text bold>CREATE HOOK</Text>
      </Box>
      <Box padding={1} flexDirection="column">
        {step === 0 && (
          <>
            <Text>Enter hook name:</Text>
            <Box marginTop={1}>
              <Text color="cyan">{name}</Text>
              <Text color="cyan">_</Text>
            </Box>
          </>
        )}
        {step === 1 && (
          <>
            <Text>Select hook type:</Text>
            <Box marginTop={1}>
              <Text color="cyan">{type}</Text>
            </Box>
            <Text dimColor marginTop={1}>[←→] or [h/l] to change type</Text>
          </>
        )}
        {step === 2 && (
          <>
            <Text>Enter command:</Text>
            <Box marginTop={1}>
              <Text color="cyan">{command}</Text>
              <Text color="cyan">_</Text>
            </Box>
          </>
        )}
        {step === 3 && (
          <>
            <Text>Enter matcher regex (optional):</Text>
            <Box marginTop={1}>
              <Text color="cyan">{matcher}</Text>
              <Text color="cyan">_</Text>
            </Box>
          </>
        )}
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>
          {step === 0 && '[Enter] next  [q/Esc] cancel'}
          {step === 1 && '[←→] change type  [Enter] next'}
          {step === 2 && '[Enter] next  [Esc] back'}
          {step === 3 && '[Enter] create  [Esc] back'}
        </Text>
      </Box>
    </Box>
  );
}
