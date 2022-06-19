import http from "node:http";
import https from "node:https";
import { waitForResponse } from "../streams.js";
export async function httpCall(opts) {
    if (opts.token && !opts.headers["Authorization"]) {
        opts.headers.Authorization = `Bearer ${opts.token}`;
    }
    const req = makeRequest(opts);
    const resp = await waitForResponse(req, opts.url);
    return resp;
}
function makeRequest({ url, method = "GET", headers = {}, body = undefined, timeout = 5000, }) {
    const secure = new URL(url).protocol === "https:";
    const httpMod = secure ? https : http;
    const opts = { method };
    if (body) {
        headers = { ...headers, "content-type": "application/json" };
    }
    if (headers)
        opts.headers = headers;
    const req = httpMod.request(url, opts);
    req.end(JSON.stringify(body));
    req.setTimeout(timeout);
    return req;
}
//# sourceMappingURL=http.client.js.map