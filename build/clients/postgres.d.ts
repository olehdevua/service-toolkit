import pg from "pg";
import { Validator } from "../validator.js";
import { Logger } from "./logger.js";
export declare type PostgresCfg = {
    application_name: string;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    pool: {
        max: number;
        idleTimeoutMillis: number;
        allowExitOnIdle: boolean;
    };
};
export declare class PostgresClient {
    pool: pg.Pool;
    constructor(pool: pg.Pool);
    static init(cfg: PostgresCfg, opts: {
        logger: Logger;
        onError?: (err: Error, client: pg.PoolClient) => void;
    }): Promise<PostgresClient>;
}
export declare class PostgresCfgValidator extends Validator {
    check(cfg: Record<string, unknown>): PostgresCfg;
}
//# sourceMappingURL=postgres.d.ts.map