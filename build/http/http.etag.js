import * as crypto from "node:crypto";
export function entitytag(entity, { weak }) {
    const weakPrefix = weak ? "W/" : "";
    if (entity.length === 0)
        return weakPrefix + "\"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk\"";
    const hash = crypto
        .createHash("sha1")
        .update(entity, "utf8")
        .digest("base64")
        .substring(0, 27);
    const len = typeof entity === "string"
        ? Buffer.byteLength(entity, "utf8")
        : entity.length;
    return "\"" + len.toString(16) + "-" + hash + "\"";
}
export function stattag(stat) {
    const mtime = stat.mtime.getTime().toString(16);
    const size = stat.size.toString(16);
    return "W/\"" + size + "-" + mtime + "\"";
}
//# sourceMappingURL=http.etag.js.map