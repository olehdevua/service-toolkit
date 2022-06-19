import * as http from "node:http";

const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

// Check if the request preconditions failed.
export function isPreconditionFailure(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  // if-match
  const unmodifiedSince = Date.parse(req.headers["if-unmodified-since"] as string);
  const lastModified = Date.parse(res.getHeader("last-modified") as string);
  const match = req.headers["if-match"];
  const etag = res.getHeader("etag") as string | undefined;

  if (match) {
    if (!etag) return true;
    if (match === "*") return false;
    if (matchesEtag(match, etag as string)) return false;
    return true;
  }

  // if-unmodified-since
  if (!isNaN(unmodifiedSince)) {
    if (isNaN(lastModified)) return true;
    if (lastModified > unmodifiedSince) return true;
  }

  return false;
}

export function checkRespFreshness(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  const modifiedSince = Date.parse(req.headers["if-modified-since"] as string);
  const lastModified = Date.parse(res.getHeader("last-modified") as string);
  const noneMatch = req.headers["if-none-match"];
  const etag = res.getHeader("etag") as string | undefined;

  // Always return stale when Cache-Control: no-cache
  // to support end-to-end reload requests
  // https://tools.ietf.org/html/rfc2616#section-14.9.4
  const cacheControl = req.headers["cache-control"];
  if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) return false;

  if (noneMatch) {
    if (!etag) return false;
    if (noneMatch === "*") return true;
    if (matchesEtag(noneMatch, etag)) return true;
  }

  // if-modified-since
  if (!isNaN(modifiedSince)) {
    if (isNaN(lastModified)) return false;
    if (lastModified > modifiedSince) return false;
    return true;
  }

  return false;
}

// Check if the range is fresh.
export function isRangeFresh(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  const ifRange = req.headers["if-range"];
  //const lastModified = res.getHeader("Last-Modified");
  const lastModified = Date.parse(res.getHeader("last-modified") as string);
  const etag = res.getHeader("etag");

  if (typeof ifRange !== "string") return true;

  // if-range as etag
  if (typeof etag === "string" && ifRange.includes("\"")) return ifRange.includes(etag);

  // if-range as modified date
  if (!isNaN(lastModified))  {
    return lastModified <= Date.parse(ifRange);
  }

  return false;
}

// Check if the request is cacheable, aka
// responded with 2xx or 304 (see RFC 2616 section 14.2{5,6}).
export function isCachable(res: http.ServerResponse): boolean {
  const statusCode = res.statusCode;
  return (statusCode >= 200 && statusCode < 300) ||
    statusCode === 304;
}

function matchesEtag(match: string, etag: string): boolean {
  return match.split(",")
    .map(m => m.trim())
    .some(m => m === etag || m === "W/" + etag || "W/" + m === etag);
}

export function isConditionalReq(req: http.IncomingMessage): boolean {
  return Boolean(
    req.headers["if-match"] ||
    req.headers["if-none-match"] ||
    req.headers["if-unmodified-since"] ||
    req.headers["if-modified-since"]
  );
}
