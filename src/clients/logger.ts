import chalk from "chalk";
import { v1 as uuidV1 } from "uuid";
import * as utils from "node:util";
import { Validator } from "../validator.js";

export type LoggerParams = Record<string,unknown>;
export type LogLabels = Record<string, string>;

export enum LogLevel {
  CRITICAL = 700,
  ERROR = 600,
  WARN = 500,
  INFO = 400,
  VERBOSE = 300,
  DEBUG = 200,
  TRACE = 100,
}

// export const LogLevelList = [ "CRITICAL", "ERROR", "WARN", "INFO", "VERBOSE", "DEBUG", "TRACE" ];

export interface LogCfg {
  // namespace is bullshit, cause it's special case of more general "labels", use labels
  // readonly namespace: string;
  labels: LogLabels;
  ctx?: {
    readonly traceId: string;
    readonly spanId: string;
  };
  pretty?: boolean;
  level?: LogLevel;
}

export interface ProcessInitLogCfg {
  level: LogLevel;
  pretty: boolean;
}

interface PrintLogCfg extends LogCfg {
  readonly stringifyJSONBigInt?: boolean;
  readonly params?: LoggerParams;
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

const levelToEmojiMap = {
  700: "😱",
  600: "🚨",
  500: "🙈",
  400: "💡",
  300: "🦜",
  200: "🔎",
  100: "💩",
};

const levelToColorMap = {
  700: chalk.red,
  600: chalk.redBright,
  500: chalk.yellow,
  400: chalk.blueBright,
  300: chalk.gray,
  200: chalk.bgGrey,
  100: chalk.bgWhiteBright,
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
  public trace: LogFunction = noop;
  public debug: LogFunction = noop;
  public verbose: LogFunction = noop;
  public info: LogFunction = noop;
  public warn: LogFunction = noop;
  public error: LogFunction = noop;
  public critical: LogFunction = noop;

  private readonly cfg: Readonly<LogCfg>;

  constructor(cfg: LogCfg) {
    cfg.level = cfg.level ?? LogLevel.INFO;
    cfg.ctx = cfg.ctx ?? {
      traceId: "trace-id-const-for-not-passed-traceId",
      spanId: uuidV1(),
    };

    this.cfg = cfg;

    if (cfg.level <= LogLevel.TRACE) this.trace = this._trace;
    if (cfg.level <= LogLevel.DEBUG) this.debug = this._debug;
    if (cfg.level <= LogLevel.VERBOSE) this.verbose = this._verbose;
    if (cfg.level <= LogLevel.INFO) this.info = this._info;
    if (cfg.level <= LogLevel.WARN) this.warn = this._warn;
    if (cfg.level <= LogLevel.ERROR) this.error = this._error;
    this.critical = this._critical;
  }

  static mapStrToLevel(level: string): LogLevel | void {
    const finLevel = strToLevelMap[level as string];
    if (finLevel) return finLevel as LogLevel;
  }

  public clone(o: Partial<LogCfg>): Logger {
    return new LoggerClient({ ...this.cfg, ...o });
  }

  _trace(msg: string, params?: LoggerParams): void {
    logMessage(msg, { ...this.cfg, params, level: LogLevel.TRACE });
  }

  _debug(msg: string, params?: LoggerParams): void {
    logMessage(msg, { ...this.cfg, params, level: LogLevel.DEBUG });
  }

  _verbose(msg: string, params?: LoggerParams): void {
    logMessage(msg, { ...this.cfg, params, level: LogLevel.VERBOSE });
  }

  _info(msg: string, params?: LoggerParams): void {
    logMessage(msg, { ...this.cfg, params, level: LogLevel.INFO });
  }

  _warn(msg: string, params?: LoggerParams): void {
    logMessage(msg, { ...this.cfg, params, level: LogLevel.WARN });
  }

  _error(msg: string, params?: LoggerParams): void {
    logMessage(msg, { ...this.cfg, params, level: LogLevel.ERROR });
  }

  _critical(msg: string, params?: LoggerParams): void {
    logMessage(msg, { ...this.cfg, params, level: LogLevel.CRITICAL });
  }
}

function logMessage(msg: string, o: PrintLogCfg) {
  if (o.pretty) return logPrettyMessage(msg, o);

  let paramsStr = "";
  if (o.params) {
    if (o.stringifyJSONBigInt) paramsStr = JSON.stringify(o.params, stringifyReplaceBigint)
    else  paramsStr = JSON.stringify(o.params)
  }

  const body = o.params
    ? `{"context":"${JSON.stringify(o.ctx)}","level":${o.level},"time":${new Date().toJSON()},"msg":"${msg}","params":${paramsStr}}`
    : `{"context":"${JSON.stringify(o.ctx)}","level":${o.level},"time":${new Date().toJSON()},"msg":"${msg}"}`;

  console.log(body);
}

function stringifyReplaceBigint(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function logPrettyMessage(msg: string, o: PrintLogCfg) {
  const level = o.level ?? LogLevel.VERBOSE;
  let finStack, params;

  if (o.params && o.level === LogLevel.ERROR) {
    const { stack, ...rest } = o.params;
    params = rest;
    finStack = stack;
  }

  const color = levelToColorMap[level] || chalk.blueBright;

  console.log(
    levelToEmojiMap[level] || "🦜",
    color(levelToStrMap[level] || "VERBOSE"),
    "trace:" + o.ctx?.traceId.slice(0, 8),
    "span:" + o.ctx?.spanId.slice(0, 8),
    "-", msg, utils.inspect(params, false, 10, true),
  );

  if (finStack) console.log(finStack);
}

export class LoggerValidator extends Validator<ProcessInitLogCfg> {
  constructor() {
    super("ProcessInitLogCfg");
  }

  checkLevel(level: unknown, key: keyof ProcessInitLogCfg) {
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

  check(cfg: Record<string, unknown>): ProcessInitLogCfg {
    this.checkLevel(cfg.level, "level");
    this.castBoolean(cfg.pretty, "pretty");

    return this.content;
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
function noop(_msg: string, _params?: LoggerParams): void {}
