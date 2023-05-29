import http, { IncomingHttpHeaders } from "node:http";
import https from "node:https";
import { waitForResponse } from "../streams.js";
import { HTTPMethod } from "./types.js";

type ReqOpts = {
  method: string;
  headers?: IncomingHttpHeaders;
};

type CallHttpOpts = {
  url: string;
  method: HTTPMethod;
  headers: IncomingHttpHeaders;
  body?: unknown;
  timeout: number;
  token?: string;
}

export async function httpCall(opts: CallHttpOpts): Promise<http.IncomingMessage> {
  if (opts.token && !opts.headers["Authorization"]) {
    opts.headers.Authorization = `Bearer ${opts.token}`;
  }

  const req = makeRequest(opts);
  const resp = await waitForResponse(req, opts.url);

  // Naverno huin9, ibo
  // 1. netu dostupa do "resp", a v "params" sovat ego huin9
  //    ibo ne JSONit, otdelnoe svoistvo zavodit? nu takoe
  // 2. byvaut scenarii kogda esli otvet 500ka - to poprobui ew'e
  //    ili 400ka - avtorizuis9/etc, i handlit eto "catch-ami" huin9,
  //    ..
  //    ty skazhew: "a kak zhe - kazhda9 fn -> pozitivnyi scenarii + excepwyny"
  //    ono to da, no wo takoe "positivnyi scenarii" opredil9ets9 vywe, na urovne
  //    business logici
  // 3. Op9tzhe, est' varik wo ty etu owybku mozhew greto lovit i pytat's9 obrabotat,
  //    a esli ne smog to oborachivat i brosat wyshe - i tut babac -> ewe odna nah-nenuzhna9
  //    obertka "HttpError"
  //
  //if (resp.statusCode && resp.statusCode >= 400) {
  //  throw new HttpError(resp.statusMessage, {
  //    httpStatus: resp.statusCode
  //  });
  //}

  return resp;

  //const respBuffers = [];
  //// eslint-disable-next-line no-restricted-syntax
  //for await (const data of resp) respBuffers.push(data);

  //return Buffer.concat(respBuffers).toString();
}

function makeRequest({
  url,
  method = "GET",
  headers = {},
  body = undefined,
  timeout = 5000,
}: CallHttpOpts): http.ClientRequest {
  const secure = new URL(url).protocol === "https:";
  const httpMod = secure ? https : http;

  const opts: ReqOpts  = { method };
  if (body) {
    headers = { ...headers, "content-type": "application/json" };
  }
  if (headers) opts.headers = headers;

  const req = httpMod.request(url, opts);
  req.end(JSON.stringify(body));
  req.setTimeout(timeout);

  return req;
}
