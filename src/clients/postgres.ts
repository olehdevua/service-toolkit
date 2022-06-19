/* eslint-disable camelcase */
import pg from "pg";
import { Validator } from "../validator.js";
import { Logger } from "./logger.js";

export type PostgresCfg = {
  application_name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  // OUTDATED: https://knexjs.org/guide/#pool
  pool: {
    max: number;
    idleTimeoutMillis: number;
    allowExitOnIdle: boolean;
  };
};

export class PostgresClient {
  constructor(
    public pool: pg.Pool,
  ) {}

  static async init(cfg: PostgresCfg, opts: {
    logger: Logger,
    onError?: (err: Error, client: pg.PoolClient) => void
  }) {
    const { pool: poolCfg, ...connectionCfg } = cfg;
    const pool = new pg.Pool({
      ...connectionCfg,
      ...poolCfg,
      statement_timeout: 10_000,
      query_timeout: 15_000,
      connectionTimeoutMillis: 10_000,
      idle_in_transaction_session_timeout: 15_000,
    });

    pool.on("error", (err) => {
      opts.logger.warn(`PG client connection error. ${err.message}`);
    });
    if (opts.onError) pool.on("error", opts.onError);

    return new PostgresClient(pool);
  }
}

export class PostgresCfgValidator extends Validator {
  check(cfg: Record<string, unknown>): PostgresCfg {
    const application_name = this.checkString(cfg.application_name, "PGAPPNAME") as string;
    const host = this.checkString(cfg.host, "PGHOST") as string;
    const port = this.castNumber(cfg.port, "PGPORT") as number;
    const database = this.checkString(cfg.database, "PGDATABASE") as string;
    const user = this.checkString(cfg.user, "PGUSER") as string;
    const password = this.checkString(cfg.password, "PGPASSWORD") as string;
    const max = this.castNumber(cfg.password, "PGPOOL_MAX") as number;
    const idleTimeoutMillis = this.castNumber(cfg.password, "PGPOOL_IDLE_MS") as number;
    const allowExitOnIdle = this.castBoolean(cfg.password, "PGPOOL_EXIT_ON_IDLE") as boolean;

    // OUTDATED: https://knexjs.org/guide/#pool

    const pool = { max, idleTimeoutMillis, allowExitOnIdle };
    return {
      application_name, host, port, database, user, password, pool
    };
  }
}
