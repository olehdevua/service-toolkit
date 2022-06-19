import { v1 } from "uuid";
import * as http from "http";
import { getPath, sendText } from "./http.misc.js";
import { getJSONBody } from "./http.get-body.js";
export * from "./http.misc.js";
export * from "./http.get-body.js";
export * from "./http.send.js";
export * from "./http.client.js";
export * as security from "./http.security.js";
export * from "./types.js";
export class HttpServer {
    router;
    server;
    constructor(router, server = http.createServer()) {
        this.router = router;
        this.server = server;
    }
    start(port) {
        this.server.on("request", (req, resp) => {
            const traceId = req.headers["x-trace-id"] || v1();
            const spanId = v1();
            const pathname = getPath(req);
            this.router.handle(req, resp, { context: { traceId, spanId }, pathname });
        });
        return new Promise(ok => {
            this.server.listen(port, "0.0.0.0", () => ok());
        });
    }
}
export class Router {
    logger;
    routes;
    baseRoutes;
    constructor(args) {
        this.logger = args.logger;
        this.routes = args.routes;
        this.baseRoutes = args.baseRoutes = [];
    }
    async handle(req, resp, { context, pathname }) {
        const logger = this.logger.clone({ context });
        const method = req.method;
        const methodHandlers = this.findMethodHandlers(pathname);
        if (!methodHandlers) {
            const body = { error: "No action for route", params: { pathname, method } };
            sendJSON(resp, body, { status: 404 });
            return;
        }
        const controller = methodHandlers[method];
        if (!controller) {
            const body = { error: "Method is not allowed", params: { pathname, method } };
            sendJSON(resp, body, { status: 405 });
            return;
        }
        try {
            logger.log("handle http endpoint", { method, pathname });
            await controller.handle(req, resp, { context, pathname });
        }
        catch (err) {
            if (err instanceof Error) {
                const e = err;
                const { message, stack, code, params } = e.valueOf();
                if (params)
                    params.pathname = pathname;
                logger.error(message, { stack, code, params });
                if (resp.headersSent) {
                    logger.debug("http.Router: Cannot send json, headers are sent", { pathname });
                    return;
                }
                await sendJSON(resp, {
                    error: {
                        message: message,
                        code: e.code || "EGENERAL"
                    },
                    params: e.params,
                }, { status: e.httpStatus || 500 });
                return;
            }
            logger.error(`${err}`);
            if (resp.headersSent)
                logger.debug("http.Router: Cannot send json, headers are sent", { pathname });
            await sendJSON(resp, { error: `${err}` }, { status: 500 });
        }
    }
    findMethodHandlers(pathname) {
        let methodHandlers = this.routes[pathname];
        if (!methodHandlers) {
            const baseMethodHandlers = this.baseRoutes
                .find(br => pathname.startsWith(br.path));
            if (baseMethodHandlers)
                methodHandlers = baseMethodHandlers.methods;
        }
        return methodHandlers;
    }
}
export class DefaultHttpController {
    service;
    logger;
    opts;
    static logger;
    constructor(service, logger, opts) {
        this.service = service;
        this.logger = logger;
        this.opts = opts;
    }
    async handle(req, resp, { context, pathname }) {
        const logger = this.logger.clone({ context });
        const content = await getJSONBody(req, this.opts.httpBodyLimit);
        logger.debug("json body extracted", { pathname, content });
        const result = await this.service.process(content, {
            credentials: { token: "fuck the police" },
            context
        });
        await sendJSON(resp, result, { status: this.opts.successStatus });
    }
}
export async function sendJSON(resp, result, { status }) {
    const body = JSON.stringify(result);
    await sendText(resp, body, { status, type: "application/json" });
}
//# sourceMappingURL=index.js.map