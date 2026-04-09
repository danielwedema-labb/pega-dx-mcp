import crypto from 'crypto';

/**
 * In-memory OAuth 2.0 provider for the local MCP HTTP server.
 * Implements the OAuthServerProvider interface from @modelcontextprotocol/sdk.
 *
 * Authorization is granted automatically without user interaction — suitable
 * for a local development server. Clients register dynamically and receive
 * short-lived access tokens plus long-lived refresh tokens.
 */

const clients = new Map();       // clientId -> OAuthClientInformationFull
const authCodes = new Map();     // code -> { clientId, challenge, redirectUri, scopes, expiresAt }
const accessTokens = new Map();  // token -> AuthInfo
const refreshTokens = new Map(); // refreshToken -> { clientId, scopes, expiresAt }

const ACCESS_TOKEN_TTL  = 3600;           // seconds  (1 hour)
const REFRESH_TOKEN_TTL = 30 * 24 * 3600; // seconds  (30 days)
const AUTH_CODE_TTL     = 10 * 60 * 1000; // ms       (10 minutes)

export const mcpOAuthProvider = {
  // ----- Client store -------------------------------------------------------

  clientsStore: {
    async getClient(clientId) {
      return clients.get(clientId) ?? null;
    },

    async registerClient(client) {
      const registered = {
        ...client,
        client_id: client.client_id ?? crypto.randomUUID(),
        client_secret: crypto.randomBytes(32).toString('hex'),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0, // never expires
      };
      clients.set(registered.client_id, registered);
      return registered;
    },
  },

  // ----- Authorization code flow --------------------------------------------

  /**
   * Called by the authorization endpoint handler.
   * Immediately redirects with a code — no user interaction required.
   */
  async authorize(client, params, res) {
    const code = crypto.randomBytes(32).toString('hex');

    authCodes.set(code, {
      clientId:    client.client_id,
      challenge:   params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes:      params.scopes ?? [],
      expiresAt:   Date.now() + AUTH_CODE_TTL,
    });

    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (params.state) {
      redirectUrl.searchParams.set('state', params.state);
    }

    res.redirect(302, redirectUrl.href);
  },

  /**
   * Returns the stored PKCE challenge for a given authorization code.
   * The SDK verifies PKCE locally before calling exchangeAuthorizationCode.
   */
  async challengeForAuthorizationCode(_client, code) {
    const entry = authCodes.get(code);
    if (!entry) throw new Error('Invalid authorization code');
    if (Date.now() > entry.expiresAt) {
      authCodes.delete(code);
      throw new Error('Authorization code has expired');
    }
    return entry.challenge;
  },

  /**
   * Exchanges a valid authorization code for access + refresh tokens.
   */
  async exchangeAuthorizationCode(client, code) {
    const entry = authCodes.get(code);
    if (!entry) throw new Error('Invalid authorization code');
    authCodes.delete(code);

    return issueTokenPair(client.client_id, entry.scopes);
  },

  // ----- Refresh token flow -------------------------------------------------

  async exchangeRefreshToken(client, refreshToken, scopes) {
    const entry = refreshTokens.get(refreshToken);
    if (!entry) throw new Error('Invalid refresh token');
    if (entry.expiresAt < Math.floor(Date.now() / 1000)) {
      refreshTokens.delete(refreshToken);
      throw new Error('Refresh token has expired');
    }
    if (entry.clientId !== client.client_id) throw new Error('Refresh token does not belong to client');

    // Honour scope downgrade requests; fall back to originally granted scopes
    const grantedScopes = scopes?.length > 0
      ? scopes.filter(s => entry.scopes.includes(s))
      : entry.scopes;

    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt   = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL;

    accessTokens.set(accessToken, {
      token:    accessToken,
      clientId: client.client_id,
      scopes:   grantedScopes,
      expiresAt,
    });

    return {
      access_token: accessToken,
      token_type:   'bearer',
      expires_in:   ACCESS_TOKEN_TTL,
      scope:        grantedScopes.length > 0 ? grantedScopes.join(' ') : undefined,
    };
  },

  // ----- Token verification (used by requireBearerAuth middleware) ----------

  async verifyAccessToken(token) {
    const authInfo = accessTokens.get(token);
    if (!authInfo) throw new Error('Invalid access token');
    return authInfo;
  },

  // ----- Token revocation (optional) ---------------------------------------

  async revokeToken(_client, request) {
    accessTokens.delete(request.token);
    refreshTokens.delete(request.token);
  },
};

// ---------------------------------------------------------------------------

function issueTokenPair(clientId, scopes) {
  const accessToken  = crypto.randomBytes(32).toString('hex');
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresAt    = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL;

  accessTokens.set(accessToken, { token: accessToken, clientId, scopes, expiresAt });
  refreshTokens.set(refreshToken, {
    clientId,
    scopes,
    expiresAt: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL,
  });

  return {
    access_token:  accessToken,
    token_type:    'bearer',
    expires_in:    ACCESS_TOKEN_TTL,
    refresh_token: refreshToken,
    scope:         scopes.length > 0 ? scopes.join(' ') : undefined,
  };
}
