import * as utils from "node:util";
import { Validator } from "../validator.js";

type LoggerParams = object;

export enum LogLevel {
  CRITICAL = 700,
  ERROR = 600,
  WARN = 500,
  INFO = 400,
  VERBOSE = 300,
  DEBUG = 200,
  TRACE = 100,
}

export interface LogCfg {
  readonly namespace: string;
  readonly context?: {
    readonly traceId: string;
    readonly spanId: string;
  }
  readonly pretty?: boolean;
  readonly level?: LogLevel;
}

type LogFunction = (msg: string, params?: LoggerParams) => void;

export interface Logger {
  // NOTE: I thought about make that method async
  // but it's bad design to wait while logger deliver
  // a message, and instead it's better to return
  // result ASAP.
  // We shouldn't care about logger failures in our app.
  // Probably we should have some statistics with `statsd`
  // to track logger failures! (which is also best-effort :lol:)
  //
  // P.S (2020-10-09)
  // AFAIK Docker/12-factors recommend to put logs into
  // stdout. Why? Because it's most `resilient` and
  // `low-latency` target.
  // So, yor app doesn't care about `async/not-async` since
  // latency is always low, and it's not care if logs is
  // transported to `central log store` (no need statsd).
  // Because it would be responsibility of another service
  // Maybe some orchestrator or any other `ops` utility
  // would care about logs.
  debug(msg: string, params?: LoggerParams): void;
  verbose(msg: string, params?: LoggerParams): void;
  info(msg: string, params?: LoggerParams): void;
  warn(msg: string, params?: LoggerParams ): void;
  error(msg: string, params?: LoggerParams): void;

  clone(opts: Partial<LogCfg>): Logger;
}

const levelToStrMap = {
  700: "CRITICAL",
  600: "ERROR",
  500: "WARN",
  400: "INFO",
  300: "VERBOSE",
  200: "DEBUG",
  100: "TRACE",
};

const strToLevelMap: Record<string, number> = {
  "CRITICAL": 700,
  "ERROR": 600,
  "WARN": 500,
  "INFO": 400,
  "VERBOSE": 300,
  "DEBUG": 200,
  "TRACE": 100,
};
const allowedLevels = Object.keys(strToLevelMap).join(", ");

export class LoggerClient implements Logger {
  public debug: LogFunction = noop;
  public verbose: LogFunction = noop;
  public info: LogFunction = noop;
  public warn: LogFunction = noop;
  public error: LogFunction = noop;

  constructor(
    private readonly opts: LogCfg,
  ) {
    const level = opts.level ?? LogLevel.VERBOSE;

    if (level === LogLevel.DEBUG) {
      this.debug = this._debug;
      this.verbose = this._verbose;
      this.info = this._info;
      this.warn = this._warn;
      this.error = this._error;
      return;
    }

    if (level === LogLevel.VERBOSE) {
      this.verbose = this._verbose;
      this.info = this._info;
      this.warn = this._warn;
      this.error = this._error;
      return;
    }

    if (level === LogLevel.INFO) {
      this.info = this._info;
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

  public clone(o: Partial<LogCfg>): Logger {
    const opts = {
      ...this.opts,
      ...o,
    };
    return new LoggerClient(opts);
  }

  _debug(msg: string, params?: LoggerParams): void {
    logMessage(msg, {
      context: this.opts.context,
      pretty: this.opts.pretty || false,
      level: LogLevel.DEBUG,
      params
    });
  }

  _verbose(msg: string, params?: LoggerParams): void {
    logMessage(msg, {
      context: this.opts.context,
      pretty: this.opts.pretty || false,
      level: LogLevel.VERBOSE,
      params
    });
  }

  _info(msg: string, params?: LoggerParams): void {
    logMessage(msg, {
      context: this.opts.context,
      pretty: this.opts.pretty || false,
      level: LogLevel.INFO,
      params
    });
  }

  _warn(msg: string, params?: LoggerParams): void {
    logMessage(msg, {
      context: this.opts.context,
      pretty: this.opts.pretty || false,
      level: LogLevel.WARN,
      params
    });
  }

  _error(msg: string, params?: LoggerParams): void {
    logMessage(msg, {
      context: this.opts.context,
      pretty: this.opts.pretty || false,
      level: LogLevel.ERROR,
      params
    });
  }
}

function logMessage(
  msg: string,
  o: {
    context?: LogCfg["context"],
    pretty: boolean;
    level: LogLevel;
    params?: LoggerParams;
  }
) {

  if (o.pretty) {
    console.log(
      levelToStrMap[o.level] || "VERBOSE",
      "trace:" + o.context?.traceId.slice(0, 8),
      "span:" + o.context?.spanId.slice(0, 8),
      " - ", msg, utils.inspect(o.params)
    );
    return;
  }

  const body = o.params
    ? `{"context":"${o.context || {}}","level":${o.level || LogLevel.VERBOSE},"time":${new Date().toJSON()},"msg":"${msg}","params":${JSON.stringify(o.params, stringifyReplaceBigint)}}`
    : `{"context":"${o.context || {}}","level":${o.level || LogLevel.VERBOSE},"time":${new Date().toJSON()},"msg":"${msg}"}`;

  console.log(body);

  function stringifyReplaceBigint(_key: string, value: unknown): unknown {
    return typeof value === "bigint" ? value.toString() : value;
  }
}

export class LoggerValidator extends Validator {
  checkLevel(level: unknown, key: string) {
    const finLevel = strToLevelMap[level as string];

    if (!finLevel) {
      this.setError(key, {
        message: "Log level is invalid",
        params: { allowed: allowedLevels }
      });
      return;
    }

    return finLevel as LogLevel;
  }

  check(
    cfg: Record<string, unknown>
  ): { level: LogLevel, pretty: boolean } {
    const level = this.checkLevel(cfg.level, "LOG_LEVEL") as LogLevel;
    const pretty = this.castBoolean(cfg.pretty, "LOG_PRETTY") as boolean;

    return { level, pretty };
  }

  //validate(cfg: Record<string, any>): LogCfg {
  //  const level = this.checkLevel(cfg.level, "level") as LogLevel;
  //  const namespace = this.checkString(cfg.namespace, "namespace") as string;

  //  let context = null;
  //  if (cfg.context) {
  //    context = {} as { traceId: string; spanId: string; };
  //    context.traceId = this.checkString(cfg.context.traceId, "traceId") as string;
  //    context.spanId = this.checkString(cfg.context.spanId, "spanId") as string;
  //  }

  //  if (this.checkHasErrors()) {
  //    throw new Error(`Logger params is invalid. ${JSON.stringify(this.getErrors())}`);
  //  }

  //  return {
  //    ...(context ? { context } : null),
  //    level,
  //    namespace,
  //    pretty: cfg.pretty ? true : false
  //  };
  //}
}

// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
function noop(_msg: string, _params?: LoggerParams): void {}
