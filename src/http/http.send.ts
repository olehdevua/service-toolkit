import { Stats, createReadStream } from "fs";
import * as fs from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { pipeline }  from "node:stream";
import * as http from "node:http";

import mime from "mime";
import ms from "ms";
//import { destroy } from "../streams.js";
import { escapeHtml, removeContentHeaderFields, sendText } from "./http.misc.js";
import { checkRespFreshness, isCachable, isConditionalReq, isPreconditionFailure, isRangeFresh } from "./http.cache.js";
import { buildContentRange, parseRange } from "./http.range.js";
import { stattag } from "./http.etag.js";
import {
  GeneralError,
  HttpError,
  NotFoundError
} from "../errors.js";
import { Validator } from "../validator.js";
import { Logger } from "../index.js";

type DotFilesAction = "ignore" | "allow" | "deny";
export type SendStreamOpts = {
  acceptRanges: boolean;
  cacheControl: boolean;
  etag: boolean;
  hidden: boolean;
  dotfiles: DotFilesAction;
  extensions: string[];
  immutable: boolean;
  index: string[];
  lastModified: boolean;
  maxage: number;
  root?: string;
  path: string;
  start?: number;
  end?: number;
};

// Regular expression for identifying a bytes Range header.
const BYTES_RANGE_REGEXP = /^ *bytes=/;
// Maximum value allowed for the max age.
const MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000; // 1 year
// Regular expression to match a path with a directory up component.
const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;


// TODO: maybe add `redirect` and `sendIndex` functionlity
//
export class FileSender {
  private constructor(
    private req: http.IncomingMessage,
    private logger: Logger,
    private opts: SendStreamOpts
  ) {}

  static init(
    req: http.IncomingMessage,
    logger: Logger,
    options: Record<string, unknown>
  ) {
    const validator = new SendStreamOptsValidator();
    const opts = validator.validate({ ...options });

    if (opts.root) opts.root = resolve(opts.root);

    return new FileSender(req, logger, opts);
  }

  public async send(
    res: http.ServerResponse,
    opts: { onError?: (err: Error) => Promise<void>; } = {}
  ): Promise<void> {
    try {
      const [ path, parts ] = normalizePath(this.opts.path, this.opts.root);
      assertDotFilesAllowed(parts, this.opts.dotfiles, this.opts.path);

      const stat = await getStat(path);
      if (stat.isDirectory())
        // TODO: handle directory with `indexSend` and `redirect` from origin impl
        throw new NotFoundError("File doesn't exists", { params: { path } });

      this.logger.debug("http.send: File is found", { path });

      let len = stat.size;
      let offset = this.opts.start || 0;

      if (res.headersSent) {
        // impossible to send now
        throw new GeneralError("Can't set headers after they are sent.");
      }

      // set header fields
      this.setHeaders(res, path);

      const hasSentCached = await this.handleCaching(res, path, stat);
      if (hasSentCached) return;

      // adjust len to start/end options
      len = Math.max(0, len - offset);
      if (typeof this.opts.end === "number") {
        const bytes = this.opts.end - offset + 1;
        if (len > bytes) len = bytes;
      }

      [ offset, len ] = this.handleRanges(res, offset, len);

      const opts = { ...this.opts };
      // set read options
      opts.start = offset;
      opts.end = Math.max(offset, offset + len - 1);

      // content-length
      res.setHeader("Content-Length", len);

      // HEAD support
      if (this.req.method === "HEAD") {
        return new Promise(ok => res.end(ok));
      }

      const stream = createReadStream(path, opts);

      // TODO: investigate if really need old-fashioned `destroy` method

      await new Promise((resolve, reject) => {
        pipeline(
          stream,
          res,
          (err) => {
            //if (err) {
            //  const { message, stack, code, params } = err.valueOf() as any;
            //  this.logger.error(message, { stack, code, params });
            //}
            //resolve(undefined);
            if (err) reject(mapStatError(err, path));
            else resolve(undefined);
          }
        );
      });
    } catch(err) {
      if (opts.onError) await opts.onError(err as GeneralError);
      else await this.sendError(res, err as GeneralError);
    }
  }

