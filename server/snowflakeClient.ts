import snowflake from 'snowflake-sdk';
import dotenv from 'dotenv';
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
   * Checks if minimum required Snowflake environment variables are present.
   */
  public isConfigured(): boolean {
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
    return {
      SNOWFLAKE_ACCOUNT: this.config.account || 'NOT_SET',
      SNOWFLAKE_USER: this.config.username || 'NOT_SET',
      SNOWFLAKE_DATABASE: this.config.database || 'NOT_SET',
      SNOWFLAKE_SCHEMA: this.config.schema || 'NOT_SET',
      SNOWFLAKE_WAREHOUSE: this.config.warehouse || 'NOT_SET',
      SNOWFLAKE_ROLE: this.config.role || 'NOT_SET',
      SNOWFLAKE_PASSWORD_PRESENT: Boolean(this.config.password),
    };
  }

  /**
   * Creates an active connection to Snowflake.
   */
  private createConnection(): snowflake.Connection {
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
        error: 'Snowflake credentials missing (SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, or SNOWFLAKE_PASSWORD not set).',
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
