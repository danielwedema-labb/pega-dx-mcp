#!/usr/bin/env node

import dotenv from 'dotenv';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { attemptStartupAuthentication, formatAuthStatus } from './auth/startup-auth.js';
import { skillRegistry } from './registry/skill-registry.js';
import { toolRegistry } from './registry/tool-registry.js';
import { registerTools } from './tools.js';
import { HarLogger } from './utils/har-logger.js';
import { MdLogger } from './utils/md-logger.js';

// Load .env file only if it exists, and don't override existing environment variables
// This ensures MCP configuration environment variables take precedence
dotenv.config({ quiet: true, override: false });
MdLogger.init();

class PegaDXMCPServer {
  constructor() {
    this.server = new McpServer(
      {
        name: 'pega-dx-mcp',
        version: '1.0.0',
      }
    );
    this.mcpApiLogger = new HarLogger('mcp-api.har');

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.onerror = (error) => {
      MdLogger.logMessage('MCP Error', `[MCP Error] ${error}`);
    };

    process.on('SIGINT', async () => {
      MdLogger.logMessage('Server Shutdown', '🛑 Shutting down Pega DX MCP server...');
      await this.server.close();
      process.exit(0);
    });
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    MdLogger.queueMessage('✅ Pega DX MCP server running on stdio');
    MdLogger.flush('Server Startup');
  }

  async run() {
    try {
      MdLogger.queueMessage('🚀 Starting Pega DX MCP server...');
      await toolRegistry.initialize();

      const stats = toolRegistry.getStats();
      MdLogger.queueMessage(`📊 Registry initialized with ${stats.totalTools} tools in ${stats.categories} categories`);

      MdLogger.queueMessage('📚 Loading agent skills...');
      await skillRegistry.initialize();
      MdLogger.flush('Initialization Summary');

      MdLogger.queueMessage('🔐 Attempting authentication with environment credentials...');
      const authResult = await attemptStartupAuthentication();
      const authStatus = formatAuthStatus(authResult);
      MdLogger.queueMessage(authStatus);
      MdLogger.flush('Authentication Status');

      registerTools(this.server);
      registerResources(this.server);

      await this.runStdio();

    } catch (error) {
      MdLogger.queueMessage(`❌ Failed to start server: ${error}`);
      MdLogger.flush('Server Startup');
      process.exit(1);
    }
  }
}

// Start the server
const server = new PegaDXMCPServer();
server.run().catch((error) => {
  MdLogger.logMessage('Server Startup', `❌ Server startup failed: ${error}`);
  process.exit(1);
});
