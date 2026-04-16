import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface OpenSpecChange {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  status: 'proposed' | 'in_progress' | 'completed' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface OpenSpecProject {
  root: string;
  name: string;
  changes: OpenSpecChange[];
}

export interface OpenSpecCapability {
  name: string;
  description: string;
  change_id: string;
}

// Parse proposal.md for capabilities section
function parseProposalForCapabilities(proposalPath: string): {
  name: string;
  description: string;
  capabilities: string[];
} {
  if (!existsSync(proposalPath)) {
    return { name: '', description: '', capabilities: [] };
  }

  const content = readFileSync(proposalPath, 'utf-8');

  // Extract name from first # heading
  const nameMatch = content.match(/^#\s+(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : '';

  // Extract description (paragraph after name)
  const descMatch = content.match(/^#\s+.+\n\n(.+?)(?=\n##|\n#|$)/s);
  const description = descMatch ? descMatch[1].trim() : '';

  // Extract capabilities from ## Capabilities section
  const capabilities: string[] = [];
  const capMatch = content.match(/##\s+Capabilities\n\n([\s\S]*?)(?=\n##|\n#|$)/);
  if (capMatch) {
    const capLines = capMatch[1].split('\n');
    for (const line of capLines) {
      const trimmed = line.trim().replace(/^[-*]\s*/, '');
      if (trimmed && !trimmed.startsWith('#')) {
        capabilities.push(trimmed);
      }
    }
  }

  return { name, description, capabilities };
}

// Scan a directory for OpenSpec structure
export function scanOpenSpecProject(rootPath: string): OpenSpecProject | null {
  const changesDir = join(rootPath, 'changes');

  if (!existsSync(changesDir)) {
    return null;
  }

  // Find proposal.md in root for project name
  const proposalPath = join(rootPath, 'proposal.md');
  let name = 'Unknown Project';
  if (existsSync(proposalPath)) {
    const parsed = parseProposalForCapabilities(proposalPath);
    name = parsed.name || name;
  }

  const changes: OpenSpecChange[] = [];

  try {
    const changeDirs = readdirSync(changesDir).filter((f) => {
      const stat = require('fs').statSync(join(changesDir, f));
      return stat.isDirectory();
    });

    for (const changeId of changeDirs) {
      const changePath = join(changesDir, changeId);
      const changeProposalPath = join(changePath, 'proposal.md');

      if (existsSync(changeProposalPath)) {
        const { name: changeName, description, capabilities } = parseProposalForCapabilities(changeProposalPath);

        changes.push({
          id: changeId,
          name: changeName || changeId,
          description,
          capabilities,
          status: 'proposed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  } catch {
    // Directory read error
  }

  return { root: rootPath, name, changes };
}

// Get all capabilities from a project
export function getAllCapabilities(project: OpenSpecProject): OpenSpecCapability[] {
  const capabilities: OpenSpecCapability[] = [];

  for (const change of project.changes) {
    for (const capName of change.capabilities) {
      capabilities.push({
        name: capName,
        description: '',
        change_id: change.id,
      });
    }
  }

  return capabilities;
}

// Find capabilities by query
export function searchCapabilities(
  project: OpenSpecProject,
  query: string
): OpenSpecCapability[] {
  const lowerQuery = query.toLowerCase();
  const capabilities: OpenSpecCapability[] = [];

  for (const change of project.changes) {
    for (const capName of change.capabilities) {
      if (capName.toLowerCase().includes(lowerQuery)) {
        capabilities.push({
          name: capName,
          description: change.description,
          change_id: change.id,
        });
      }
    }
  }

  return capabilities;
}
