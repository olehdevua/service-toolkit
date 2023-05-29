import * as http from "http";
import mime from "mime";
import { HttpError } from "../errors.js";

export type ContentType = "json" | "urlencoded";

// RegExp to match non-URL code points, *after* encoding (i.e. not including "%")
// and including invalid escape sequences.
const ENCODE_CHARS_REGEXP = /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g;

// RegExp to match unmatched surrogate pair.
const UNMATCHED_SURROGATE_PAIR_REGEXP = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;

// String to replace unmatched surrogate pair with.
const UNMATCHED_SURROGATE_PAIR_REPLACE = "$1\uFFFD$2";

const MATCH_HTML_REG_EXP = /["'&<>]/;

/**
 * Encode a URL to a percent-encoded form, excluding already-encoded sequences.
 *
 * This function will take an already-encoded URL and encode all the non-URL
 * code points. This function will not encode the "%" character unless it is
 * not part of a valid sequence (`%20` will be left as-is, but `%foo` will
 * be encoded as `%25foo`).
 *
 * This encode is meant to be "safe" and does not throw errors. It will try as
 * hard as it can to properly encode the given URL, including replacing any raw,
 * unpaired surrogate pairs with the Unicode replacement character prior to
 * encoding.
 */
export function encodeUrl(url: string): string {
  return url
    .replace(UNMATCHED_SURROGATE_PAIR_REGEXP, UNMATCHED_SURROGATE_PAIR_REPLACE)
    .replace(ENCODE_CHARS_REGEXP, encodeURI);
}

// Escape special characters in the given string for inserting into HTML.
export function escapeHtml(strToEscape: string): string {
  const match = MATCH_HTML_REG_EXP.exec(strToEscape);

  if (!match) return strToEscape;

  let html = "";
  let index = 0;
  let lastIndex = 0;

  for (index = match.index; index < strToEscape.length; index++) {
    const escape = mapCharCodeToEscapeSign(strToEscape.charCodeAt(index));

    if (escape === null) continue;

    if (lastIndex !== index) {
      html += strToEscape.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index
    ? html + strToEscape.substring(lastIndex, index)
    : html;
}


// TODO: add support of "application/x-www-form-urlencoded"
// Because it's more optimized for CORS (no preflight in POST)
export function getContentType(req: http.IncomingMessage): ContentType {
  const contentTypeHeader = req.headers["content-type"];
  if (!contentTypeHeader) {
    throw new HttpError("Body type missing", { httpStatus: 415 });
  }

  const splitterPos = contentTypeHeader.search(";");
  const contentType = splitterPos === -1
    ? contentTypeHeader
    : contentTypeHeader.slice(0, splitterPos).trim();

  switch(contentType) {
    case "application/json": return "json";
    case "application/x-www-form-urlencoded": return "urlencoded";
    default: {
      throw new HttpError("Unsupported media type", { params: { contentType }, httpStatus: 415 });
    }
  }
}

export function getContentLength(req: http.IncomingMessage): number {
  const val = req.headers["content-length"];

  if (!val) {
    throw new HttpError("Content-Length is missing", { httpStatus: 411 });
  }

  const length = Number.parseInt(val, 10);

  if (Number.isNaN(length)) {
    throw new HttpError("Content-Length has wrong format", { params: { length } });
  }

  return length;
}

export function parseURLEncoded(body: string) {
  const params = new URL("http://stub?" + body).searchParams;
  return mapSearchParamsToRec(params);
}

export function getQuery(
  req: http.IncomingMessage
): Readonly<Record<string, unknown>> {
  if (!req.url) throw new TypeError("Only incoming requests have `url`");
  // TODO: figure out how to deal with `http|https` variants
  const sp = new URL(req.url, `http://${req.headers.host}`).searchParams;
  return mapSearchParamsToRec(sp);
}

export function getPath(
  req: http.IncomingMessage
): string {
  if (!req.url) throw new TypeError("Only incoming requests have `url`");
  const endOfPath = req.url.indexOf("?");
  return endOfPath === -1 ? req.url : req.url.slice(0, endOfPath);
}

export async function send(
  resp: http.ServerResponse,
  result: string,
  { status, type }: { status: number; type: string; }
): Promise<void> {
  if (resp.headersSent) {
    throw new HttpError(
      "service-toolkit.http.send: cannot send, headers are sent",
      { params: { type }, httpStatus: 500 }
    );
  }

  resp.setHeader("Content-Type", type);
  resp.statusCode = status;

  return new Promise((resolve, reject) => {
    resp.end(result, () => resolve());
    resp.on("error", reject);
  });
}


function mapSearchParamsToRec(
  params: URLSearchParams
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  params.forEach((val: string, key: string) => {
    if (key[0] === "[" && key[1] === "]") {
      const trueKey = key.slice(2);
      const values = result[decodeURIComponent(trueKey)] as string[] || [];
      values.push(decodeURIComponent(val));
    }
    result[key] = val;
  });

  return result;
}


function mapCharCodeToEscapeSign(chCode: number): string | null {
  switch (chCode) {
    case 34: return "&quot;"; // "
    case 38: return "&amp;"; // &
    case 39: return "&#39;"; // '
    case 60: return "&lt;"; // <
    case 62: return "&gt;"; // >
    default: return null;
  }
}

export function getContentTypeFromPath(pathname: string) {
  const type = mime.getType(pathname) ?? "application/octet-stream";
  const charset = [ "js", "html", "xml", "txt" ].includes(mime.getExtension(type) || "");
  return type + (charset ? "; charset=" + charset : "");
}

