import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { GlobalLibraryStore } from '../../global-library/index.js';
import { join } from 'path';

interface GlobalCommandProps {
  args: Record<string, unknown>;
}

export function GlobalCommand({ args }: GlobalCommandProps) {
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const store = new GlobalLibraryStore();

  useEffect(() => {
    const subcommand = args._[1] as string | undefined;
    const resource = args._[2] as string | undefined;

    // Ensure directories exist
    store.ensureDirectories();

    if (!subcommand) {
      setOutput(`Global Library Commands:
  th global skill add <path>   Install skill from path
  th global skill list         List global skills
  th global skill remove <id>  Remove global skill
  th global hook add <path>    Install hook from path
  th global hook list          List global hooks
  th global hook remove <id>   Remove global hook
  th global rule add <path>    Install rule from path
  th global rule list           List global rules
  th global rule remove <id>    Remove global rule
  th global install <path>      Install all from path

Global library location: ${store.getGlobalPath()}`);
      return;
    }

    // Skill commands
    if (subcommand === 'skill') {
      if (resource === 'list' || resource === 'ls') {
        const skills = store.listSkills();
        setOutput(`Global Skills (${skills.length}):\n`);
        for (const skill of skills) {
          setOutput((prev) => `${prev}\n  ${skill.id}: ${skill.name} [${skill.category}]`);
          if (skill.description) {
            setOutput((prev) => `${prev}\n    ${skill.description.substring(0, 60)}${skill.description.length > 60 ? '...' : ''}`);
          }
        }
        return;
      }

      if (resource === 'add') {
        const sourcePath = args._[3] as string | undefined;
        if (!sourcePath) {
          setError('Usage: th global skill add <path>');
          return;
        }
        try {
          const skill = store.installSkill(sourcePath);
          setOutput(`Installed skill: ${skill.id} (${skill.name})`);
        } catch (e) {
          setError(`Failed to install skill: ${e instanceof Error ? e.message : e}`);
        }
        return;
      }

      if (resource === 'remove' || resource === 'rm') {
        const skillId = args._[3] as string | undefined;
        if (!skillId) {
          setError('Usage: th global skill remove <id>');
          return;
        }
        if (store.removeSkill(skillId)) {
          setOutput(`Removed skill: ${skillId}`);
        } else {
          setError(`Skill not found: ${skillId}`);
        }
        return;
      }
    }

    // Hook commands
    if (subcommand === 'hook') {
      if (resource === 'list' || resource === 'ls') {
        const hooks = store.listHooks();
        setOutput(`Global Hooks (${hooks.length}):\n`);
        for (const hook of hooks) {
          setOutput((prev) => `${prev}\n  ${hook.id}: [${hook.type}] ${hook.command}`);
        }
        return;
      }

      if (resource === 'add') {
        const sourcePath = args._[3] as string | undefined;
        if (!sourcePath) {
          setError('Usage: th global hook add <path>');
          return;
        }
        try {
          const hook = store.installHook(sourcePath);
          setOutput(`Installed hook: ${hook.id} [${hook.type}]`);
        } catch (e) {
          setError(`Failed to install hook: ${e instanceof Error ? e.message : e}`);
        }
        return;
      }

      if (resource === 'remove' || resource === 'rm') {
        const hookId = args._[3] as string | undefined;
        if (!hookId) {
          setError('Usage: th global hook remove <id>');
          return;
        }
        if (store.removeHook(hookId)) {
          setOutput(`Removed hook: ${hookId}`);
        } else {
          setError(`Hook not found: ${hookId}`);
        }
        return;
      }
    }

    // Rule commands
    if (subcommand === 'rule') {
      if (resource === 'list' || resource === 'ls') {
        const rules = store.listRules();
        setOutput(`Global Rules (${rules.length}):\n`);
        for (const rule of rules) {
          setOutput((prev) => `${prev}\n  ${rule.id}: ${rule.name}`);
          if (rule.description) {
            setOutput((prev) => `${prev}\n    ${rule.description.substring(0, 60)}${rule.description.length > 60 ? '...' : ''}`);
          }
        }
        return;
      }

      if (resource === 'add') {
        const sourcePath = args._[3] as string | undefined;
        if (!sourcePath) {
          setError('Usage: th global rule add <path>');
          return;
        }
        try {
          const rule = store.installRule(sourcePath);
          setOutput(`Installed rule: ${rule.id} (${rule.name})`);
        } catch (e) {
          setError(`Failed to install rule: ${e instanceof Error ? e.message : e}`);
        }
        return;
      }

      if (resource === 'remove' || resource === 'rm') {
        const ruleId = args._[3] as string | undefined;
        if (!ruleId) {
          setError('Usage: th global rule remove <id>');
          return;
        }
        if (store.removeRule(ruleId)) {
          setOutput(`Removed rule: ${ruleId}`);
        } else {
          setError(`Rule not found: ${ruleId}`);
        }
        return;
      }
    }

    // Install all from path
    if (subcommand === 'install') {
      const sourcePath = args._[2] as string | undefined;
      if (!sourcePath) {
        setError('Usage: th global install <path>');
        return;
      }
      // Try to install as skill
      try {
        store.installSkill(sourcePath);
        setOutput(`Installed as skill from: ${sourcePath}`);
      } catch {
        setError(`Could not install from: ${sourcePath}`);
      }
      return;
    }

    setOutput(`Unknown command: th global ${subcommand}`);
  }, [args, store]);

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
      <Text white>{output}</Text>
    </Box>
  );
}
