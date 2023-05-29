import * as http from "node:http";
import * as crypto from "node:crypto";
import { Stats } from "fs";
import { HttpError } from "../errors.js";
import { HttpRespSender } from "./http.send.js";

const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;
// const MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000; // 1 year

const emptyContentHeaders = {
  "Content-Encoding": undefined,
  "Content-Language": undefined,
  "Content-Length": undefined,
  "Content-Range": undefined,
  "Content-Type": undefined,
};

export type CacheOpts = {
  // acceptRanges: boolean;
  cacheControl?: {
    immutable?: boolean;
    maxage: number;
  };
  // etag: string;
  // lastModified: Date;
  pathname: string;
  // start?: number;
  // end?: number;
};

/**
 * Design note:
 *
 * Why eventually we decided to pass `etag` and `lastModified`
 * as params to fns like `checkRespFreshness`, `checkPreconditionFailure`,
 * `checkRangeFresh`?
 *
 * Because `sendFile` is just like orchestrator here, and
 * those fns can be used independently, we don't need to
 * enforce on all other levels beyond `sendFile` that `etag`
 * is from the same "flow"(file)
 */

export class CacheManager {
  protected constructor(
    private reqHeaders: http.IncomingHttpHeaders,
    private httpSender: HttpRespSender,
    private o: CacheOpts
  ) {}

  static init(
    sender: HttpRespSender,
    reqHeaders: http.IncomingHttpHeaders,
    o: CacheOpts,
  ) {
    const headers = sender.getRespHeaders();

    const etag = headers["ETag"];
    const lastModified = headers["Last-Modified"];
    const cacheControl = headers["Cache-Control"];

    if (etag || lastModified || cacheControl) {
      throw new HttpError("headers is already set", {
        params: { headers: { etag, lastModified, cacheControl } }
      });
    }

    return new CacheManager(reqHeaders, sender, o);
  }

  async sendFile(stats: Stats): Promise<boolean> {
    this.setFile(stats);

    // conditional GET support
    if (isConditionalReq(this.reqHeaders)) {
      // Copied from origin source, but WHY WE NEED IT?
      // `isPreconditionFailure` makes sens only on `POST|PUT|PATCH` methods
      if (this.checkPreconditionFailure()) {
        throw new HttpError("Precondition Failure", {
          params: { pathname: this.o.pathname },
          httpStatus: 412
        });
      }

      if (
        isCachable(this.httpSender.status) &&
        this.checkRespFreshness()
      ) {
        this.httpSender.setHeaders(emptyContentHeaders);
        return this.httpSender.send("", { status: 304, cleanOldHeaders: true });
      }
    }

    return false;
  }

  protected setFile(stats: Stats) {
    const lastModified = stats.mtime;
    const etag = stattag(stats);

    this.setHeaders(etag, lastModified);
  }

  protected setHeaders(etag: string, lastModified: Date) {
    const headers: Record<string, string> = {};

    if (this.o.cacheControl) {
      let cacheControl = "public, max-age=" + Math.floor(this.o.cacheControl.maxage / 1000);
      if (this.o.cacheControl.immutable) cacheControl += ", immutable";
      headers["cache-control"] = cacheControl;
    }
    headers["etag"] = etag;
    headers["last-modified"] = lastModified.toISOString();

    this.httpSender.setHeaders(headers);
  }

  protected checkRespFreshness(): boolean {
    // Always return stale when Cache-Control: no-cache
    // to support end-to-end reload requests
    // https://tools.ietf.org/html/rfc2616#section-14.9.4
    const cacheControl = this.reqHeaders["cache-control"];
    if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl))
      return false;

    const etag = this.httpSender.getHeader("etag") as string | undefined;
    const lastModified = this.httpSender.getHeader("last-modified") as string | undefined;

    const noneMatch = this.reqHeaders["if-none-match"];
    if (noneMatch) {
      const isMatch = checkIfMatch(noneMatch, etag);
      if (isMatch) return true;
    }

    // if-modified-since
    const modifiedSince = Date.parse(this.reqHeaders["if-modified-since"] as string);
    if (!isNaN(modifiedSince)) {
      if (!lastModified) return false;
      if (Date.parse(lastModified) <= modifiedSince) return true;
    }

    return false;
  }

  // Check if the request preconditions failed.
  protected checkPreconditionFailure(): boolean {
    const etag = this.httpSender.getHeader("etag") as string | undefined;
    const lastModified = this.httpSender.getHeader("last-modified") as string | undefined;

    // if-match
    const match = this.reqHeaders["if-match"];
    if (match) return !checkIfMatch(match, etag);

    // if-unmodified-since
    const unmodifiedSince = Date.parse(this.reqHeaders["if-unmodified-since"] as string);
    if (!isNaN(unmodifiedSince)) {
      if (!lastModified) return true;
      if (Date.parse(lastModified) > unmodifiedSince) return true;
    }

    return false;
  }

  // public checkRangeFresh(etag?: string, lastModified?: Date): boolean {
  public checkRangeFresh(): boolean {
    const etag = this.httpSender.getHeader("etag") as string | undefined;
    const lastModified = this.httpSender.getHeader("last-modified") as string | undefined;
    const ifRange = this.reqHeaders["if-range"];

    if (typeof ifRange === "string") {
      // if-range as etag
      if (etag) {
        if (ifRange.includes("\"")) return ifRange.includes(etag);
      }

      // if-range as modified date
      if (lastModified) {
        return Date.parse(lastModified) <= Date.parse(ifRange);
      }
    }

    return false;
  }

}

function isConditionalReq(headers: http.IncomingHttpHeaders): boolean {
  return Boolean(
    headers["if-match"] ||
    headers["if-none-match"] ||
    headers["if-unmodified-since"] ||
    headers["if-modified-since"]
  );
}

// Check if the request is cacheable, aka
// responded with 2xx or 304 (see RFC 2616 section 14.2{5,6}).
function isCachable(statusCode: number): boolean {
  return (statusCode >= 200 && statusCode < 300) ||
    statusCode === 304;
}

function matchesEtag(match: string, etag: string): boolean {
  return match.split(",")
    .map(m => m.trim())
    .some(m => m === etag || m === "W/" + etag || "W/" + m === etag);
}

function checkIfMatch(match: string, etag?: string) {
  if (!etag) return false;
  if (match === "*") return true;
  if (matchesEtag(match, etag)) return true;
  return false;
}

export function entitytag (
  entity: string | Buffer,
  { weak }: { weak: boolean }
) {
  const weakPrefix = weak ? "W/" : "";

  // fast-path empty
  if (entity.length === 0) return weakPrefix + "\"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk\"";

  const hash = crypto
    .createHash("sha1")
    .update(entity as any, "utf8")
    .digest("base64")
    .substring(0, 27);

  // compute length of entity
  const len = typeof entity === "string"
    ? Buffer.byteLength(entity, "utf8")
    : entity.length;

  return "\"" + len.toString(16) + "-" + hash + "\"";
}

// Generate a tag for a stat.
export function stattag (stat: Stats): string {
  const mtime = stat.mtime.getTime().toString(16);
  const size = stat.size.toString(16);

  return "W/\"" + size + "-" + mtime + "\"";
}
