import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { LibraryStore, Skill } from '../../library/store.js';
import { TaskStore } from '../../task/store.js';

interface SkillCommandProps {
  library: LibraryStore | null;
  store: TaskStore | null;
  args: Record<string, unknown>;
}

export function SkillAddCommand({ library, args }: SkillCommandProps) {
  const [result, setResult] = useState<{ success: boolean; skill?: Skill; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!library) {
      setResult({ success: false, error: 'Not in a workspace' });
      return;
    }

    const name = args._[2] as string | undefined;
    if (!name) {
      setResult({ success: false, error: 'Usage: th skill add <name>' });
      return;
    }

    try {
      const skill = library.createSkill({
        name,
        description: (args.description || args.d) as string | undefined,
      });
      setResult({ success: true, skill });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [library, args]);

  if (result.error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {result.error}
        </Text>
      </Box>
    );
  }

  if (!result.skill) {
    return (
      <Box padding={1}>
        <Text dimColor>Creating skill...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓</Text>
        <Text> Created skill </Text>
        <Text color="cyan">{result.skill.id}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text>Name: {result.skill.name}</Text>
        <Text dimColor>File: library/skills/{result.skill.id}.yaml</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Edit the skill file to add triggers, commands, and content.</Text>
      </Box>
    </Box>
  );
}

export function SkillListCommand({ library }: { library: LibraryStore | null }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!library) {
      setError('Not in a workspace');
      return;
    }

    try {
      setSkills(library.listSkills());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [library]);

  if (error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Skills</Text>
      {skills.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No skills yet. Run 'th skill add [name]' to create one.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {skills.map((skill) => (
            <Box key={skill.id} marginBottom={1}>
              <Text color="cyan" width={20}>
                {skill.id}
              </Text>
              <Text>{skill.description || '(no description)'}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function SkillLinkCommand({
  library,
  store,
  args,
}: {
  library: LibraryStore | null;
  store: TaskStore | null;
  args: Record<string, unknown>;
}) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!library || !store) {
      setResult({ success: false, error: 'Not in a workspace' });
      return;
    }

    const skillId = args._[2] as string | undefined;
    const taskId = (args._[3] as string | undefined) || store.getConfig().active_task;

    if (!skillId) {
      setResult({ success: false, error: 'Usage: th skill link <skill-id> [task-id]' });
      return;
    }

    if (!taskId) {
      setResult({ success: false, error: 'No active task. Specify task-id or activate a task first.' });
      return;
    }

    try {
      const skill = library.getSkill(skillId);
      if (!skill) {
        setResult({ success: false, error: `Skill not found: ${skillId}` });
        return;
      }

      const task = store.getTask(taskId);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskId}` });
        return;
      }

      // Add skill to task
      const updatedSkills = [
        ...task.skills.filter((s) => s.skill !== skillId),
        { skill: skillId, version: '1.0', enabled: true },
      ];

      store.updateTask(taskId, { skills: updatedSkills });
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [library, store, args]);

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
        <Text> Linked skill to task</Text>
      </Box>
    </Box>
  );
}

export function SkillUnlinkCommand({
  library,
  store,
  args,
}: {
  library: LibraryStore | null;
  store: TaskStore | null;
  args: Record<string, unknown>;
}) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!library || !store) {
      setResult({ success: false, error: 'Not in a workspace' });
      return;
    }

    const skillId = args._[2] as string | undefined;
    const taskId = (args._[3] as string | undefined) || store.getConfig().active_task;

    if (!skillId) {
      setResult({ success: false, error: 'Usage: th skill unlink <skill-id> [task-id]' });
      return;
    }

    if (!taskId) {
      setResult({ success: false, error: 'No active task. Specify task-id or activate a task first.' });
      return;
    }

    try {
      const task = store.getTask(taskId);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskId}` });
        return;
      }

      // Remove skill from task
      const updatedSkills = task.skills.filter((s) => s.skill !== skillId);
      store.updateTask(taskId, { skills: updatedSkills });
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [library, store, args]);

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
        <Text> Unlinked skill from task</Text>
      </Box>
    </Box>
  );
}
