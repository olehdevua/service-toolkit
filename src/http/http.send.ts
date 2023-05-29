import { createReadStream } from "fs";
import * as fs from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { pipeline, Readable }  from "node:stream";
import * as http from "node:http";

//import { destroy } from "../streams.js";
import { CacheManager } from "./http.cache.js";
import { HttpRange, Range } from "./http.range.js";
import {
  ErrorValue,
  GeneralError,
  HttpError,
  NotAuthorized,
  NotFoundError
} from "../errors.js";
import { Logger } from "../index.js";
import {
  getContentTypeFromPath,
  getPath
} from "./http.misc.js";
import { Serializer } from "./http.serialize.js";

type DotFilesAction = "ignore" | "allow" | "deny";

export type FileSenderOpts = {
  cache?: {
    immutable: boolean;
    maxage: number;
  },
  range?: string;
  file: {
    hidden?: boolean;
    dotfiles?: DotFilesAction;
    extensions?: string[];
    index?: string[];
    root?: string;
    pathname: string;
    start?: number;
    end?: number;
  }
};

// Maximum value allowed for the max age.
const MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000; // 1 year
// Regular expression to match a path with a directory up component.
const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;


export class HttpRespSender {
  // protected headers: Record<string, string | number | undefined> = {};
  protected headers: http.OutgoingHttpHeaders = {};

  protected constructor(
    protected resp: http.ServerResponse,
    protected readonly method: string,
    public readonly pathname: string,
  ) {}

  static init(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
  ) {
    const method = req.method!;
    const pathname = getPath(req);

    return new HttpRespSender(resp, method, pathname);
  }

  get status() {
    return this.resp.statusCode;
  }
  set status(status: number) {
    this.resp.statusCode = status;
  }

  get sent() {
    return this.resp.headersSent;
  }

  getRespHeaders() {
    return this.resp.getHeaders();
  }

  setHeaders(headers: http.OutgoingHttpHeaders) {
    for (const [ key, value ] of Object.entries(headers)) {
      const h = key.toLowerCase();
      this.headers[h] = value;
    }
  }

  getHeader(key: string) {
    return this.headers[key.toLowerCase()];
  }

  commitHeaders(cleanOldHeaders = false) {
    if (cleanOldHeaders) {
      for (const h of this.resp.getHeaderNames()) this.resp.removeHeader(h);
    }
    for (const [ h, v ] of Object.entries(this.headers)) {
      if (!v) this.resp.removeHeader(h);
      else this.resp.setHeader(h, v);
    }
  }

  /**
   * Why return `boolean`?
   * Because from p-o-v of sender, the fact that it was not
   * able to send data is not an error, lets consumer of this
   * class to decide if this is an error or no.
   *
   * So, only some error on the way to eventually call `stream.end`
   * are errors, otherwise this is no error, but just boolean result
   *
   * @returns Promise<boolean>
   */
  send(body: Buffer | string | Uint8Array = "", o: {
    cleanOldHeaders?: boolean
    status?: number
  }): Promise<boolean> {
    if (o.status) this.resp.statusCode = o.status;
    this.processHeaders(!!o.cleanOldHeaders);

    if (this.method === "HEAD") {
      return new Promise(ok => this.resp.end(ok));
    }

    return new Promise((resolve, reject) => {
      this.resp.end(body, () => resolve(true));
      this.resp.on("error", reject);
    });
  }

  stream(body: Readable, o: {
    mapError: (e: unknown) => Error,
    cleanOldHeaders?: boolean
    status?: number
  }): Promise<boolean> {
    if (o.status) this.resp.statusCode = o.status;
    this.processHeaders(o.cleanOldHeaders);

    if (this.method === "HEAD") {
      return new Promise(ok => this.resp.end(ok));
    }

    return new Promise((resolve, reject) => {
      pipeline(
        body,
        this.resp,
        (err) => {
          if (err) reject(o.mapError(err));
          else resolve(true);
        }
      );
    });
  }

