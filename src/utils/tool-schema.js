import { z } from 'zod';

/**
 * Tool schema utilities for consistent session credential parameter definitions
 * Provides standardized schema generation for MCP tools
 */

/**
 * Generate session credentials parameter schema as a Zod v4 schema
 * @returns {z.ZodObject} Session credentials Zod schema
 */
export function getSessionCredentialsSchema() {
  return z.object({
    sessionId:    z.string().optional().describe('Optional session ID. If not provided, a new session will be created.'),
    baseUrl:      z.string().optional().describe('Pega base URL (required if providing credentials)'),
    apiVersion:   z.string().optional().describe('API version (optional, defaults to v2)'),
    clientId:     z.string().optional().describe('OAuth2 client ID (required for OAuth mode)'),
    clientSecret: z.string().optional().describe('OAuth2 client secret (required for OAuth mode)'),
    accessToken:  z.string().optional().describe('Direct access token (required for token mode)'),
    tokenExpiry:  z.number().optional().describe('Token expiry in seconds from now (optional for token mode)')
  }).describe('Optional session-specific credentials. If not provided, uses environment variables. Supports two authentication modes: (1) OAuth mode - provide baseUrl, clientId, and clientSecret, or (2) Token mode - provide baseUrl and accessToken.');
}