  // Set response header fields, most
  // fields may be pre-defined.
  private setHeaders(res: http.ServerResponse, path: string) {
    if (this.opts.acceptRanges && !res.getHeader("Accept-Ranges")) {
      res.setHeader("Accept-Ranges", "bytes");
    }

    // set content-type
    if (!res.getHeader("Content-Type")) {
      const type = mime.getType(path);
      if (!type) return;

      const charset = [ "js", "html", "xml", "txt" ].includes(mime.getExtension(type) || "");

      res.setHeader("Content-Type", type + (charset ? "; charset=" + charset : ""));
    }
  }

  private async handleCaching(
    res: http.ServerResponse,
    path: string, stat: Stats
  ): Promise<boolean> {
    if (this.opts.cacheControl && !res.getHeader("Cache-Control")) {
      let cacheControl = "public, max-age=" + Math.floor(this.opts.maxage / 1000);
      if (this.opts.immutable) cacheControl += ", immutable";
      res.setHeader("Cache-Control", cacheControl);
    }

    if (this.opts.lastModified && !res.getHeader("Last-Modified")) {
      res.setHeader("Last-Modified", stat.mtime.toUTCString());
    }

    if (this.opts.etag && !res.getHeader("ETag")) {
      res.setHeader("ETag", stattag(stat));
    }

    // conditional GET support
    if (isConditionalReq(this.req)) {
      // Copied from origin source, but WHY WE NEED IT?
      // `isPreconditionFailure` makes sens only on `POST|PUT|PATCH` methods
      if (isPreconditionFailure(this.req, res)) {
        throw new HttpError("Precondition Failure", { params: { path }, httpStatus: 412 });
      }

      if (isCachable(res) && checkRespFreshness(this.req, res)) {
        removeContentHeaderFields(res);
        res.statusCode = 304;

        return new Promise((resolve, reject) => {
          res.end("", () => resolve(true));
          res.on("error", reject);
        });
      }
    }

    return false;
  }

  private handleRanges(
    res: http.ServerResponse,
    offset: number,
    len: number
  ): [number, number] {
    const ranges = this.req.headers.range;

    // Range support
    if (this.opts.acceptRanges && typeof ranges === "string" && BYTES_RANGE_REGEXP.test(ranges)) {
      // parse
      const range = parseRange(len, ranges, { combine: true });

      // If-Range support
      // valid (syntactically invalid/multiple ranges are treated as a regular response)
      if (isRangeFresh(this.req, res) && range.ranges.length === 1) {
        // Content-Range
        res.statusCode = 206;
        res.setHeader("Content-Range", buildContentRange("bytes", len, range.ranges[0]));

        // adjust for requested range
        offset += range.ranges[0].start;
        len = range.ranges[0].end - range.ranges[0].start + 1;
      }
    }

    return [ offset, len ];
  }

  async sendError(
    res: http.ServerResponse,
    err: GeneralError
  ): Promise<void> {
    const { message, stack, code, params } = err.valueOf();
    this.logger.error(message, { stack, code, params });

    if (res.headersSent) {
      this.logger.debug("http.send: Cannot send json, headers are sent", { path: this.opts.path });
      return;
    }

    const doc = createHtmlDocument("Error", escapeHtml(code));

    for (const h of res.getHeaderNames()) res.removeHeader(h);

    // add error headers
    if (err && Object(err.params?.headers) === err.params?.headers) {
      setHeaders(res, err.params?.headers as Record<string, string>);
    }

    // send basic response
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");

    await sendText(res, doc, {
      status: err.httpStatus || 500,
      type: "text/html; charset=UTF-8"
    });
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
      throw new HttpError("Path not secure", { params: { path }, httpStatus: 403 });
    }