  protected processHeaders(cleanOldHeaders = false) {
    const pathname = this.pathname;

    if (this.resp.headersSent) {
      throw new HttpError(
        "HttpSender#send: can't set headers after they are sent",
        { params: { pathname }, httpStatus: 500 }
      );
    }

    this.commitHeaders(cleanOldHeaders);

    if (this.method !== "HEAD" && !this.resp.hasHeader("content-type")) {
      throw new HttpError("Content-type should be provided", {
        httpStatus: 400, params: { pathname }
      });
    }

    return false;
  }
}


// TODO: maybe add `redirect` and `sendIndex` functionality
//
export class FileSender {
  protected constructor(
    private httpSender: HttpRespSender,
    private cacheManager: CacheManager,
    private logger: Logger,
    private o: FileSenderOpts
  ) {}

  static init(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
    logger: Logger,
    opts: FileSenderOpts
  ) {
    if (opts.file.root) opts.file.root = resolve(opts.file.root);
    opts.range = req.headers.range;

    const sender = HttpRespSender.init(req, resp);
    const cacheManager = CacheManager.init(sender, req.headers, {
      pathname: getPath(req),
      cacheControl: opts.cache
    });

    return new FileSender(sender, cacheManager, logger, opts);
  }

  // TODO: remove sendError bullshit, and just throw err, Router catch it and send as json instead html like here
  public async send(): Promise<void> {
    const [ pathname, parts ] = normalizePath(
      this.o.file.pathname, this.o.file.root
    );
    assertDotFilesAllowed(
      parts, this.o.file.dotfiles || "ignore", this.o.file.pathname
    );

    const stat = await getStat(pathname);
    if (stat.isDirectory())
      // TODO: handle directory with `indexSend` and `redirect` from origin impl
      throw new NotFoundError("file does not exists", { params: { pathname } });

    this.logger.debug("http.send: file is found", { pathname });

    const type = getContentTypeFromPath(pathname);
    this.httpSender.setHeaders({ "content-type": type });

    const hasSentCached = await this.cacheManager.sendFile(stat);
    if (hasSentCached) return;

    // TODO: handle this `len/offset` bullshit, move it somewhere to make this fn use fns of the same level (uncle bob)
    let len = stat.size;
    let offset = this.o.file.start || 0;
    // adjust len to start/end options
    len = Math.max(0, len - offset);
    if (typeof this.o.file.end === "number") {
      const bytes = this.o.file.end - offset + 1;
      if (len > bytes) len = bytes;
    }

    const range = this.handleRanges(len);
    if (range) {
      offset += range.start;
      len = range.end - range.start + 1;
    }

    const opts = { ...this.o };
    // set read options
    opts.file.start = offset;
    opts.file.end = Math.max(offset, offset + len - 1);

    this.httpSender.setHeaders({ "content-length": len });

    const stream = createReadStream(pathname, opts.file);

    // TODO: investigate if really need old-fashioned `destroy` method
    await this.httpSender.stream(stream, {
      mapError: e => mapStatError(e, pathname)
    });
  }

  private handleRanges(len: number): Range | void {
    if (typeof this.o.range === "string" && HttpRange.isBytes(this.o.range)) {
      const range = HttpRange.parse(this.o.range, len, true);
      this.httpSender.setHeaders({ "accept-ranges": range.type });

      // * If-Range support
      // * valid (syntactically-invalid/multiple ranges are treated as a regular response)
      if (this.cacheManager.checkRangeFresh() && range.ranges.length === 1) {
        this.httpSender.status = 206;
        this.httpSender.setHeaders({ "content-range": range.buildContentRange(len) });

        return range.ranges[0];
      }
    }
  }
}

async function getStat(path: string) {
  try {
    return fs.stat(path);
  } catch (error) {
    throw mapStatError(error, path);
  }
}


function normalizePath(path: string, root?: string): [string, string[]] {
  if (typeof root === "string") {
    if (path) path = normalize("." + sep + path);

    // malicious path
    if (UP_PATH_REGEXP.test(path)) {
      throw new NotAuthorized("Path not secure", { params: { path } });
    }

    const parts = path.split(sep); // explode path parts

    // join / normalize from optional root dir
    const finPath = normalize(join(root, path));

    return [ finPath, parts ];
  }
  else {
    if (UP_PATH_REGEXP.test(path)) {
      throw new NotAuthorized("'..' path is malicious without 'root'", { params: { path } });
    }
    const parts = normalize(path).split(sep); // explode path parts
    const finPath = resolve(path); // resolve the path

    return [ finPath, parts ];
  }
}


