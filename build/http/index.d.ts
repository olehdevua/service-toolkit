/// <reference types="node" resolution-mode="require"/>
import * as http from "http";
import { Logger, Service } from "../index.js";
import { HttpController, HttpControllerHandleOpts, MethodHandlers } from "./types.js";
export * from "./http.misc.js";
export * from "./http.get-body.js";
export * from "./http.send.js";
export * from "./http.client.js";
export * as security from "./http.security.js";
export * from "./types.js";
export declare class HttpServer {
    private router;
    server: http.Server;
    constructor(router: Router, server?: http.Server);
    start(port: number): Promise<void>;
}
declare type BaseRoute = {
    path: string;
    methods: MethodHandlers;
};
export declare class Router implements HttpController {
    private logger;
    private routes;
    private baseRoutes;
    constructor(args: {
        logger: Logger;
        routes: Record<string, MethodHandlers>;
        baseRoutes?: BaseRoute[];
    });
    handle(req: http.IncomingMessage, resp: http.ServerResponse, { context, pathname }: HttpControllerHandleOpts): Promise<void>;
    private findMethodHandlers;
}
export declare class DefaultHttpController implements HttpController {
    private service;
    private logger;
    private opts;
    static logger?: Logger;
    constructor(service: Service, logger: Logger, opts: {
        successStatus: number;
        httpBodyLimit?: number;
    });
    handle(req: http.IncomingMessage, resp: http.ServerResponse, { context, pathname }: HttpControllerHandleOpts): Promise<void>;
}
export declare function sendJSON(resp: http.ServerResponse, result: unknown, { status }: {
    status: number;
}): Promise<void>;
//# sourceMappingURL=index.d.ts.map