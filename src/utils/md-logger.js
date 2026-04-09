import { appendFileSync, existsSync, mkdirSync } from 'fs';

export class MdLogger {
  static filePath = null;
  static messages = [];
  static markdownBlocks = [];
  static startTime = null;

  static init() {
    if (process.env.LOG_DIRECTORY) {
      if (!existsSync(process.env.LOG_DIRECTORY)) {
        mkdirSync(process.env.LOG_DIRECTORY, { recursive: true });
      }
      MdLogger.filePath = `${process.env.LOG_DIRECTORY}/mcp.md`;
    }
  }

  static logMessage(title, message) {
    MdLogger.queueMessage(message);
    MdLogger.flush(title);
  }

  static queueMessage(message) {
    if (!MdLogger.startTime) MdLogger.startTime = new Date();
    MdLogger.messages.push(message);
  }

  static queueMarkdown(markdown) {
    if (!MdLogger.startTime) MdLogger.startTime = new Date();
    MdLogger.markdownBlocks.push(markdown);
  }

  static flush(title) {
    if (!MdLogger.filePath) return;
    if (MdLogger.messages.length === 0 && MdLogger.markdownBlocks.length === 0) return;

    const lines = [
      `\n# ${title}`,
      `*${new Date().toISOString()}*`,
      '```bash',
      ...MdLogger.messages,
      '```',
    ];

    if (MdLogger.markdownBlocks.length > 0) {
      lines.push(...MdLogger.markdownBlocks);
    }

    try {
      appendFileSync(MdLogger.filePath, lines.join('\n'));
    } catch { /* ignore write errors */ }

    MdLogger.messages = [];
    MdLogger.markdownBlocks = [];
    MdLogger.startTime = null;
  }
}
