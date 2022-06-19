import { Validator } from "../validator.js";
declare type LoggerParams = object;
export declare enum LogLevel {
    CRITICAL = 700,
    ERROR = 600,
    WARN = 500,
    INFO = 400,
    VERBOSE = 300,
    DEBUG = 200,
    TRACE = 100
}
export interface LogCfg {
    readonly namespace: string;
    readonly context?: {
        readonly traceId: string;
        readonly spanId: string;
    };
    readonly pretty?: boolean;
    readonly level?: LogLevel;
}
declare type LogFunction = (msg: string, params?: LoggerParams) => void;
export interface Logger {
    debug(msg: string, params?: LoggerParams): void;
    verbose(msg: string, params?: LoggerParams): void;
    log(msg: string, params?: LoggerParams): void;
    warn(msg: string, params?: LoggerParams): void;
    error(msg: string, params?: LoggerParams): void;
    clone(opts: Partial<LogCfg>): Logger;
}
export declare class LoggerClient implements Logger {
    private readonly opts;
    debug: LogFunction;
    verbose: LogFunction;
    log: LogFunction;
    warn: LogFunction;
    error: LogFunction;
    constructor(opts: LogCfg);
    clone(o: Partial<LogCfg>): Logger;
    _debug(msg: string, params?: LoggerParams): void;
    _verbose(msg: string, params?: LoggerParams): void;
    _log(msg: string, params?: LoggerParams): void;
    _warn(msg: string, params?: LoggerParams): void;
    _error(msg: string, params?: LoggerParams): void;
}
export declare class LoggerValidator extends Validator {
    checkLevel(level: unknown, key: string): LogLevel | undefined;
    check(cfg: Record<string, unknown>): {
        level: LogLevel;
        pretty: boolean;
    };
}
export {};
//# sourceMappingURL=logger.d.ts.map