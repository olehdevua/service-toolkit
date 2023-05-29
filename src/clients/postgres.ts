/* eslint-disable camelcase */
import { Knex } from "knex";
import { Validator } from "../validator.js";
import { Logger } from "./logger.js";

export type PGCfg = {
  connection: {
    application_name: string;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  // OUTDATED: https://knexjs.org/guide/#pool
  pool: {
    max: number;
    idleTimeoutMillis: number;
    allowExitOnIdle: boolean;
  };
};

export class PGClient {
  constructor(
    public client: Knex.Client,
  ) {}

  static async init(cfg: PGCfg, o: {
    logger: Logger,
    onError?: (err: Error, client: pg.PoolClient) => void
  }) {
    const client = new Knex.Client({
      client: "pg",
      connection: cfg.connection,
      pool: cfg.pool,
      log: o.logger
    })

  }

  // static async init(cfg: PGCfg, opts: {
  //   logger: Logger,
  //   onError?: (err: Error, client: pg.PoolClient) => void
  // }) {
  //   const { pool: poolCfg, ...connectionCfg } = cfg;
  //   const pool = new pg.Pool({
  //     ...connectionCfg,
  //     ...poolCfg,
  //     statement_timeout: 10_000,
  //     query_timeout: 15_000,
  //     connectionTimeoutMillis: 10_000,
  //     idle_in_transaction_session_timeout: 15_000,
  //   });
  //
  //   pool.on("error", (err) => {
  //     opts.logger.warn(`PG client connection error. ${err.message}`);
  //   });
  //   if (opts.onError) pool.on("error", opts.onError);
  //
  //   return new PGClient(pool);
  // }
}

export class PGCfgValidator extends Validator<PGCfg> {
  name = "PGCfg";

  check(cfg: Record<string, unknown>): PGCfg {
    this.checkString(cfg.application_name, "application_name");
    this.checkString(cfg.host, "host");
    this.castNumber(cfg.port, "port");
    this.checkString(cfg.database, "database");
    this.checkString(cfg.user, "user");
    this.checkString(cfg.password, "password");
    this.checkWithValidator(cfg.pool, "pool", new PGCfgPoolValidator())

    // OUTDATED: https://knexjs.org/guide/#pool

    return this.content;
  }
}
class PGCfgPoolValidator extends Validator<PGCfg["pool"]> {
  name = "PGCfg.pool";

  check(pool: Record<string, unknown>): PGCfg["pool"] {
    this.castNumber(pool.max, "max");
    this.castNumber(pool.idleTimeoutMillis, "idleTimeoutMillis"); // PGPOOL_IDLE_MS
    this.castBoolean(pool.allowExitOnIdle, "allowExitOnIdle"); // PGPOOL_EXIT_ON_IDLE

    return this.content;
  }
}
