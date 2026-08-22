import snowflake from 'snowflake-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading server/.env, server/dist/.env, or root .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

export interface SnowflakeConfig {
  account?: string;
  username?: string;
  password?: string;
  database?: string;
  schema?: string;
  warehouse?: string;
  role?: string;
}

export interface SnowflakeDiagnosticResult<T = Record<string, unknown>> {
  success: boolean;
  data?: T[];
  error?: string;
  timings: {
    connectionStartedAt: string;
    connectionSucceededAt?: string;
    queryStartedAt?: string;
    queryCompletedAt?: string;
    elapsedMs: number;
  };
}

export class SnowflakeClient {
  private config: SnowflakeConfig;

  constructor() {
    this.config = {
      account: process.env.SNOWFLAKE_ACCOUNT,
      username: process.env.SNOWFLAKE_USER,
      password: process.env.SNOWFLAKE_PASSWORD,
      database: process.env.SNOWFLAKE_DATABASE || 'CLEARSET_DB',
      schema: process.env.SNOWFLAKE_SCHEMA || 'CLEARSET_SCHEMA',
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
      role: process.env.SNOWFLAKE_ROLE || 'SYSADMIN',
    };
  }

  /**
   * Reads the Snowflake-injected OAuth token from /snowflake/session/token.
   * Available inside Snowflake App Runtime / SPCS containers.
   * Returns null when running locally (file does not exist).
   * The token rotates every few minutes — always read fresh.
   */
  private readSpcsOAuthToken(): string | null {
    const TOKEN_PATH = '/snowflake/session/token';
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
      }
    } catch {
      // Not inside SPCS — expected in local development
    }
    return null;
  }

  /**
   * Checks if minimum required Snowflake environment variables are present.
   * In Snowflake App Runtime, SNOWFLAKE_ACCOUNT and SNOWFLAKE_HOST are injected
   * automatically and the OAuth token replaces the password.
   */
  public isConfigured(): boolean {
    const spcsToken = this.readSpcsOAuthToken();
    if (spcsToken) {
      // Inside App Runtime: account and host are injected by Snowflake
      return Boolean(process.env.SNOWFLAKE_ACCOUNT || process.env.SNOWFLAKE_HOST);
    }
    // Local development: require account + user + password
    return Boolean(
      this.config.account &&
      this.config.username &&
      this.config.password
    );
  }

  /**
   * Returns current configuration metadata (with credentials masked).
   */
  public getConfigSummary() {
    return {
      account: this.config.account ? `${this.config.account.substring(0, 4)}***` : 'NOT_SET',
      user: this.config.username ? `${this.config.username.substring(0, 2)}***` : 'NOT_SET',
      database: this.config.database,
      schema: this.config.schema,
      warehouse: this.config.warehouse,
      role: this.config.role,
      configured: this.isConfigured(),
    };
  }

  /** Temporary diagnostic-only configuration view. Never includes the password. */
  public getDiagnosticEnvironment() {
    const spcsToken = this.readSpcsOAuthToken();
    return {
      SNOWFLAKE_ACCOUNT: this.config.account || process.env.SNOWFLAKE_ACCOUNT || 'NOT_SET',
      SNOWFLAKE_HOST: process.env.SNOWFLAKE_HOST || 'NOT_SET',
      SNOWFLAKE_USER: this.config.username || 'NOT_SET',
      SNOWFLAKE_DATABASE: this.config.database || 'NOT_SET',
      SNOWFLAKE_SCHEMA: this.config.schema || 'NOT_SET',
      SNOWFLAKE_WAREHOUSE: this.config.warehouse || 'NOT_SET',
      SNOWFLAKE_ROLE: this.config.role || 'NOT_SET',
      SNOWFLAKE_PASSWORD_PRESENT: Boolean(this.config.password),
      SPCS_OAUTH_TOKEN_PRESENT: Boolean(spcsToken),
      AUTH_MODE: spcsToken ? 'SPCS_OAUTH' : 'PASSWORD',
    };
  }

  /**
   * Creates an active connection to Snowflake.
   *
   * Auth strategy:
   *   SNOWFLAKE APP RUNTIME — use the SPCS-injected OAuth token from
   *     /snowflake/session/token with SNOWFLAKE_HOST (private endpoint).
   *     No password or PAT is required or used.
   *   LOCAL DEVELOPMENT — use account + username + password from .env,
   *     exactly as before.
   */
  private createConnection(): snowflake.Connection {
    const spcsToken = this.readSpcsOAuthToken();
    const host = process.env.SNOWFLAKE_HOST;

    if (spcsToken && host) {
      // Inside Snowflake App Runtime / SPCS: credential-free OAuth via injected token
      return snowflake.createConnection({
        account: this.config.account || process.env.SNOWFLAKE_ACCOUNT || '',
        username: this.config.username || process.env.SNOWFLAKE_USER || '',
        host,
        authenticator: 'OAUTH',
        token: spcsToken,
        database: this.config.database,
        schema: this.config.schema,
        warehouse: this.config.warehouse,
        role: this.config.role,
        clientSessionKeepAlive: true,
      });
    }

    // Local development: password-based auth (unchanged)
    return snowflake.createConnection({
      account: this.config.account || '',
      username: this.config.username || '',
      password: this.config.password || '',
      database: this.config.database,
      schema: this.config.schema,
      warehouse: this.config.warehouse,
      role: this.config.role,
      clientSessionKeepAlive: true,
    });
  }

  /**
   * Executes a SQL statement against Snowflake and returns the rows as typed JSON array.
   */
  public executeStatement<T = any>(sqlText: string, binds: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.isConfigured()) {
        return reject(new Error('Snowflake credentials are not configured in environment variables.'));
      }

      const connection = this.createConnection();

      connection.connect((connectErr) => {
        if (connectErr) {
          return reject(connectErr);
        }

        connection.execute({
          sqlText,
          binds,
          complete: (execErr, _stmt, rows) => {
            connection.destroy((destroyErr) => {
              if (destroyErr) {
                console.error('[SnowflakeClient] Error destroying connection:', destroyErr);
              }
            });

            if (execErr) {
              return reject(execErr);
            }

            resolve((rows || []) as T[]);
          },
        });
      });
    });
  }

  /**
   * TEMPORARY: runs one minimal diagnostic query with phase timing and a hard
   * client-side timeout. It is intentionally separate from production calls.
   */
  public executeDiagnosticStatement<T = Record<string, unknown>>(
    sqlText: string,
    timeoutMs = 15_000,
  ): Promise<SnowflakeDiagnosticResult<T>> {
    const startedAt = Date.now();
    const timings: SnowflakeDiagnosticResult<T>['timings'] = {
      connectionStartedAt: new Date(startedAt).toISOString(),
      elapsedMs: 0,
    };

    const completeTimings = () => {
      timings.elapsedMs = Date.now() - startedAt;
    };

    return new Promise((resolve) => {
      if (!this.isConfigured()) {
        completeTimings();
        resolve({ success: false, error: 'Snowflake credentials are not configured.', timings });
        return;
      }

      const connection = this.createConnection();
      let finished = false;
      let phase: 'connection' | 'query' = 'connection';

      const finish = (result: Omit<SnowflakeDiagnosticResult<T>, 'timings'>) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        completeTimings();
        connection.destroy(() => undefined);
        console.log(`[Snowflake diagnostic] ${result.success ? 'completed' : 'failed'} after ${timings.elapsedMs}ms`);
        resolve({ ...result, timings });
      };

      const timeout = setTimeout(() => {
        finish({
          success: false,
          error: `Timed out during ${phase} after ${timeoutMs}ms.`,
        });
      }, timeoutMs);

      console.log(`[Snowflake diagnostic] connection started at ${timings.connectionStartedAt}`);
      connection.connect((connectErr) => {
        if (connectErr) {
          finish({ success: false, error: `Connection error: ${connectErr.message}` });
          return;
        }

        timings.connectionSucceededAt = new Date().toISOString();
        timings.queryStartedAt = new Date().toISOString();
        phase = 'query';
        console.log(`[Snowflake diagnostic] connection succeeded; query started at ${timings.queryStartedAt}`);

        connection.execute({
          sqlText,
          complete: (queryErr, _statement, rows) => {
            timings.queryCompletedAt = new Date().toISOString();
            if (queryErr) {
              finish({ success: false, error: `Query error: ${queryErr.message}` });
              return;
            }
            finish({ success: true, data: (rows || []) as T[] });
          },
        });
      });
    });
  }

  /**
   * Tests the connection with a lightweight harmless query.
   */
  public async testConnection(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Snowflake not configured. Locally: set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD in server/.env. Inside App Runtime: OAuth token is injected automatically.',
      };
    }

    try {
      const rows = await this.executeStatement(
        'SELECT CURRENT_ACCOUNT() AS ACCOUNT, CURRENT_USER() AS USER, CURRENT_ROLE() AS ROLE, CURRENT_WAREHOUSE() AS WAREHOUSE, CURRENT_DATABASE() AS DATABASE, CURRENT_SCHEMA() AS SCHEMA;'
      );

      return {
        success: true,
        data: rows[0] || {},
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to connect to Snowflake.',
      };
    }
  }
}

export const snowflakeClient = new SnowflakeClient();
