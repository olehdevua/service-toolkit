import pg from "pg";
import { Validator } from "../validator.js";
export class PostgresClient {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    static async init(cfg, opts) {
        const { pool: poolCfg, ...connectionCfg } = cfg;
        const pool = new pg.Pool({
            ...connectionCfg,
            ...poolCfg,
            statement_timeout: 10000,
            query_timeout: 15000,
            connectionTimeoutMillis: 10000,
            idle_in_transaction_session_timeout: 15000,
        });
        pool.on("error", (err) => {
            opts.logger.warn(`PG client connection error. ${err.message}`);
        });
        if (opts.onError)
            pool.on("error", opts.onError);
        return new PostgresClient(pool);
    }
}
export class PostgresCfgValidator extends Validator {
    check(cfg) {
        const application_name = this.checkString(cfg.application_name, "PGAPPNAME");
        const host = this.checkString(cfg.host, "PGHOST");
        const port = this.castNumber(cfg.port, "PGPORT");
        const database = this.checkString(cfg.database, "PGDATABASE");
        const user = this.checkString(cfg.user, "PGUSER");
        const password = this.checkString(cfg.password, "PGPASSWORD");
        const max = this.castNumber(cfg.password, "PGPOOL_MAX");
        const idleTimeoutMillis = this.castNumber(cfg.password, "PGPOOL_IDLE_MS");
        const allowExitOnIdle = this.castBoolean(cfg.password, "PGPOOL_EXIT_ON_IDLE");
        const pool = { max, idleTimeoutMillis, allowExitOnIdle };
        return {
            application_name, host, port, database, user, password, pool
        };
    }
}
//# sourceMappingURL=postgres.js.map