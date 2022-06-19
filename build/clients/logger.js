import * as utils from "node:util";
import { Validator } from "../validator.js";
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["CRITICAL"] = 700] = "CRITICAL";
    LogLevel[LogLevel["ERROR"] = 600] = "ERROR";
    LogLevel[LogLevel["WARN"] = 500] = "WARN";
    LogLevel[LogLevel["INFO"] = 400] = "INFO";
    LogLevel[LogLevel["VERBOSE"] = 300] = "VERBOSE";
    LogLevel[LogLevel["DEBUG"] = 200] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 100] = "TRACE";
})(LogLevel = LogLevel || (LogLevel = {}));
const levelToStrMap = {
    700: "CRITICAL",
    600: "ERROR",
    500: "WARN",
    400: "INFO",
    300: "VERBOSE",
    200: "DEBUG",
    100: "TRACE",
};
const strToLevelMap = {
    "CRITICAL": 700,
    "ERROR": 600,
    "WARN": 500,
    "INFO": 400,
    "VERBOSE": 300,
    "DEBUG": 200,
    "TRACE": 100,
};
const allowedLevels = Object.keys(strToLevelMap).join(", ");
export class LoggerClient {
    opts;
    debug = noop;
    verbose = noop;
    log = noop;
    warn = noop;
    error = noop;
    constructor(opts) {
        this.opts = opts;
        const level = opts.level ?? LogLevel.VERBOSE;
        if (level === LogLevel.DEBUG) {
            this.debug = this._debug;
            this.verbose = this._verbose;
            this.log = this._log;
            this.warn = this._warn;
            this.error = this._error;
            return;
        }
        if (level === LogLevel.VERBOSE) {
            this.verbose = this._verbose;
            this.log = this._log;
            this.warn = this._warn;
            this.error = this._error;
            return;
        }
        if (level === LogLevel.INFO) {
            this.log = this._log;
            this.warn = this._warn;
            this.error = this._error;
            return;
        }
        if (level === LogLevel.WARN) {
            this.warn = this._warn;
            this.error = this._error;
            return;
        }
        if (level === LogLevel.ERROR) {
            this.error = this._error;
            return;
        }
    }
    clone(o) {
        const opts = {
            ...this.opts,
            ...o,
        };
        return new LoggerClient(opts);
    }
    _debug(msg, params) {
        logMessage(msg, {
            context: this.opts.context,
            pretty: this.opts.pretty || false,
            level: LogLevel.DEBUG,
            params
        });
    }
    _verbose(msg, params) {
        logMessage(msg, {
            context: this.opts.context,
            pretty: this.opts.pretty || false,
            level: LogLevel.VERBOSE,
            params
        });
    }
    _log(msg, params) {
        logMessage(msg, {
            context: this.opts.context,
            pretty: this.opts.pretty || false,
            level: LogLevel.INFO,
            params
        });
    }
    _warn(msg, params) {
        logMessage(msg, {
            context: this.opts.context,
            pretty: this.opts.pretty || false,
            level: LogLevel.WARN,
            params
        });
    }
    _error(msg, params) {
        logMessage(msg, {
            context: this.opts.context,
            pretty: this.opts.pretty || false,
            level: LogLevel.ERROR,
            params
        });
    }
}
function logMessage(msg, o) {
    if (o.pretty) {
        console.log(levelToStrMap[o.level] || "VERBOSE", " - ", o.context?.traceId.slice(0, 13), " - ", o.context?.spanId.slice(0, 13), " - ", msg, utils.inspect(o.params));
        return;
    }
    const body = o.params
        ? `{"context":"${o.context || {}}","level":${o.level || LogLevel.VERBOSE},"time":${new Date().toJSON()},"msg":"${msg}","params":${JSON.stringify(o.params, stringifyReplaceBigint)}}`
        : `{"context":"${o.context || {}}","level":${o.level || LogLevel.VERBOSE},"time":${new Date().toJSON()},"msg":"${msg}"}`;
    console.log(body);
    function stringifyReplaceBigint(_key, value) {
        return typeof value === "bigint" ? value.toString() : value;
    }
}
export class LoggerValidator extends Validator {
    checkLevel(level, key) {
        const finLevel = strToLevelMap[level];
        if (!finLevel) {
            this.setError(key, {
                message: "Log level is invalid",
                params: { allowed: allowedLevels }
            });
            return;
        }
        return finLevel;
    }
    check(cfg) {
        const level = this.checkLevel(cfg.level, "LOG_LEVEL");
        const pretty = this.castBoolean(cfg.pretty, "LOG_PRETTY");
        return { level, pretty };
    }
}
function noop(_msg, _params) { }
//# sourceMappingURL=logger.js.map