/// <reference types="node" resolution-mode="require"/>
import http, { IncomingHttpHeaders } from "node:http";
import { HTTPMethod } from "./types.js";
declare type CallHttpOpts = {
    url: string;
    method: HTTPMethod;
    headers: IncomingHttpHeaders;
    body?: unknown;
    timeout: number;
    token?: string;
};
export declare function httpCall(opts: CallHttpOpts): Promise<http.IncomingMessage>;
export {};
//# sourceMappingURL=http.client.d.ts.map