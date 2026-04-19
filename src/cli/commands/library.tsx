import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { GlobalLibraryStore, GlobalSkill } from '../../global-library/store.js';
import type { ParsedArgs } from '../context.js';


interface LibraryCommandProps {
  args: ParsedArgs;
}

export function LibraryListCommand({ args }: LibraryCommandProps) {
  const [output, setOutput] = useState<{ skills?: GlobalSkill[]; categories?: { name: string; count: number }[]; error?: string }>({});

  useEffect(() => {
    try {
      const globalLib = new GlobalLibraryStore();
      const category = args.category as string | undefined;
      const provider = args.provider as string | undefined;

      if (category) {
        const result = globalLib.listSkillsByCategory(category);
        // Filter by provider if specified
        const filtered = provider
          ? result.skills.filter((s) => s.provider === provider)
          : result.skills;
        setOutput({ skills: filtered });
      } else {
        // Show categories with universal skills highlighted
        const allSkills = globalLib.listSkills();
        const universalCount = allSkills.filter((s) => s.provider === 'universal').length;
        const categories = globalLib.listSkillCategories();
        setOutput({ categories, skills: allSkills });
        if (universalCount > 0) {
          setOutput((prev) => ({
            ...prev,
            categories: [
              ...(prev.categories || []),
              { name: 'universal', count: universalCount },
            ],
          }));
        }
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
      <Text bold>Universal Skills Library</Text>
      <Text dimColor>Stored in ~/.themis/library/skills/</Text>

      {output.categories && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Categories:</Text>
          {output.categories.map((cat) => (
            <Box key={cat.name} marginTop={1}>
              <Text>
                <Text color="cyan">[{cat.count}]</Text>{' '}
                <Text bold>{cat.name}</Text>
                {cat.name === 'universal' && (
                  <Text dimColor> (shared by Claude Code & Codex)</Text>
                )}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>
              Use: themis library list --category &lt;name&gt;
            </Text>
          </Box>
        </Box>
      )}

      {output.skills && output.skills.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {output.skills.map((skill) => (
            <Box key={skill.id} marginBottom={1} flexDirection="column">
              <Box>
                <Box width={25}><Text color="cyan">{skill.id}</Text></Box>
                <Text>
                  {skill.name}
                  <Text dimColor> ({skill.provider})</Text>
                </Text>
              </Box>
              {skill.description && (
                <Text dimColor>{skill.description}</Text>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function LibraryAddCommand({ args }: LibraryCommandProps) {
  const [result, setResult] = useState<{ success: boolean; skill?: GlobalSkill; error?: string }>({
    success: false,
  });

  useEffect(() => {
    const sourcePath = args._[2] as string | undefined;
    if (!sourcePath) {
      setResult({ success: false, error: 'Usage: themis library add <source-path>' });
      return;
    }

    try {
      const globalLib = new GlobalLibraryStore();
      const skill = globalLib.installUniversalSkill(sourcePath);
      setResult({ success: true, skill });
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
        <Text> Skill installed to universal library</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Stored in ~/.themis/library/skills/</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Skill ID: {result.skill?.id}</Text>
      </Box>
    </Box>
  );
}

export function LibraryRemoveCommand({ args }: LibraryCommandProps) {
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  useEffect(() => {
    const id = args._[2] as string | undefined;
    if (!id) {
      setResult({ success: false, error: 'Usage: themis library remove <skill-id>' });
      return;
    }

    try {
      const globalLib = new GlobalLibraryStore();
      const removed = globalLib.removeUniversalSkill(id);
      if (removed) {
        setResult({ success: true });
      } else {
        setResult({ success: false, error: `Skill not found in universal library: ${id}` });
      }
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
        <Text> Skill removed from universal library</Text>
      </Box>
    </Box>
  );
}

export function LibraryPromoteCommand({ args }: LibraryCommandProps) {

  const [result, setResult] = useState<{ success: boolean; skill?: GlobalSkill; error?: string }>({
    success: false,
  });

  useEffect(() => {
    const skillId = args._[2] as string | undefined;
    if (!skillId) {
      setResult({ success: false, error: 'Usage: themis library promote <skill-id>' });
      return;
    }

    try {
      const globalLib = new GlobalLibraryStore();
      const skill = globalLib.getSkill(skillId);
      if (!skill) {
        setResult({ success: false, error: `Skill not found: ${skillId}` });
        return;
      }

      if (skill.provider === 'universal') {
        setResult({ success: false, error: 'Skill is already universal' });
        return;
      }

      // Copy from Claude Code to universal library
      const sourcePath = globalLib.getSkillPath(skillId);
      if (!sourcePath) {
        setResult({ success: false, error: `Could not find skill source: ${skillId}` });
        return;
      }

      const promoted = globalLib.installUniversalSkill(sourcePath, skillId);
      setResult({ success: true, skill: promoted });
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
        <Text> Skill promoted to universal library</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Skill ID: {result.skill?.id}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Now available to both Claude Code and Codex tasks.</Text>
      </Box>
    </Box>
  );
}