    const parts = path.split(sep); // explode path parts

    // join / normalize from optional root dir
    const finPath = normalize(join(root, path));

    return [ finPath, parts ];
  }
  else {
    if (UP_PATH_REGEXP.test(path)) {
      throw new HttpError("'..' path is malicious without 'root'", {
        params: { path }, httpStatus: 403
      });
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
      throw new HttpError("Path access is denied", { params: { httpStatus: 403, path } });
    }
  }
}

function createHtmlDocument(title: string, body: string) {
  return "<!DOCTYPE html>\n" +
    "<html lang=\"en\">\n" +
    "<head>\n" +
    "<meta charset=\"utf-8\">\n" +
    "<title>" + title + "</title>\n" +
    "</head>\n" +
    "<body>\n" +
    "<pre>" + body + "</pre>\n" +
    "</body>\n" +
    "</html>\n";
}


// Set an object of headers on a response.
function setHeaders(res: http.ServerResponse, headers: Record<string, string>) {
  for (const [ header, value ] of Object.entries(headers)) {
    res.setHeader(header, value);
  }
}

class SendStreamOptsValidator extends Validator {
  checkDotfiles(dotfiles: unknown): DotFilesAction | void {
    const strDotfiles = this.checkString(dotfiles, "dotfiles") as string;
    if (this.getError("dotfiles")) return;

    if (strDotfiles === "ignore" || strDotfiles === "allow" || strDotfiles === "deny") {
      return strDotfiles;
    }
    this.setError(
      "dotfiles",
      new TypeError("dotfiles option must be \"allow\", \"deny\", or \"ignore\"")
    );
  }

  castMaxAge(maxage: unknown = MAX_MAXAGE) {
    let finalMaxAge;

    // in case `maxage` is number
    finalMaxAge = this.castRange(maxage, "maxage", { min: 0, max: MAX_MAXAGE });
    if (!this.getError("maxage")) return finalMaxAge as number;

    this.cleanError("maxage");
    finalMaxAge = this.checkString(maxage, "maxage");
    if (this.getError("maxage")) return undefined;
    finalMaxAge = ms(finalMaxAge as string);
    finalMaxAge = this.checkRange(finalMaxAge, "maxage", { min: 0, max: MAX_MAXAGE });
    if (!this.getError("maxage")) return finalMaxAge as number;

    return undefined;
  }

  castPath(path: unknown): string | void {
    const strPath = this.checkString(path, "path");
    if (this.getError("path")) return;

    let decodedPath: string; try {
      decodedPath = decodeURIComponent(strPath as string);
    } catch (err) {
      this.setError("path", { message: (err as Error).message });
      return;
    }

    if (decodedPath.includes("\0")) {
      this.setError("path", { message: "Null byte in path" });
      return;
    }

    return decodedPath;
  }

  validate(options: Record<string, unknown>): SendStreamOpts {
    // part of this opts probably isn't used because we currently
    // don't have `redirect` and `sendIndex` functionality
    const opts = {
      acceptRanges: true,
      cacheControl: true,
      etag: true,
      hidden: false,
      extensions: [],
      immutable: false,
      index: [],
      lastModified: true,
      ...options,
      root: this.checkString(options.root, "root") as string,
      dotfiles: this.checkDotfiles(options.dotfiles || "ignore") as DotFilesAction,
      maxage: this.castMaxAge(options.maxage) as number,
      path: this.castPath(options.path) as string,
    };

    if (this.checkHasErrors()) {
      throw new TypeError(`SendStream options is invalid. ${JSON.stringify(this.getErrors())}`);
    }

    return opts;
  }
}

function mapStatError(error: any, path: string) {
  switch (error.code) {
    case "ENAMETOOLONG":
    case "ENOENT":
    case "ENOTDIR":
      return new NotFoundError("File doesn't exists", { cause: error, params: { path } });
    default:
      return new GeneralError(`Not able to serve file. ${error}`, { params: { path } });
  }
}
