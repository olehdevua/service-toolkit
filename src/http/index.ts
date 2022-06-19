import { v1 } from "uuid";
import * as http from "http";
import { GeneralError } from "../errors.js";
import { Logger, Service } from "../index.js";
import { HttpController, HttpControllerHandleOpts, HTTPMethod, MethodHandlers } from "./types.js";
import { getPath, sendText } from "./http.misc.js";
import { getJSONBody } from "./http.get-body.js";

export * from "./http.misc.js";
export * from "./http.get-body.js";
export * from "./http.send.js";
export * from "./http.client.js";
export * as security from "./http.security.js";
export * from "./types.js";

export class HttpServer {
  constructor(
    private router: Router,
    public server: http.Server = http.createServer(),
  ) {}

  start(port: number): Promise<void> {
    this.server.on("request", (req, resp) => {
      const traceId = req.headers["x-trace-id"] as string || v1();
      const spanId = v1();

      // const url = new URL(req.url as string);
      const pathname = getPath(req);
      this.router.handle(req, resp, { context: { traceId, spanId }, pathname });
    });

    // this.server.on("close"); ?? graceful shutdown?

    return new Promise(ok => {
      this.server.listen(port, "0.0.0.0", () => ok());
    });
  }
}

type BaseRoute = {
  path: string,
  methods: MethodHandlers
};
// NOTE: not sure if it should to implement `HttpController`
export class Router implements HttpController {
  private logger: Logger;
  private routes: Record<string, MethodHandlers>;
  private baseRoutes: BaseRoute[];

  constructor(
    args: {
      logger: Logger,
      routes: Record<string, MethodHandlers>,
      baseRoutes?: BaseRoute[],
    }
  ) {
    this.logger = args.logger;
    this.routes = args.routes;
    this.baseRoutes = args.baseRoutes = [];
  }

  async handle(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
    { context, pathname }: HttpControllerHandleOpts
  ): Promise<void> {
    const logger = this.logger.clone({ context });

    // always string for `req` received `http.Server`
    const method = req.method as HTTPMethod;

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
      logger.info("handle http endpoint", { method, pathname });
      await controller.handle(req, resp, { context, pathname });
    } catch(err) {
      if (err instanceof Error) {
        const e = err as GeneralError;

        const { message, stack, code, params } = e.valueOf();
        if (params) params.pathname = pathname;
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

  private findMethodHandlers(pathname: string): MethodHandlers {
    let methodHandlers = this.routes[pathname];
    if (!methodHandlers) {
      const baseMethodHandlers = this.baseRoutes
        .find(br => pathname.startsWith(br.path));
      if (baseMethodHandlers) methodHandlers = baseMethodHandlers.methods;
    }
    return methodHandlers;
  }
}

export class DefaultHttpController implements HttpController {
  static logger?: Logger;

  constructor(
    private service: Service,
    private logger: Logger,
    private opts: {
      successStatus: number,
      httpBodyLimit?: number,
    }
  ) {}

  async handle(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
    { context, pathname }: HttpControllerHandleOpts
  ): Promise<void> {
    const logger = this.logger.clone({ context });

    const content = await getJSONBody(req, this.opts.httpBodyLimit);
    // bullshit? just used logger to calm eslint 😀
    logger.debug("json body extracted", { pathname, content });

    const result = await this.service.process(content, {
      credentials: { token: "fuck the police" },
      context
    });

    await sendJSON(resp, result, { status: this.opts.successStatus });
  }
}

export async function sendJSON(
  resp: http.ServerResponse,
  result: unknown,
  { status }: { status: number; }
): Promise<void> {
  const body = JSON.stringify(result);
  await sendText(resp, body, { status, type: "application/json" });
}
