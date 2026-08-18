import snowflake from 'snowflake-sdk';
import dotenv from 'dotenv';

dotenv.config();

export interface SnowflakeConfig {
  account?: string;
  username?: string;
  password?: string;
  database?: string;
  schema?: string;
  warehouse?: string;
  role?: string;
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
