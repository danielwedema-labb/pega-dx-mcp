import { MdLogger } from '../utils/md-logger.js';
import { configurableToolLoader } from './configurable-tool-loader.js';

/**
 * Central tool registry for managing MCP tools
 * Coordinates between configurable tool loader and MCP server
 */
export class ToolRegistry {
  constructor() {
    this.initialized = false;
    this.tools = new Map();
    this.categories = new Map();
    this.loader = configurableToolLoader;
  }

  /**
   * Initialize the registry by discovering and loading all tools
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      MdLogger.queueMessage('🔍 Discovering tools...');
      const categories = await this.loader.discoverTools();

      this.categories = categories;
      this.tools = this.loader.getLoadedTools();

      const stats = this.loader.getStats();
      MdLogger.queueMessage(`✅ Tool discovery complete:`);
      MdLogger.queueMessage(`   - ${stats.totalTools} tools loaded`);
      MdLogger.queueMessage(`   - ${stats.categories} categories found`);

      for (const [category, count] of Object.entries(stats.toolsByCategory)) {
        MdLogger.queueMessage(`   - ${category}: ${count} tools`);
      }

      this.initialized = true;
    } catch (error) {
      MdLogger.queueMessage('❌ Failed to initialize tool registry:', error);
      throw new Error(`Tool registry initialization failed: ${error.message}`);
    }
  }

  /**
   * Get all tool definitions for MCP ListToolsRequest
   * @returns {Array} Array of tool definitions
   */
  getAllDefinitions() {
    this.ensureInitialized();
    return this.loader.getAllDefinitions();
  }

  /**
   * Get tool instance by name for execution
   * @param {string} toolName - Name of the tool
   * @returns {Object|null} Tool instance or null if not found
   */
  getToolByName(toolName) {
    this.ensureInitialized();
    return this.loader.getToolByName(toolName);
  }

  /**
   * Get all tools in a specific category
   * @param {string} category - Category name
   * @returns {Array} Array of tool instances
   */
  getToolsByCategory(category) {
    this.ensureInitialized();
    return this.loader.getToolsByCategory(category);
  }

  /**
   * Execute a tool by name with given parameters
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} params - Parameters for the tool
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, params = {}) {
    this.ensureInitialized();

    const tool = this.getToolByName(toolName);
    if (!tool) {
      MdLogger.queueMessage(`[REGISTRY] Tool not found: ${toolName}`);
      return {
        error: `Unknown tool: ${toolName}. Available tools: ${Array.from(this.tools.keys()).join(', ')}`
      };
    }

    try {
      // store timestamp for execution time measurement      
      const startTime = Date.now();
      const result = await tool.execute(params);
      const endTime = Date.now();
      MdLogger.queueMessage(`(${endTime - startTime}ms) ${toolName}(${JSON.stringify(params)})\n`);
      MdLogger.queueMarkdown(result.content[0].text);
      MdLogger.flush(`Execution Result: ${toolName}`);
      return result;
    } catch (error) {
      MdLogger.queueMessage(`[REGISTRY] Tool execution error:`, error);
      MdLogger.queueMessage(`Error executing tool ${toolName}:`, error);
      MdLogger.flush(`Execution Result: ${toolName}`);
      return {
        error: `Error executing tool ${toolName}: ${error.message}`
      };
    }
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    this.ensureInitialized();
    return {
      ...this.loader.getStats(),
      initialized: this.initialized
    };
  }

  /**
   * Get list of all available tool names
   * @returns {Array} Array of tool names
   */
  getToolNames() {
    this.ensureInitialized();
    return Array.from(this.tools.keys()).sort();
  }

  /**
   * Get list of all available categories
   * @returns {Array} Array of category names
   */
  getCategoryNames() {
    this.ensureInitialized();
    return Array.from(this.categories.keys()).sort();
  }

  /**
   * Check if a tool exists
   * @param {string} toolName - Name of the tool
   * @returns {boolean} Whether the tool exists
   */
  hasTool(toolName) {
    this.ensureInitialized();
    return this.tools.has(toolName);
  }

  /**
   * Check if a category exists
   * @param {string} category - Category name
   * @returns {boolean} Whether the category exists
   */
  hasCategory(category) {
    this.ensureInitialized();
    return this.categories.has(category);
  }

  /**
   * Get detailed information about a specific tool
   * @param {string} toolName - Name of the tool
   * @returns {Object|null} Tool information or null if not found
   */
  getToolInfo(toolName) {
    this.ensureInitialized();
    const toolInfo = this.tools.get(toolName);

    if (!toolInfo) {
      return null;
    }

    return {
      name: toolName,
      category: toolInfo.category,
      filename: toolInfo.filename,
      definition: toolInfo.class.getDefinition(),
      className: toolInfo.class.name
    };
  }

  /**
   * Get all tools with their detailed information
   * @returns {Array} Array of tool information objects
   */
  getAllToolInfo() {
    this.ensureInitialized();
    const toolInfos = [];

    for (const toolName of this.tools.keys()) {
      const info = this.getToolInfo(toolName);
      if (info) {
        toolInfos.push(info);
      }
    }

    return toolInfos.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Reload all tools (useful for development)
   * @returns {Promise<void>}
   */
  async reload() {
    MdLogger.queueMessage('🔄 Reloading tool registry...');
    this.initialized = false;
    this.tools.clear();
    this.categories.clear();

    await this.loader.reload();
    await this.initialize();
  }

  /**
   * Validate that the registry is initialized
   * @throws {Error} If registry is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Tool registry not initialized. Call initialize() first.');
    }
  }

  /**
   * Generate a summary report of the registry
   * @returns {string} Human-readable summary
   */
  generateSummary() {
    this.ensureInitialized();

    const stats = this.getStats();
    let summary = `## Tool Registry Summary\n\n`;
    summary += `**Total Tools**: ${stats.totalTools}\n`;
    summary += `**Categories**: ${stats.categories}\n\n`;

    if (stats.categories > 0) {
      summary += `### Tools by Category\n`;
      for (const [category, count] of Object.entries(stats.toolsByCategory)) {
        summary += `- **${category}**: ${count} tools\n`;
      }
      summary += '\n';
    }

    summary += `### Available Tools\n`;
    const toolInfos = this.getAllToolInfo();

    for (const category of this.getCategoryNames()) {
      const categoryTools = toolInfos.filter(tool => tool.category === category);
      if (categoryTools.length > 0) {
        summary += `\n#### ${category}\n`;
        for (const tool of categoryTools) {
          summary += `- \`${tool.name}\` - ${tool.definition.description}\n`;
        }
      }
    }

    return summary;
  }
}

/**
 * Singleton instance for global use
 */
export const toolRegistry = new ToolRegistry();
