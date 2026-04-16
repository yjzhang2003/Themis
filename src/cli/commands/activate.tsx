import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { TaskStore } from '../../task/store.js';
import { LibraryStore, Skill, Hook } from '../../library/store.js';
import { writeFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { join } from 'path';

interface ActivateCommandProps {
  store: TaskStore | null;
  library: LibraryStore | null;
  args: Record<string, unknown>;
}

export function ActivateCommand({ store, library, args }: ActivateCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!store) {
      setResult({ success: false, error: 'Not in a workspace. Run th init first.' });
      return;
    }

    const taskId = args._[1] as string | undefined;
    if (!taskId) {
      setResult({ success: false, error: 'Usage: th activate <task-id>' });
      return;
    }

    try {
      const task = store.getTask(taskId);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskId}` });
        return;
      }

      const taskDir = join(store.getConfig().workspace_root, 'tasks', taskId);
      const claudeDir = join(taskDir, '.claude');
      const settingsPath = join(claudeDir, 'settings.json');

      // Ensure .claude directory exists
      mkdirSync(claudeDir, { recursive: true });

      // Create skills directory
      const skillsDir = join(claudeDir, 'skills');
      mkdirSync(skillsDir, { recursive: true });

      // Create rules directory
      const rulesDir = join(claudeDir, 'rules');
      mkdirSync(rulesDir, { recursive: true });

      // Copy linked skills to task's .claude/skills/
      for (const taskSkill of task.skills) {
        const skill = library?.getSkill(taskSkill.skill);
        if (skill) {
          const skillDest = join(skillsDir, `${skill.id}.md`);
          writeFileSync(skillDest, skill.content, 'utf-8');
        }
      }

      // Generate settings.json with hooks
      const hooks: Hook[] = [];
      for (const hookId of Object.values(task.hooks).flat()) {
        const hook = library?.getHook(hookId);
        if (hook) {
          hooks.push(hook);
        }
      }

      const settings = generateSettings(hooks);
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

      // Set active task
      store.setActiveTask(taskId);
      store.updateTask(taskId, { status: 'in_progress' });

      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [store, library, args]);

  if (result.error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {result.error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓</Text>
        <Text> Activated task</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>The task's .claude/ directory is ready with:</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        <Text dimColor>- settings.json (with hooks)</Text>
        <Text dimColor>- skills/ (linked skills)</Text>
        <Text dimColor>- rules/ (task rules)</Text>
      </Box>
    </Box>
  );
}

function generateSettings(hooks: Hook[]): {
  hooks: {
    PreToolUse?: Array<{ matcher: string; command: string; description: string }>;
    PostToolUse?: Array<{ matcher: string; command: string; description: string }>;
    Stop?: Array<{ command: string; description: string }>;
  };
} {
  const settings: ReturnType<typeof generateSettings> = { hooks: {} };

  for (const hook of hooks) {
    if (!settings.hooks[hook.type]) {
      settings.hooks[hook.type] = [];
    }
    settings.hooks[hook.type]!.push({
      matcher: hook.matcher,
      command: hook.command,
      description: hook.description,
    });
  }

  return settings;
}
