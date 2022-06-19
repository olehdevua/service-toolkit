import * as crypto from "node:crypto";
import { Stats } from "fs";

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
