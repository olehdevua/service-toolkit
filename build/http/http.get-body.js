import { HttpError } from "../errors.js";
import { getContentLength, getContentType, parseURLEncoded } from "./http.misc.js";
export async function getBody(stream, opts) {
    const { limit, length } = opts;
    if (limit && length && length > limit) {
        throw new HttpError("Request body exceed expected limit", { params: { length, limit }, httpStatus: 413 });
    }
    let received = 0;
    const buffer = [];
    for await (const chunk of stream) {
        received += chunk.length;
        if (limit && received > limit) {
            stream.unpipe();
            stream.pause();
            throw new HttpError("Request body too large", { params: { length, limit, received }, httpStatus: 413 });
        }
        else {
            buffer.push(chunk);
        }
    }
    if (length && received !== length) {
        throw new HttpError("Request size did not match content length", { params: { length, limit, received } });
    }
    return Buffer.concat(buffer);
}
export async function getJSONBody(req, bodyLimit = 1000000) {
    const type = getContentType(req);
    const length = getContentLength(req);
    const bodyBuf = await getBody(req, { length, limit: bodyLimit });
    const body = bodyBuf.toString();
    try {
        switch (type) {
            case "json": return JSON.parse(body);
            case "urlencoded": return parseURLEncoded(body);
        }
    }
    catch (e) {
        throw new HttpError("Invalid payload", { params: { type } });
    }
}
//# sourceMappingURL=http.get-body.js.map