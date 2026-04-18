import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { GlobalLibraryStore, GlobalSkill } from '../../global-library/store.js';
import { TaskStore } from '../../task/store.js';

interface SkillCommandProps {
  store: TaskStore | null;
  args: Record<string, unknown>;
}

export function SkillAddCommand({ args }: SkillCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    const globalLib = new GlobalLibraryStore();
    globalLib.ensureDirectories();

    const name = args._[2] as string | undefined;
    if (!name) {
      setResult({ success: false, error: 'Usage: themis global skill add <source-path>' });
      return;
    }

    try {
      const sourcePath = name; // The name is actually the source path
      const skill = globalLib.installSkill(sourcePath);
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [args]);

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
        <Text> Skill installed to global library</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Skills are stored in ~/.claude/skills/</Text>
      </Box>
    </Box>
  );
}

export function SkillListCommand({ args }: SkillCommandProps) {
  const [output, setOutput] = useState<{ categories?: { name: string; count: number }[]; skills?: GlobalSkill[]; pagination?: { page: number; totalPages: number; total: number }; error?: string }>({});

  useEffect(() => {
    try {
      const globalLib = new GlobalLibraryStore();
      const category = args.category as string | undefined;
      const search = args.search as string | undefined;
      const page = args.page ? parseInt(args.page as string, 10) : 1;

      if (category || search) {
        // Show filtered/paginated skills
        const result = globalLib.listSkillsByCategory(category || 'all', { search, page });
        setOutput({ skills: result.skills, pagination: { page: result.page, totalPages: result.totalPages, total: result.total } });
      } else {
        // Show all categories
        const categories = globalLib.listSkillCategories();
        setOutput({ categories });
      }
    } catch (e) {
      setOutput({ error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [args]);

  if (output.error) {
    return (
      <Box padding={1}>
        <Text>
          <Text color="red">Error:</Text> {output.error}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Global Skills</Text>
      {output.categories && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Categories:</Text>
          {output.categories.map((cat) => (
            <Box key={cat.name} marginTop={1}>
              <Text>
                <Text color="cyan">[{cat.count}]</Text> <Text bold>{cat.name}</Text>
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>Use: themis global skill list --category &lt;name&gt; [--search &lt;query&gt;] [--page &lt;n&gt;]</Text>
          </Box>
        </Box>
      )}
      {output.skills && (
        <Box flexDirection="column" marginTop={1}>
          {output.skills.length === 0 ? (
            <Text dimColor>No skills found.</Text>
          ) : (
            <>
              {output.skills.map((skill) => (
                <Box key={skill.id} marginBottom={1}>
                  <Text color="cyan" width={25}>
                    {skill.id}
                  </Text>
                  <Text>{skill.description || '(no description)'}</Text>
                </Box>
              ))}
              {output.pagination && (
                <Box marginTop={1}>
                  <Text dimColor>
                    Page {output.pagination.page}/{output.pagination.totalPages} ({output.pagination.total} total)
                  </Text>
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

export function SkillLinkCommand({ store, args }: SkillCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!store) {
      setResult({ success: false, error: 'Store not available' });
      return;
    }

    const skillId = args._[2] as string | undefined;
    const taskName = args._[3] as string | undefined;

    if (!skillId) {
      setResult({ success: false, error: 'Usage: themis skill link <skill-id> [task-name]' });
      return;
    }

    if (!taskName) {
      setResult({ success: false, error: 'Usage: themis skill link <skill-id> [task-name]' });
      return;
    }

    try {
      const task = store.getTask(taskName);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskName}` });
        return;
      }

      // Add skill to task
      const updatedSkills = [
        ...task.skills.filter((s) => s.skill !== skillId),
        { skill: skillId, version: '1.0', enabled: true },
      ];

      store.updateTask(taskName, { skills: updatedSkills });
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [store, args]);

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

export function SkillUnlinkCommand({ store, args }: SkillCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    if (!store) {
      setResult({ success: false, error: 'Store not available' });
      return;
    }

    const skillId = args._[2] as string | undefined;
    const taskName = args._[3] as string | undefined;

    if (!skillId) {
      setResult({ success: false, error: 'Usage: themis skill unlink <skill-id> [task-name]' });
      return;
    }

    if (!taskName) {
      setResult({ success: false, error: 'Usage: themis skill unlink <skill-id> [task-name]' });
      return;
    }

    try {
      const task = store.getTask(taskName);
      if (!task) {
        setResult({ success: false, error: `Task not found: ${taskName}` });
        return;
      }

      // Remove skill from task
      const updatedSkills = task.skills.filter((s) => s.skill !== skillId);
      store.updateTask(taskName, { skills: updatedSkills });
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }, [store, args]);

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
