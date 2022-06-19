/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import * as http from "node:http";
import { Writable } from "node:stream";
export declare function waitForResponse(reqStream: http.ClientRequest, url: string): Promise<http.IncomingMessage>;
export declare function waitForWriteFinish(stream: Writable): Promise<unknown>;
//# sourceMappingURL=streams.d.ts.map