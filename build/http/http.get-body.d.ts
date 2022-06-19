/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import * as http from "http";
export declare function getBody(stream: http.IncomingMessage, opts: {
    length: number;
    limit?: number;
}): Promise<Buffer>;
export declare function getJSONBody(req: http.IncomingMessage, bodyLimit?: number): Promise<Readonly<Record<string, unknown>>>;
//# sourceMappingURL=http.get-body.d.ts.map