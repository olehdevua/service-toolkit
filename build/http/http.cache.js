const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;
export function isPreconditionFailure(req, res) {
    const unmodifiedSince = Date.parse(req.headers["if-unmodified-since"]);
    const lastModified = Date.parse(res.getHeader("last-modified"));
    const match = req.headers["if-match"];
    const etag = res.getHeader("etag");
    if (match) {
        if (!etag)
            return true;
        if (match === "*")
            return false;
        if (matchesEtag(match, etag))
            return false;
        return true;
    }
    if (!isNaN(unmodifiedSince)) {
        if (isNaN(lastModified))
            return true;
        if (lastModified > unmodifiedSince)
            return true;
    }
    return false;
}
export function checkRespFreshness(req, res) {
    const modifiedSince = Date.parse(req.headers["if-modified-since"]);
    const lastModified = Date.parse(res.getHeader("last-modified"));
    const noneMatch = req.headers["if-none-match"];
    const etag = res.getHeader("etag");
    const cacheControl = req.headers["cache-control"];
    if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl))
        return false;
    if (noneMatch) {
        if (!etag)
            return false;
        if (noneMatch === "*")
            return true;
        if (matchesEtag(noneMatch, etag))
            return true;
    }
    if (!isNaN(modifiedSince)) {
        if (isNaN(lastModified))
            return false;
        if (lastModified > modifiedSince)
            return false;
        return true;
    }
    return false;
}
export function isRangeFresh(req, res) {
    const ifRange = req.headers["if-range"];
    const lastModified = Date.parse(res.getHeader("last-modified"));
    const etag = res.getHeader("etag");
    if (typeof ifRange !== "string")
        return true;
    if (typeof etag === "string" && ifRange.includes("\""))
        return ifRange.includes(etag);
    if (!isNaN(lastModified)) {
        return lastModified <= Date.parse(ifRange);
    }
    return false;
}
export function isCachable(res) {
    const statusCode = res.statusCode;
    return (statusCode >= 200 && statusCode < 300) ||
        statusCode === 304;
}
function matchesEtag(match, etag) {
    return match.split(",")
        .map(m => m.trim())
        .some(m => m === etag || m === "W/" + etag || "W/" + m === etag);
}
export function isConditionalReq(req) {
    return Boolean(req.headers["if-match"] ||
        req.headers["if-none-match"] ||
        req.headers["if-unmodified-since"] ||
        req.headers["if-modified-since"]);
}
//# sourceMappingURL=http.cache.js.map