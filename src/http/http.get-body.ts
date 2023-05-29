import * as http from "http";
import { HttpError } from "../errors.js";
import { getContentLength, getContentType, parseURLEncoded } from "./http.misc.js";

export async function getBody (
  stream: http.IncomingMessage,
  opts: { length: number; limit?: number }
): Promise<Buffer> {
  const { limit, length } = opts;

  // we leave the stream paused on purpose,
  // so caller should handle the stream themselves.
  if (limit && length && length > limit) {
    throw new HttpError(
      "Request body exceed expected limit",
      { params: { length, limit }, httpStatus: 413 }
    );
  }

  let received = 0;
  const buffer: Buffer[] = [];

  for await (const chunk of stream) {
    received += chunk.length;

    if (limit && received > limit) {
      stream.unpipe();
      stream.pause();
      throw new HttpError(
        "Request body too large",
        { params: { length, limit, received }, httpStatus: 413 }
      );
    }
    else {
      buffer.push(chunk);
    }
  }

  if (length && received !== length) {
    throw new HttpError(
      "Request size did not match content length",
      { params: { length, limit, received } }
    );
  }

  return Buffer.concat(buffer);
}

/**
 * @param req
 * @param bodyLimit - size of body in bytes
 */
export async function getJSBody(
  req: http.IncomingMessage,
  bodyLimit = 1_000_000,
): Promise<Readonly<Record<string, unknown>>> {
  // TODO: handle `content-encoding` header
  const type = getContentType(req);
  const length = getContentLength(req);
  const bodyBuf = await getBody(req, { length, limit: bodyLimit });
  const body = bodyBuf.toString();

  try {
    switch (type) {
      case "json": return JSON.parse(body);
      case "urlencoded": return parseURLEncoded(body);
    }
  } catch(e) {
    throw new HttpError("Invalid payload", { params: { type } });
  }
}
