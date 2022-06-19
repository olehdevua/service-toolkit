/// <reference types="node" resolution-mode="require"/>
import * as http from "http";
export declare type HttpControllerHandleOpts = {
    pathname: string;
    context: {
        traceId: string;
        spanId: string;
    };
};
export interface HttpController {
    handle(req: http.IncomingMessage, resp: http.ServerResponse, opts: HttpControllerHandleOpts): Promise<void>;
}
export declare type HTTPMethod = "POST" | "GET" | "SEARCH" | "DELETE" | "PUT" | "PATCH";
export declare type MethodHandlers = Partial<Record<HTTPMethod, HttpController>>;
//# sourceMappingURL=types.d.ts.map