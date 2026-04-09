#!/usr/bin/env node

import dotenv from 'dotenv';
import express from 'express';
import { randomUUID } from 'node:crypto';

import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { mcpOAuthProvider } from './auth/mcp-oauth-provider.js';
import { attemptStartupAuthentication, formatAuthStatus } from './auth/startup-auth.js';
import { skillRegistry } from './registry/skill-registry.js';
import { toolRegistry } from './registry/tool-registry.js';
import { registerSkills, registerTools } from './tools.js';
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

  async runHttp() {
    const port = process.env.PORT || 3000;
    const app = express();
    app.use(express.json());

    const issuerUrl = new URL(`http://localhost:${port}`);
    const resourceServerUrl = new URL(`http://localhost:${port}/mcp`);
    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceServerUrl);

    app.use(mcpAuthRouter({
      provider: mcpOAuthProvider,
      issuerUrl,
      baseUrl: issuerUrl,
      resourceServerUrl,
      resourceName: 'Pega DX MCP Server',
    }));

    const sessions = new Map();

    app.all('/mcp',
      // requireBearerAuth({ verifier: mcpOAuthProvider, resourceMetadataUrl }),
      async (req, res) => {

        // intercept response to capture body for logging
        const chunks = [];
        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);
        res.write = (chunk, ...args) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return origWrite(chunk, ...args); };
        res.end = (chunk, ...args) => { if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return origEnd(chunk, ...args); };

        const sessionId = req.headers['mcp-session-id'];
        let transport;
        if (sessionId && sessions.has(sessionId)) {
          transport = sessions.get(sessionId);
        } else if (!sessionId && req.body?.method === 'initialize') {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => sessions.set(id, transport),
          });
          transport.onclose = () => sessions.delete(transport.sessionId);
          await this.server.connect(transport);
        } else {
          res.status(400).send('Bad Request: missing or unknown session ID');
        }
        if (transport) {
          await transport.handleRequest(req, res, req.body);
        }

        this.mcpApiLogger.log({
          method: req.method,
          url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
          requestHeaders: req.headers,
          requestBody: JSON.stringify(req.body),
          status: res.statusCode,
          statusText: res.statusMessage,
          responseHeaders: res.getHeaders?.() ?? {},
          responseBody: Buffer.concat(chunks).toString('utf8'),
          startedDateTime: new Date().toISOString(),
          elapsed: 0 // could be enhanced to measure actual processing time
        });
      });

    app.listen(port, () => {
      MdLogger.queueMessage(`✅ Pega DX MCP server running on http://localhost:${port}/mcp`);
      MdLogger.flush('Server Startup');
    });
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

      const useHttp = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http';

      if (useHttp) {
        await this.runHttp();
      } else {
        await this.runStdio();
      }

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
