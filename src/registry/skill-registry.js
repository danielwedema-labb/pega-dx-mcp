import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import { MdLogger } from '../utils/md-logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Registry for agent skills (agentskills.io format).
 * Each skill lives in src/skills/<name>/SKILL.md with YAML frontmatter.
 */
export class SkillRegistry {
  constructor(skillsPath = resolve(__dirname, '../skills')) {
    this.skillsPath = skillsPath;
    this.skills = new Map(); // name → { name, description, content, uri }
  }

  async initialize() {
    let entries;
    try {
      entries = await fs.readdir(this.skillsPath, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        MdLogger.queueMessage('⚠️  Skills directory not found, skipping skill loading');
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = resolve(this.skillsPath, entry.name, 'SKILL.md');
      try {
        const raw = await fs.readFile(skillFile, 'utf8');
        const skill = this.parseSkill(raw, entry.name);
        this.skills.set(skill.name, skill);
        MdLogger.queueMessage(`   ✅ Skill loaded: ${skill.name}`);
      } catch (error) {
        MdLogger.queueMessage(`   ❌ Failed to load skill ${entry.name}: ${error.message}`);
      }
    }

    MdLogger.queueMessage(`📚 Skills: ${this.skills.size} loaded`);
  }

  /**
   * Parse a SKILL.md file into a skill object.
   * Expects YAML frontmatter between --- delimiters.
   */
  parseSkill(raw, dirName) {
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!fmMatch) {
      throw new Error('Missing or malformed YAML frontmatter');
    }

    const frontmatter = parse(fmMatch[1]);
    const content = fmMatch[2].trim();

    const name = frontmatter.name ?? dirName;
    const description = frontmatter.description ?? '';

    return {
      name,
      description,
      content: raw,
      uri: `skill://${name}`
    };
  }

  list() {
    return Array.from(this.skills.values()).map(({ name, description, uri }) => ({
      name,
      description,
      uri
    }));
  }

  get(name) {
    return this.skills.get(name) ?? null;
  }

  getByUri(uri) {
    return Array.from(this.skills.values()).find(s => s.uri === uri) ?? null;
  }
}

export const skillRegistry = new SkillRegistry();
