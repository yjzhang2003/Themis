import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';
import { LibraryStore } from '../../library/store.js';
import { Menu, MenuItem } from './menu.js';

type View = 'main' | 'tasks' | 'task-detail' | 'skills' | 'hooks';

interface InteractiveAppProps {
  store: TaskStore;
  library: LibraryStore;
  onQuit: () => void;
}

export function InteractiveApp({ store, library, onQuit }: InteractiveAppProps) {
  const [view, setView] = useState<View>('main');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const goBack = useCallback(() => {
    switch (view) {
      case 'tasks':
      case 'skills':
      case 'hooks':
        setView('main');
        break;
      case 'task-detail':
        setView('tasks');
        setSelectedTaskId(null);
        break;
      default:
        setView('main');
    }
  }, [view]);

  // Main Menu
  if (view === 'main') {
    const tasks = store.listTasks();
    const items: MenuItem[] = [
      {
        id: 'tasks',
        label: 'Tasks',
        description: `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`,
      },
      {
        id: 'skills',
        label: 'Skills',
        description: `${library.listSkills().length} skill${library.listSkills().length !== 1 ? 's' : ''}`,
      },
      {
        id: 'hooks',
        label: 'Hooks',
        description: `${library.listHooks().length} hook${library.listHooks().length !== 1 ? 's' : ''}`,
      },
    ];

    return (
      <Menu
        title="TASK HARNESS"
        items={items}
        onSelect={(item) => {
          if (item.id === 'tasks') {
            setView('tasks');
          } else if (item.id === 'skills') {
            setView('skills');
          } else if (item.id === 'hooks') {
            setView('hooks');
          }
        }}
        onBack={goBack}
        onQuit={onQuit}
      />
    );
  }

  // Tasks List
  if (view === 'tasks') {
    const tasks = store.listTasks();
    const items: MenuItem[] = [
      {
        id: 'info',
        label: '(Use command mode: th new <name>)',
      },
      ...tasks.map((t) => ({
        id: t.id,
        label: `${t.name}`,
        description: `[${t.status}]`,
      })),
    ];

    return (
      <Menu
        title="TASKS"
        items={items}
        onSelect={(item) => {
          if (!item.id.startsWith('task-')) return;
          setSelectedTaskId(item.id);
          setView('task-detail');
        }}
        onBack={goBack}
        onQuit={onQuit}
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

    const items: MenuItem[] = [
      {
        id: 'status',
        label: `Status: ${task.status}`,
      },
      {
        id: 'skills-count',
        label: `Skills: ${task.skills.length} linked`,
      },
      {
        id: 'hooks-count',
        label: `Hooks: ${Object.values(task.hooks).flat().length} linked`,
      },
      {
        id: 'info-activate',
        label: '(Use command mode: th activate)',
      },
    ];

    return (
      <Menu
        title={`${task.id.toUpperCase()}: ${task.name}`}
        items={items}
        onSelect={() => {}}
        onBack={goBack}
        onQuit={onQuit}
      />
    );
  }

  // Skills List
  if (view === 'skills') {
    const skills = library.listSkills();
    const items: MenuItem[] = [
      {
        id: 'info',
        label: '(Use command mode: th skill add <name>)',
      },
      ...skills.map((s) => ({
        id: s.id,
        label: s.name,
        description: s.description || '(no description)',
      })),
    ];

    return (
      <Menu
        title="SKILLS"
        items={items}
        onSelect={() => {}}
        onBack={goBack}
        onQuit={onQuit}
      />
    );
  }

  // Hooks List
  if (view === 'hooks') {
    const hooks = library.listHooks();
    const items: MenuItem[] = [
      {
        id: 'info',
        label: '(Use command mode: th hook add <name> <type>)',
      },
      ...hooks.map((h) => ({
        id: h.id,
        label: h.name,
        description: `[${h.type}] ${h.command}`,
      })),
    ];

    return (
      <Menu
        title="HOOKS"
        items={items}
        onSelect={() => {}}
        onBack={goBack}
        onQuit={onQuit}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text>Loading...</Text>
    </Box>
  );
}