// Determine if path parts contain a dotfile.
function assertDotFilesAllowed(
  parts: string[],
  dotFileAction: DotFilesAction,
  path: string
) {
  // dotfile handling
  if (parts.some(p => p.length > 1 && p[0] === ".")) {
    if (dotFileAction === "ignore") {
      throw new HttpError("Not Found", { params: { httpStatus: 404, path } });
    }
    if (dotFileAction === "deny") {
      throw new NotAuthorized("Path access is denied", { params: { path } });
    }
  }
}


// class SendStreamOptsValidator extends Validator<FileSenderOpts> {
//   checkDotfiles(dotfiles: unknown): DotFilesAction | void {
//     const strDotfiles = this.checkString(dotfiles, "dotfiles") as string;
//     if (this.getError("dotfiles")) return;
//
//     if (strDotfiles === "ignore" || strDotfiles === "allow" || strDotfiles === "deny") {
//       return strDotfiles;
//     }
//     this.setError(
//       "dotfiles",
//       new TypeError("dotfiles option must be \"allow\", \"deny\", or \"ignore\"")
//     );
//   }
//
//   castMaxAge(maxage: unknown = MAX_MAXAGE) {
//     const finalMaxAge = this.castRange(maxage, "maxage", { min: 0, max: MAX_MAXAGE });
//     if (!this.getError("maxage")) return finalMaxAge as number;
//
//     return undefined;
//   }
//
//   castPath(path: unknown): string | void {
//     const strPath = this.checkString(path, "path");
//     if (this.getError("path")) return;
//
//     let decodedPath: string; try {
//       decodedPath = decodeURIComponent(strPath as string);
//     } catch (err) {
//       this.setError("path", { message: (err as Error).message });
//       return;
//     }
//
//     if (decodedPath.includes("\0")) {
//       this.setError("path", { message: "Null byte in path" });
//       return;
//     }
//
//     return decodedPath;
//   }
//
//   validate(options: Record<string, unknown>): FileSenderOpts {
//     // part of this opts probably isn't used because we currently
//     // don't have `redirect` and `sendIndex` functionality
//     const opts = {
//       acceptRanges: true,
//       cacheControl: true,
//       etag: true,
//       hidden: false,
//       extensions: [],
//       immutable: false,
//       index: [],
//       lastModified: true,
//       ...options,
//       root: this.checkString(options.root, "root") as string,
//       dotfiles: this.checkDotfiles(options.dotfiles || "ignore") as DotFilesAction,
//       maxage: this.castMaxAge(options.maxage) as number,
//       path: this.castPath(options.path) as string,
//     };
//
//     if (this.checkHasErrors()) {
//       throw new TypeError(`SendStream options is invalid. ${JSON.stringify(this.getErrors())}`);
//     }
//
//     return opts;
//   }
// }

function mapStatError(error: any, path: string) {
  switch (error.code) {
    case "ENAMETOOLONG":
    case "ENOENT":
    case "ENOTDIR":
      return new NotFoundError("File doesn't exists", { cause: error, params: { path } });
    default:
      return new GeneralError(`Not able to serve file. ${error}`, { cause: error, params: { path } });
  }
}

export class ErrorSender {
  constructor(
    private sender: HttpRespSender,
    private serializer: Serializer,
    private logger: Logger
  ) {}

  async send(err: ErrorValue): Promise<boolean> {
    if (this.sender.sent) {
      this.logger.debug(
        "ErrorSender#send: cannot send json, headers are sent",
        { pathname: this.sender.pathname }
      );
      return false;
    }

    const body = this.serializer.serialize(err);

    if (Object(err.params?.headers) === err.params?.headers) {
      this.sender.setHeaders(err.params?.headers as http.OutgoingHttpHeaders);
    }
    this.sender.setHeaders({
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
    });

    return this.sender.send(body, { cleanOldHeaders: true, status: err.httpStatus });
  }
}
