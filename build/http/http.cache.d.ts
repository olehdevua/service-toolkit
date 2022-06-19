/// <reference types="node" resolution-mode="require"/>
import * as http from "node:http";
export declare function isPreconditionFailure(req: http.IncomingMessage, res: http.ServerResponse): boolean;
export declare function checkRespFreshness(req: http.IncomingMessage, res: http.ServerResponse): boolean;
export declare function isRangeFresh(req: http.IncomingMessage, res: http.ServerResponse): boolean;
export declare function isCachable(res: http.ServerResponse): boolean;
export declare function isConditionalReq(req: http.IncomingMessage): boolean;
//# sourceMappingURL=http.cache.d.ts.map